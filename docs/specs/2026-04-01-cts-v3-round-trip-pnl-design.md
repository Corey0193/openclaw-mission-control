# CTS v3: Round-Trip Filter + Ground-Truth PnL

**Date:** 2026-04-01
**Status:** Approved
**Author:** cburroughs + Claude Code

## Problem Statement

CTS scores are computed from PnL data that includes "phantom" trades — markets where a
wallet shows sells with no corresponding buys. This happens because the Activity API and
Goldsky orderbook subgraph capture only orderbook fills, not share minting (CTF contract
`PositionSplit`) or resolution payouts (`PayoutRedemption`).

**Impact:** For wallet 0xda9b03, 33 of 39 markets have sells with zero buys, creating
$228K in phantom sell flow. Our computed PnL is +$325K; Polymarket's actual is -$4,271.

**Root cause:** The data sources we use (Activity API, Goldsky orderbook subgraph) are
structurally incomplete. They only see one side of many trades.

## Solution

Two changes, implemented together:

1. **Round-trip filter** — Only evaluate markets where we observe both BUY and SELL for the
   wallet. This discards phantom data entirely. Coverage drops but accuracy becomes 100%
   for the data we do score.

2. **Ground-truth PnL from Polymarket's lb-api** — Replace our computed `absolute_return`
   CTS sub-score with Polymarket's pre-calculated PnL via
   `GET https://lb-api.polymarket.com/profit?window=all&address=<WALLET>`. This gives us
   accurate absolute performance without needing to solve the minting/resolution data gap.

A future Phase 3 (The Graph CTF indexing) can close the data gap entirely, but is not
required for CTS accuracy after these two fixes.

## Architecture

### Current CTS Sub-Scores (v2)

| Sub-Score | Weight | Data Source |
|-----------|--------|-------------|
| Consistency (profit factor) | 0.20 | Weekly PnL from ALL trades |
| Risk-Adjusted (Sharpe) | 0.20 | Weekly PnL from ALL trades |
| Recency-Weighted PnL | 0.15 | Weekly PnL from ALL trades |
| Win Rate | 0.15 | Per-market bought/sold from ALL markets with sells |
| Max Drawdown | 0.10 | Daily PnL from ALL trades |
| Absolute Return | 0.20 | `log10(computed pnl_90d)` from ALL trades |

### New CTS Sub-Scores (v3)

| Sub-Score | Weight | Data Source | Change |
|-----------|--------|-------------|--------|
| Consistency (profit factor) | 0.20 | Weekly PnL from **round-trip markets** | Filtered |
| Risk-Adjusted (Sharpe) | 0.20 | Weekly PnL from **round-trip markets** | Filtered |
| Recency-Weighted PnL | 0.15 | Weekly PnL from **round-trip markets** | Filtered |
| Win Rate | 0.15 | Per-market bought/sold from **round-trip markets** | Filtered |
| Max Drawdown | 0.10 | Daily PnL from **round-trip markets** | Filtered |
| Absolute Return | 0.20 | **`log10(lb-api polymarket_pnl)`** | Replaced |

### Round-Trip Filter

A market qualifies as "round-trip" for a wallet if it contains at least one BUY and one
SELL trade. Implemented as a CTE prepended to each CTS SQL query:

```sql
WITH rt_markets AS (
    SELECT market_id FROM trades
    WHERE address = ? AND timestamp >= ? AND timestamp < ?
    GROUP BY market_id
    HAVING SUM(CASE WHEN side IN ('BUY','buy') THEN 1 ELSE 0 END) > 0
       AND SUM(CASE WHEN side IN ('SELL','sell') THEN 1 ELSE 0 END) > 0
)
```

All PnL queries add: `AND market_id IN (SELECT market_id FROM rt_markets)`

The win rate query already filters `HAVING sold > 0`; adding the round-trip constraint
additionally requires buys > 0, eliminating phantom-sell markets.

### Absolute Return Replacement

Current (v2):
```python
# Uses our computed pnl_90d (broken for resolution-heavy wallets)
absolute_return_score = min(100, log10(1 + pnl_90d) / log10(1 + 50000) * 100)
```

New (v3):
```python
# Uses Polymarket's pre-calculated PnL (ground truth)
polymarket_pnl = wallet's polymarket_pnl column (fetched from lb-api)
if polymarket_pnl and polymarket_pnl > 0:
    absolute_return_score = min(100, log10(1 + polymarket_pnl) / log10(1 + abs_return_cap) * 100)
else:
    absolute_return_score = 0
```

Wallets with negative real PnL get `absolute_return_score = 0`. This is intentional —
we don't want to copy-trade wallets that are losing money in absolute terms, even if their
round-trip orderbook trades show positive signal.

### Schema Changes

```sql
ALTER TABLE wallets ADD COLUMN polymarket_pnl REAL;
```

Single new column. No other schema changes needed (usd_value, source, ingestion_status
were added in the prior migration).

### Polymarket lb-api Integration

**Endpoint:** `GET https://lb-api.polymarket.com/profit?window=all&address=<WALLET>`

**Response:**
```json
[{
    "proxyWallet": "0x...",
    "amount": -4271.107497,
    "pseudonym": "...",
    "name": "..."
}]
```

**Valid windows:** `1d`, `7d`, `30d`, `all` (NOT `1w` or `1m`).

**Rate limits:** Unknown but appears generous. We batch with 0.3s sleep between requests.

