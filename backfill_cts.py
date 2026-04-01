#!/usr/bin/env python3
"""One-time backfill of Copy-Trading Score (CTS) for all existing wallets."""

import json
import math
import sqlite3
import os
import time
from datetime import datetime

DB_PATH = os.path.expanduser('~/.openclaw/workspace-radar/wallet-intel/radar-intel.db')
CONFIG_PATH = os.path.expanduser('~/.openclaw/workspace-radar/wallet-intel/config.json')

DEFAULT_CTS_CONFIG = {
    "lookback_weeks": 12,
    "min_weeks_active": 4,
    "min_trades": 50,
    "min_active_recency_days": 14,
    "weights": {
        "consistency": 0.20,
        "risk_adjusted": 0.20,
        "recency_weighted": 0.15,
        "win_rate": 0.15,
        "drawdown": 0.10,
        "absolute_return": 0.20
    },
    "sharpe_cap": 3.0,
    "decay_half_life_weeks": 4,
    "drawdown_severe_threshold": 0.50,
    "drawdown_moderate_threshold": 0.25,
    "absolute_return_cap": 50000
}

try:
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)
    CTS_CONF = config.get('cts', DEFAULT_CTS_CONFIG)
except Exception:
    CTS_CONF = DEFAULT_CTS_CONFIG


def migrate_cts_columns(conn):
    migrations = [
        ("copy_trading_score", "INTEGER DEFAULT 0"),
        ("cts_consistency", "REAL DEFAULT 0"),
        ("cts_risk_adjusted", "REAL DEFAULT 0"),
        ("cts_recency_pnl", "REAL DEFAULT 0"),
        ("cts_win_rate", "REAL DEFAULT 0"),
        ("cts_drawdown_score", "REAL DEFAULT 0"),
        ("cts_absolute_return", "REAL DEFAULT 0"),
        ("pnl_7d", "REAL DEFAULT 0"),
        ("pnl_30d", "REAL DEFAULT 0"),
        ("pnl_90d", "REAL DEFAULT 0"),
        ("max_drawdown_pct", "REAL DEFAULT 0"),
        ("profitable_weeks_ratio", "REAL DEFAULT 0"),
        ("cts_last_calculated_at", "TIMESTAMP"),
        ("polymarket_pnl", "REAL"),
    ]
    cursor = conn.cursor()
    for col_name, col_def in migrations:
        try:
            cursor.execute(f"ALTER TABLE wallets ADD COLUMN {col_name} {col_def}")
        except sqlite3.OperationalError:
            pass
    conn.commit()


