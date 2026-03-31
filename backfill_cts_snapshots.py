#!/usr/bin/env python3
"""
backfill_cts_snapshots.py — Compute and store rolling point-in-time CTS snapshots.

Usage:
    python3 backfill_cts_snapshots.py              # full historical backfill (weekly)
    python3 backfill_cts_snapshots.py --daily       # today's snapshot only (for cron)
    python3 backfill_cts_snapshots.py --start-date 2025-01-01 --end-date 2025-06-01
    python3 backfill_cts_snapshots.py --force       # recompute existing dates

This eliminates survivorship bias in the copy-trade backtester by computing
CTS scores using only data available up to each snapshot date, rather than
using the single March 2026 snapshot from backfill_cts.py.
"""

import argparse
import sqlite3
import sys
import os
from datetime import datetime, timedelta, timezone

# Reuse the parameterized calculate_cts and config from backfill_cts.py
sys.path.insert(0, os.path.dirname(__file__))
from backfill_cts import calculate_cts, CTS_CONF, DB_PATH


# ──────────────────────────────────────────────────────────────────────────────
# Schema migration
# ──────────────────────────────────────────────────────────────────────────────

def migrate(conn: sqlite3.Connection) -> None:
    """Create cts_snapshots table and performance indexes if they don't exist."""
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS cts_snapshots (
            snapshot_date           TEXT    NOT NULL,
            address                 TEXT    NOT NULL,
            copy_trading_score      INTEGER NOT NULL,
            cts_consistency         REAL    NOT NULL DEFAULT 0,
            cts_risk_adjusted       REAL    NOT NULL DEFAULT 0,
            cts_recency_pnl         REAL    NOT NULL DEFAULT 0,
            cts_win_rate            REAL    NOT NULL DEFAULT 0,
            cts_drawdown_score      REAL    NOT NULL DEFAULT 0,
            cts_absolute_return     REAL    NOT NULL DEFAULT 0,
            pnl_7d                  REAL    NOT NULL DEFAULT 0,
            pnl_30d                 REAL    NOT NULL DEFAULT 0,
            pnl_90d                 REAL    NOT NULL DEFAULT 0,
            max_drawdown_pct        REAL    NOT NULL DEFAULT 0,
            profitable_weeks_ratio  REAL    NOT NULL DEFAULT 0,
            PRIMARY KEY (snapshot_date, address)
        );

        CREATE INDEX IF NOT EXISTS idx_cts_snapshots_date
            ON cts_snapshots(snapshot_date);

        CREATE INDEX IF NOT EXISTS idx_cts_snapshots_addr_date
            ON cts_snapshots(address, snapshot_date);

        -- Composite index on trades(address, timestamp) is critical for CTS query
        -- performance: each of the 5 SQL queries in calculate_cts filters by both.
        CREATE INDEX IF NOT EXISTS idx_trades_addr_ts
            ON trades(address, timestamp);
    ''')
    conn.commit()


# ──────────────────────────────────────────────────────────────────────────────
# Core backfill
# ──────────────────────────────────────────────────────────────────────────────

def backfill_snapshots(
    db_path: str = DB_PATH,
    interval_days: int = 7,
    start_date: str | None = None,
    end_date: str | None = None,
    force: bool = False,
) -> None:
    """
    Compute and store CTS snapshots at regular intervals.

    Parameters
    ----------
    db_path       : path to the SQLite database
    interval_days : days between snapshots (7 = weekly for backfill)
    start_date    : first snapshot date 'YYYY-MM-DD' (default: first trade + 12-week lookback)
    end_date      : last snapshot date 'YYYY-MM-DD' (default: last trade date)
    force         : if True, recompute and replace existing snapshots
    """
    if not os.path.exists(db_path):
        print(f"[cts_snapshots] DB not found: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.execute('PRAGMA journal_mode=WAL')
    migrate(conn)

    cursor = conn.cursor()
    lookback_weeks = CTS_CONF.get('lookback_weeks', 12)

    # ── Determine date range ──────────────────────────────────────────────────
    cursor.execute('SELECT MIN(timestamp), MAX(timestamp) FROM trades')
    min_ts, max_ts = cursor.fetchone()
    if not min_ts:
        print("[cts_snapshots] No trades found. Aborting.")
        conn.close()
        return

    if start_date is None:
        first_snap_ts = min_ts + (lookback_weeks * 7 * 86400)
        start_dt = datetime.fromtimestamp(first_snap_ts, tz=timezone.utc).date()
    else:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()

    if end_date is None:
        end_dt = datetime.fromtimestamp(max_ts, tz=timezone.utc).date()
    else:
        end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()

    # ── Build snapshot date list ──────────────────────────────────────────────
    snapshot_dates: list[str] = []
    current = start_dt
    while current <= end_dt:
        snapshot_dates.append(current.strftime('%Y-%m-%d'))
        current += timedelta(days=interval_days)

    if not snapshot_dates:
        print("[cts_snapshots] No snapshot dates in range. Aborting.")
        conn.close()
        return

    print(f"[cts_snapshots] {len(snapshot_dates)} snapshots: {snapshot_dates[0]} → {snapshot_dates[-1]}")

    # ── Skip already-computed dates ───────────────────────────────────────────
    if not force:
        cursor.execute('SELECT DISTINCT snapshot_date FROM cts_snapshots')
        existing = {row[0] for row in cursor.fetchall()}
        todo = [d for d in snapshot_dates if d not in existing]
        skipped = len(snapshot_dates) - len(todo)
        if skipped:
            print(f"[cts_snapshots] Skipping {skipped} already-computed dates. {len(todo)} remaining.")
        snapshot_dates = todo

    if not snapshot_dates:
        print("[cts_snapshots] All dates already computed. Use --force to recompute.")
        conn.close()
        return

    # ── Process each snapshot date ────────────────────────────────────────────
    total_scored = 0
    for i, snap_date in enumerate(snapshot_dates):
        # End-of-day timestamp for the snapshot date (exclusive upper bound)
        as_of_ts = int(
            datetime.strptime(snap_date, '%Y-%m-%d')
            .replace(tzinfo=timezone.utc)
            .timestamp()
        ) + 86400  # midnight of the next day

        lookback_start = as_of_ts - (lookback_weeks * 7 * 86400)

        # Find candidate addresses: any wallet with trades in the lookback window
        cursor.execute(
            'SELECT DISTINCT address FROM trades WHERE timestamp >= ? AND timestamp < ?',
            (lookback_start, as_of_ts),
        )
        addresses = [row[0] for row in cursor.fetchall()]

        if force:
            cursor.execute('DELETE FROM cts_snapshots WHERE snapshot_date = ?', (snap_date,))

        scored = 0
        for addr in addresses:
            result = calculate_cts(conn, addr, as_of_ts=as_of_ts)
            if result:
                cursor.execute('''
                    INSERT OR REPLACE INTO cts_snapshots
                    (snapshot_date, address, copy_trading_score,
                     cts_consistency, cts_risk_adjusted, cts_recency_pnl,
                     cts_win_rate, cts_drawdown_score, cts_absolute_return,
                     pnl_7d, pnl_30d, pnl_90d,
                     max_drawdown_pct, profitable_weeks_ratio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    snap_date, addr,
                    result['copy_trading_score'],
                    result['cts_consistency'],
                    result['cts_risk_adjusted'],
                    result['cts_recency_pnl'],
                    result['cts_win_rate'],
                    result['cts_drawdown_score'],
                    result['cts_absolute_return'],
                    result['pnl_7d'],
                    result['pnl_30d'],
                    result['pnl_90d'],
                    result['max_drawdown_pct'],
                    result['profitable_weeks_ratio'],
                ))
                scored += 1

        conn.commit()
        total_scored += scored
        print(f"  [{i+1:>3}/{len(snapshot_dates)}] {snap_date}: {scored:>4} scored / {len(addresses):>5} candidates")

    conn.close()
    print(f"\n[cts_snapshots] Done. {total_scored} total wallet-snapshots written.")