**Library:** `polymarket-apis` v0.5.5 (installed in `~/.openclaw/venv/` with Python 3.12).
Provides `PolymarketDataClient.get_user_metric(address, metric='profit', window='all')`.

## Files Modified

| File | Location | Change |
|------|----------|--------|
| `backfill_cts.py` | `~/openclaw-mission-control/` | Round-trip CTE on 4 PnL queries; absolute_return uses polymarket_pnl; migrate polymarket_pnl column |
| `wallet_ingestor.py` | `~/.openclaw/workspace-radar/bin/` | Fetch lb-api PnL after classify; pass real PnL to Mission Control push |
| `wallet_heartbeat.py` | `~/.openclaw/workspace-radar/bin/` | Mirror: fetch lb-api PnL after classify |
| `market_scout.py` | `~/.openclaw/workspace-radar/bin/` | No change needed |
| **NEW** `fetch_polymarket_pnl.py` | `~/.openclaw/workspace-radar/bin/` | Batch backfill polymarket_pnl for scored wallets |
| `backfill_cts_snapshots.py` | `~/openclaw-mission-control/` | No code change — inherits calculate_cts() fix |
| `data.py` | `~/hustle-research-soft/copytrade/` | No change — operates on trade-level data |

## New Script: fetch_polymarket_pnl.py

Standalone batch script to populate `wallets.polymarket_pnl` for all wallets with
`ingestion_status != 'partial'` (or optionally all wallets).

```
Usage:
  python3 fetch_polymarket_pnl.py [--all] [--limit N]

Default: fetches PnL for wallets with copy_trading_score > 0
--all:   fetches for all non-partial wallets
--limit: cap number of API calls
```

Uses httpx directly (not the polymarket-apis library) so it runs on system Python 3.10
without the venv. The library is available in the venv for interactive research.

Per wallet: `GET lb-api.polymarket.com/profit?window=all&address=X`, extract `amount`,
write to `wallets.polymarket_pnl`. Sleep 0.3s between requests.

## Daemon Integration

After `classify_wallet()` completes for a wallet (in both the backfill loop and the
priority refresh loop), the daemon fetches lb-api PnL:

```python
def fetch_polymarket_pnl(address):
    url = f"https://lb-api.polymarket.com/profit?window=all&address={address}"
    data = api_request(url)
    if data and isinstance(data, list) and len(data) > 0:
        return data[0].get('amount')
    return None
```

The result is stored in `wallets.polymarket_pnl` and passed to `push_wallet_to_mission_control`
as the `totalPnl` field (replacing the old `wallets.pnl` which came from the leaderboard API
and was often stale or missing).

## Execution Plan

### Pre-flight
1. Write this design doc, git commit as restore point
2. Backup radar-intel.db

### Implementation
3. Schema migration: add `polymarket_pnl` column
4. Modify `calculate_cts()` in backfill_cts.py:
   - Add round-trip CTE to all 4 PnL queries
   - Replace absolute_return with polymarket_pnl lookup
5. Create `fetch_polymarket_pnl.py` batch script
6. Run batch PnL fetch for 338 scored wallets (~100s with 0.3s sleep)
7. Update `wallet_ingestor.py` daemon: add PnL fetch after classify
8. Update `wallet_heartbeat.py`: mirror PnL fetch
9. Recompute CTS: `python3 backfill_cts.py`
10. Rebuild CTS snapshots: `python3 backfill_cts_snapshots.py --force`
11. Sync to Mission Control: `python3 sync_wallets.py` (targeted, scored only)
12. Re-enable cron jobs (daily-cts-snapshot, wallet-watchdog)

### Validation
- `SELECT COUNT(*) FROM wallets WHERE polymarket_pnl IS NOT NULL` >= 338
- 0xda9b03: `polymarket_pnl` ~ -$4,271 (matching lb-api)
- 0xda9b03 CTS: should use only 6 round-trip markets (not 39)
- Top CTS wallets: `polymarket_pnl > 0` for most (losers should rank lower)
- CTS snapshots table populated: `SELECT COUNT(*) FROM cts_snapshots` > 0

## Phase 3 Roadmap: The Graph CTF Indexing (Deferred)

For complete PnL accuracy (mints, merges, redemptions), index on-chain CTF events:

**Data sources (validated):**
- The Graph "Polymarket Activity Polygon" subgraph (`Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp`)
- The Graph "Polymarket Profit & Loss" subgraph (`6c58N5U4MtQE2Y8njfVrrAfRykzfqajMGeTMEvMmskVz`)
- Requires free API key from The Graph Studio (100K queries/month free)

**Entities available:** `redemptions` (payout, redeemer, timestamp), `positions` (condition, outcomeIndex)

**Integration approach:**
1. Query redemptions per wallet from The Graph
2. Store in new `redemptions` table (id, address, market_id, payout, timestamp)
3. Incorporate redemption payouts into PnL calculation as synthetic "SELL" events
4. This would recover the 33 phantom-sell markets for wallets like 0xda9b03

**Not implemented now** — lb-api ground-truth PnL covers the absolute return need,
and the round-trip filter makes relative CTS scoring accurate. Phase 3 becomes valuable
if we need trade-level resolution data for the backtester.

## Dependencies

- Python 3.12 + venv at `~/.openclaw/venv/` (installed)
- `polymarket-apis` v0.5.5 (installed in venv, used for research/exploration)
- `httpx` (already used in all ingestion scripts)
- `lb-api.polymarket.com` (undocumented Polymarket API, confirmed working)