def calculate_cts(conn, address, as_of_ts=None):
    """
    Compute CTS for a wallet using only trade data available up to as_of_ts.

    If as_of_ts is None, uses current time (backward-compatible).
    All SQL queries include an upper bound: timestamp < as_of_ts (point-in-time).

    CTS v3 — Round-trip filter + ground-truth PnL:
    All PnL sub-scores are filtered to "round-trip" markets only — markets where the
    wallet has both BUY and SELL trades. This eliminates phantom sells from share
    minting and resolution payouts that the Activity API / Goldsky can't capture.
    The absolute_return sub-score uses Polymarket's lb-api ground-truth PnL
    (stored in wallets.polymarket_pnl) instead of our computed pnl_90d.
    """
    weights = CTS_CONF.get('weights', DEFAULT_CTS_CONFIG['weights'])
    lookback_weeks = CTS_CONF.get('lookback_weeks', 12)
    min_weeks = CTS_CONF.get('min_weeks_active', 4)
    min_trades = CTS_CONF.get('min_trades', DEFAULT_CTS_CONFIG['min_trades'])

    cursor = conn.cursor()
    now_ts = as_of_ts if as_of_ts is not None else int(time.time())
    lookback_start = now_ts - (lookback_weeks * 7 * 86400)

    # Round-trip markets: only markets where the wallet has both BUY and SELL within window.
    # This filters out phantom sells from share minting / resolution payouts.
    cursor.execute('''
        SELECT market_id FROM trades
        WHERE address = ? AND timestamp >= ? AND timestamp < ?
        GROUP BY market_id
        HAVING SUM(CASE WHEN side IN ('BUY','buy') THEN 1 ELSE 0 END) > 0
           AND SUM(CASE WHEN side IN ('SELL','sell') THEN 1 ELSE 0 END) > 0
    ''', (address, lookback_start, now_ts))
    rt_market_ids = [row[0] for row in cursor.fetchall()]

    # Gate: need at least 1 round-trip market to score
    if not rt_market_ids:
        return None

    rt_placeholders = ','.join('?' * len(rt_market_ids))

    cursor.execute('''
        SELECT COUNT(*), MIN(timestamp), MAX(timestamp)
        FROM trades WHERE address = ? AND timestamp >= ? AND timestamp < ?
          AND market_id IN ({})
    '''.format(rt_placeholders), (address, lookback_start, now_ts, *rt_market_ids))
    row = cursor.fetchone()
    trade_count = row[0] if row else 0
    min_ts = row[1] if row else None
    max_ts = row[2] if row else None

    if not trade_count or trade_count < min_trades or not min_ts or not max_ts:
        return None
    if (max_ts - min_ts) / (7 * 86400) < min_weeks:
        return None

    # Gate 3: Must have traded recently (no coasting on stale scores)
    recency_days = CTS_CONF.get('min_active_recency_days', 14)
    if max_ts < now_ts - (recency_days * 86400):
        return None

    # Gate 4: Require sufficient data quality (live scoring only, not historical snapshots)
    if as_of_ts is None:
        cursor.execute("SELECT ingestion_status FROM wallets WHERE address = ?", (address,))
        status_row = cursor.fetchone()
        if status_row and status_row[0] == 'partial':
            return None

    cursor.execute('''
        SELECT (timestamp - ?) / (7 * 86400) as week_num,
               SUM(CASE WHEN side IN ('SELL','sell') THEN usd_value ELSE -usd_value END) as weekly_pnl,
               COUNT(*) as cnt
        FROM trades WHERE address = ? AND timestamp >= ? AND timestamp < ?
          AND market_id IN ({})
        GROUP BY week_num ORDER BY week_num
    '''.format(rt_placeholders), (lookback_start, address, lookback_start, now_ts, *rt_market_ids))
    weekly_rows = cursor.fetchall()

    if len(weekly_rows) < min_weeks:
        return None

    weekly_pnls = [(r[0], r[1]) for r in weekly_rows]
    pnl_values = [p for _, p in weekly_pnls]

    # Magnitude-Weighted Consistency (profit factor)
    gross_profit = sum(p for p in pnl_values if p > 0)
    gross_loss = sum(abs(p) for p in pnl_values if p < 0)
    if gross_profit + gross_loss > 0:
        consistency_ratio = gross_profit / (gross_profit + gross_loss)
    else:
        consistency_ratio = 0.5
    consistency_score = consistency_ratio * 100
    profitable_weeks_ratio = sum(1 for p in pnl_values if p > 0) / len(pnl_values)

    # Risk-Adjusted (Sharpe)
    mean_pnl = sum(pnl_values) / len(pnl_values)
    variance = sum((p - mean_pnl) ** 2 for p in pnl_values) / max(1, len(pnl_values) - 1)
    stdev_pnl = math.sqrt(variance)
    sharpe_cap = CTS_CONF.get('sharpe_cap', 3.0)
    raw_sharpe = mean_pnl / stdev_pnl if stdev_pnl > 0 else 0
    clamped_sharpe = max(-sharpe_cap, min(sharpe_cap, raw_sharpe))
    risk_adjusted_score = ((clamped_sharpe + sharpe_cap) / (2 * sharpe_cap)) * 100

    # Recency
    half_life = CTS_CONF.get('decay_half_life_weeks', 4)
    decay_lambda = math.log(2) / half_life
    max_week = max(wn for wn, _ in weekly_pnls)
    weighted_pnl = 0
    weight_sum = 0
    for week_num, pnl in weekly_pnls:
        age_weeks = max_week - week_num
        w = math.exp(-decay_lambda * age_weeks)
        weighted_pnl += pnl * w
        weight_sum += abs(pnl) * w if abs(pnl) > 0 else w
    if weight_sum > 0:
        recency_score = ((weighted_pnl / weight_sum) + 1) / 2 * 100
    else:
        recency_score = 50

    # Size-Weighted Win Rate (round-trip markets only)
    cursor.execute('''
        SELECT market_id,
               SUM(CASE WHEN side IN ('BUY','buy') THEN usd_value ELSE 0 END) as bought,
               SUM(CASE WHEN side IN ('SELL','sell') THEN usd_value ELSE 0 END) as sold
        FROM trades WHERE address = ? AND timestamp >= ? AND timestamp < ?
          AND market_id IN ({})
        GROUP BY market_id HAVING sold > 0
    '''.format(rt_placeholders), (address, lookback_start, now_ts, *rt_market_ids))
    markets = cursor.fetchall()
    total_market_profit = sum(max(0, sold - bought) for _, bought, sold in markets)
    total_market_loss = sum(max(0, bought - sold) for _, bought, sold in markets)
    if total_market_profit + total_market_loss > 0:
        computed_win_rate = total_market_profit / (total_market_profit + total_market_loss)
    else:
        computed_win_rate = 0
    win_rate_score = computed_win_rate * 100

    # Max Drawdown (round-trip markets only)
    cursor.execute('''
        SELECT timestamp / 86400 as day,
               SUM(CASE WHEN side IN ('SELL','sell') THEN usd_value ELSE -usd_value END) as daily_pnl
        FROM trades WHERE address = ? AND timestamp >= ? AND timestamp < ?
          AND market_id IN ({})
        GROUP BY day ORDER BY day
    '''.format(rt_placeholders), (address, lookback_start, now_ts, *rt_market_ids))
    cumulative = 0
    peak = 0
    max_drawdown = 0
    for _, dpnl in cursor.fetchall():
        cumulative += dpnl
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > max_drawdown:
            max_drawdown = dd

    drawdown_pct = max_drawdown / peak if peak > 0 else (1.0 if max_drawdown > 0 else 0)
    severe_thresh = CTS_CONF.get('drawdown_severe_threshold', 0.50)
    moderate_thresh = CTS_CONF.get('drawdown_moderate_threshold', 0.25)
    if drawdown_pct <= moderate_thresh:
        drawdown_score = 100 - (drawdown_pct / moderate_thresh) * 30
    elif drawdown_pct <= severe_thresh:
        drawdown_score = 70 - ((drawdown_pct - moderate_thresh) / (severe_thresh - moderate_thresh)) * 50
    else:
        drawdown_score = max(0, 20 - ((drawdown_pct - severe_thresh) / severe_thresh) * 20)

    # Period P&L — round-trip markets only
    period_pnls = {}
    for label, days in [('pnl_7d', 7), ('pnl_30d', 30), ('pnl_90d', 90)]:
        cutoff = now_ts - (days * 86400)
        cursor.execute('''
            SELECT SUM(CASE WHEN side IN ('SELL','sell') THEN usd_value ELSE -usd_value END)
            FROM trades WHERE address = ? AND timestamp >= ? AND timestamp < ?
              AND market_id IN ({})
        '''.format(rt_placeholders), (address, cutoff, now_ts, *rt_market_ids))
        val = cursor.fetchone()[0]
        period_pnls[label] = val or 0

    # Absolute Return — uses Polymarket's ground-truth PnL from lb-api for live scoring;
    # falls back to computed pnl_90d for historical snapshots (polymarket_pnl is today's
    # value and is not point-in-time safe).
    # Negative PnL intentionally scores 0 — we don't penalize, just don't reward.
    abs_return_cap = CTS_CONF.get('absolute_return_cap', 50000)
    if as_of_ts is None:
        # Live scoring: use Polymarket's real all-time PnL
        cursor.execute("SELECT polymarket_pnl FROM wallets WHERE address = ?", (address,))
        pm_row = cursor.fetchone()
        effective_pnl = pm_row[0] if pm_row and pm_row[0] is not None else None
    else:
        # Historical snapshot: polymarket_pnl reflects today's value, not the snapshot date.
        # Use computed pnl_90d from the round-trip trades as the best available proxy.
        effective_pnl = period_pnls['pnl_90d'] if period_pnls['pnl_90d'] > 0 else None
    if effective_pnl is not None and effective_pnl > 0:
        absolute_return_score = min(100, math.log10(1 + effective_pnl) / math.log10(1 + abs_return_cap) * 100)
    else:
        absolute_return_score = 0

    # Composite
    composite = (
        consistency_score * weights.get('consistency', 0.20) +
        risk_adjusted_score * weights.get('risk_adjusted', 0.20) +
        recency_score * weights.get('recency_weighted', 0.15) +
        win_rate_score * weights.get('win_rate', 0.15) +
        drawdown_score * weights.get('drawdown', 0.10) +
        absolute_return_score * weights.get('absolute_return', 0.20)
    )
    cts = max(0, min(100, round(composite)))

    return {
        'copy_trading_score': cts,
        'cts_consistency': round(consistency_score, 2),
        'cts_risk_adjusted': round(risk_adjusted_score, 2),
        'cts_recency_pnl': round(recency_score, 2),
        'cts_win_rate': round(win_rate_score, 2),
        'cts_drawdown_score': round(drawdown_score, 2),
        'cts_absolute_return': round(absolute_return_score, 2),
        'pnl_7d': round(period_pnls['pnl_7d'], 2),
        'pnl_30d': round(period_pnls['pnl_30d'], 2),
        'pnl_90d': round(period_pnls['pnl_90d'], 2),
        'max_drawdown_pct': round(drawdown_pct, 4),
        'profitable_weeks_ratio': round(profitable_weeks_ratio, 4),
        'computed_win_rate': round(computed_win_rate, 4),
    }