# ──────────────────────────────────────────────────────────────────────────────
# Daily cron entry point
# ──────────────────────────────────────────────────────────────────────────────

def daily_snapshot(db_path: str = DB_PATH) -> None:
    """
    Compute a CTS snapshot for today and upsert into cts_snapshots.
    Idempotent — safe to run multiple times on the same day.
    Called by the daily OpenClaw cron job.
    """
    today = datetime.utcnow().strftime('%Y-%m-%d')
    print(f"[cts_snapshots] Daily snapshot for {today}")
    backfill_snapshots(
        db_path=db_path,
        interval_days=1,
        start_date=today,
        end_date=today,
        force=True,
    )


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compute rolling point-in-time CTS snapshots",
    )
    parser.add_argument(
        '--db',
        default=DB_PATH,
        help=f"Path to SQLite database (default: {DB_PATH})",
    )
    parser.add_argument(
        '--daily',
        action='store_true',
        help="Compute today's snapshot only (for cron use)",
    )
    parser.add_argument(
        '--start-date',
        dest='start_date',
        metavar='YYYY-MM-DD',
        help="First snapshot date (default: first trade + lookback window)",
    )
    parser.add_argument(
        '--end-date',
        dest='end_date',
        metavar='YYYY-MM-DD',
        help="Last snapshot date (default: last trade date)",
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=7,
        metavar='DAYS',
        help="Days between snapshots for backfill (default: 7)",
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help="Recompute and replace existing snapshots",
    )

    args = parser.parse_args()

    if args.daily:
        daily_snapshot(db_path=args.db)
    else:
        backfill_snapshots(
            db_path=args.db,
            interval_days=args.interval,
            start_date=args.start_date,
            end_date=args.end_date,
            force=args.force,
        )


if __name__ == '__main__':
    main()