def backfill():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute('PRAGMA journal_mode=WAL;')
    migrate_cts_columns(conn)

    cursor = conn.cursor()

    # Reset all existing CTS scores before recalculating.
    # Wallets that no longer pass the stricter v2 gates must not keep stale v1 scores.
    cursor.execute('''
        UPDATE wallets SET
            copy_trading_score = 0, cts_consistency = 0, cts_risk_adjusted = 0,
            cts_recency_pnl = 0, cts_win_rate = 0, cts_drawdown_score = 0,
            cts_absolute_return = 0, pnl_7d = 0, pnl_30d = 0, pnl_90d = 0,
            max_drawdown_pct = 0, profitable_weeks_ratio = 0,
            cts_last_calculated_at = NULL
        WHERE copy_trading_score > 0
    ''')
    reset_count = cursor.rowcount
    conn.commit()
    print(f"Reset {reset_count} stale CTS scores.")

    cursor.execute("SELECT DISTINCT address FROM trades")
    addresses = [row[0] for row in cursor.fetchall()]
    print(f"Found {len(addresses)} wallets with trades. Computing CTS...")

    scored = 0
    skipped = 0
    for i, addr in enumerate(addresses):
        result = calculate_cts(conn, addr)
        if result:
            cursor.execute('''
                UPDATE wallets SET
                    copy_trading_score = ?, cts_consistency = ?, cts_risk_adjusted = ?,
                    cts_recency_pnl = ?, cts_win_rate = ?, cts_drawdown_score = ?,
                    cts_absolute_return = ?,
                    pnl_7d = ?, pnl_30d = ?, pnl_90d = ?,
                    max_drawdown_pct = ?, profitable_weeks_ratio = ?,
                    cts_last_calculated_at = CURRENT_TIMESTAMP
                WHERE address = ?
            ''', (
                result['copy_trading_score'], result['cts_consistency'], result['cts_risk_adjusted'],
                result['cts_recency_pnl'], result['cts_win_rate'], result['cts_drawdown_score'],
                result['cts_absolute_return'],
                result['pnl_7d'], result['pnl_30d'], result['pnl_90d'],
                result['max_drawdown_pct'], result['profitable_weeks_ratio'],
                addr
            ))
            scored += 1
        else:
            skipped += 1

        if (i + 1) % 500 == 0:
            conn.commit()
            print(f"  Processed {i + 1}/{len(addresses)} (scored: {scored}, skipped: {skipped})")

    conn.commit()
    print(f"Done! Scored {scored} wallets, skipped {skipped} (insufficient data).")
    print("Run 'python3 sync_wallets.py' to push CTS data to Mission Control.")
    conn.close()


if __name__ == "__main__":
    backfill()
