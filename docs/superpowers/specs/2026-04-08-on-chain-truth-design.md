# On-Chain Truth: Position Data Integrity Redesign

**Date:** 2026-04-08
**Status:** Approved
**Problem:** Mission Control shows position data from two parallel sources (Convex cloud DB + flat JSONL files) that diverge from on-chain reality. Trades executed on Polymarket can be missing from local records, resolved positions go unclaimed, and merge conflicts are silent.

## Architecture

Replace the dual-source merge with a single pipeline: Polymarket Data API is the source of truth for all position state. JSONL files are demoted to metadata-only (pipeline context). Convex remains as a fallback during transition.

```
Polymarket Data API (source of truth)
        |
        v
/api/portfolio (Vite middleware)
        |
        +-- reads JSONL files for pipeline metadata
        |
        +-- falls back to Convex on API failure
        |
        v
Unified response -> both pages
```

## Section 1: API Endpoint & Data Fetching

New Vite middleware endpoint: `GET /api/portfolio`

**Server-side flow:**
1. Fetch Polymarket Data API:
   - `GET /positions?user={wallet}&sizeThreshold=0&limit=500`
   - `GET /trades?user={wallet}&limit=500` (filtered to last 30 days)
2. Read pipeline JSONL files:
   - `soft-arb-live-trades.jsonl`
   - `soft-arb-paper-trades.jsonl`
   - `outcome-tracking.jsonl`
3. Join by `slug + outcome` (with `conditionId` as secondary key)
4. Return unified response

**Why server-side:** Avoids CORS, caches the Polymarket response for the 30s polling window so both pages share one API call, keeps wallet address out of the browser.

**Fallback:** If Polymarket API returns non-200 or times out (10s), fall back to Convex (`polymarket:getPositions` HTTP query). Response includes `source: "polymarket-api" | "convex-fallback"` field.

**Caching:** Polymarket API response cached in-memory for 30 seconds. Multiple frontend polls within the window return the cached result without re-fetching.

## Section 2: Join Logic & Position Classification

**Join key:** `slug + outcome`.

The Polymarket Data API positions response includes a `slug` field (e.g., `nhl-tb-ott-2026-04-07`). JSONL files store `polymarket_slug` in the same format. Outcome mapping: JSONL `direction: "BUY_YES"` → `outcome: "Yes"`, `"BUY_NO"` → `"No"`. For sports markets with named outcomes (e.g., `"Lightning"`), the JSONL `direction` encodes the team name — the middleware normalizes both sides before matching.

Secondary join by `conditionId` when available (the API always returns it; JSONL does not store it currently but `order_id` can be cross-referenced against the trades endpoint if needed).

### Categories

| Category | On-chain? | Pipeline JSONL? | Display |
|----------|-----------|-----------------|---------|
| **Tracked** | Yes | Yes | Full view: on-chain position data + pipeline context (edge %, verdict, opportunity ID) |
| **Manual/Legacy** | Yes | No | Position data from chain, labeled "Manual" |
| **Orphaned** | No | Yes (status OPEN) | Warning: pipeline thinks open, nothing on-chain |

### Data ownership

**From Polymarket API:** shares, avgPrice, currentPrice, currentValue, unrealizedPnl, resolved status, redeemable flag.

**From JSONL:** trade_id, opportunity_id, edge_pct, thorp_verdict, paper_or_live, entry_timestamp, evidence_source, notes.

**Resolved positions:** On-chain positions with `curPrice: 0` and `redeemable: true` get distinct status. Matched pipeline trades show realized PnL. Unmatched legacy positions show loss amount and "Claim" indicator.

## Section 3: Frontend Changes

Both pages switch to consuming `/api/portfolio` via a shared `usePortfolio()` hook. Current dual-fetch + merge logic removed.

### PolymarketPage (full portfolio view)
- All wallet positions in one table, grouped: Tracked / Manual / Legacy
- Position data always from on-chain
- Pipeline metadata shown as expandable detail
- Manual trades appear automatically
- Redeemable positions in distinct section with claim status

### SoftArbPage (pipeline performance view)
- Filters to Tracked positions only (has pipeline metadata)
- Summary stats, calibration, win rates computed from on-chain PnL (not JSONL-derived)
- Paper trades unchanged (no on-chain data)
- "Orphaned" warning section if pipeline trades have no on-chain match

### Shared UI elements
- Source badge: "Live" (green) for Polymarket API, "Cached" (yellow) on Convex fallback
- `lastFetchedAt` timestamp in footer
- 30-second polling interval (unchanged)
- Oracle shield, calibration, discovery sections on SoftArbPage unaffected (read from separate files)

## Section 4: Convex Fallback & Migration Path

### During transition (this build)
- Convex 5-minute sync cron keeps running, untouched
- `/api/portfolio` tries Polymarket API first, falls back to Convex on failure
- Both pages consume `/api/portfolio` only — no direct Convex queries from frontend
- Convex accessed only by middleware fallback, never by browser

### Fallback trigger
- Polymarket API returns non-200, or request times out (10s)
- Middleware reads from Convex via existing HTTP query
- Response tagged `source: "convex-fallback"`
- Pipeline metadata overlay still applied regardless of position source

### Future removal (not in this build)
- After weeks of stable direct API operation, remove Convex fallback branch and cron
- No frontend changes needed — pages only see `/api/portfolio`
- If Convex is used by other Mission Control pages, those are unaffected

## Section 5: Discrepancy Detection & Alerting

Built into every `/api/portfolio` response, not a separate system.

### Checks

| Check | Condition | Severity |
|-------|-----------|----------|
| **Orphaned trade** | Pipeline JSONL has OPEN trade, no on-chain position | High |
| **Stale data** | Last successful Polymarket API fetch > 5 min ago | Medium |
| **Unclaimed payouts** | On-chain position resolved + redeemable | Low |
| **Share mismatch** | Pipeline logged X shares, on-chain shows Y | Medium |

### Response shape

```json
{
  "source": "polymarket-api",
  "fetchedAt": "2026-04-08T12:00:00Z",
  "positions": [
    {
      "conditionId": "0x...",
      "outcome": "YES",
      "category": "tracked",
      "onChain": {
        "shares": 64.37,
        "avgPrice": 0.42,
        "currentPrice": 0.425,
        "currentValue": 27.36,
        "unrealizedPnl": 0.32,
        "resolved": false,
        "redeemable": false
      },
      "pipeline": {
        "tradeId": "live-030",
        "opportunityId": "scan-metaculus-2026-04-06",
        "edgePct": 12.3,
        "thorpVerdict": "TRADEABLE",
        "paperOrLive": "live",
        "entryTimestamp": "2026-04-06T14:30:00Z"
      }
    },
    {
      "conditionId": "0x1c373746...",
      "outcome": "YES",
      "category": "manual",
      "onChain": { "shares": 8710.03, "avgPrice": 0.0246, "..." : "..." },
      "pipeline": null
    }
  ],
  "paperTrades": [],
  "alerts": [
    { "type": "orphaned_trade", "tradeId": "live-019", "message": "Pipeline trade OPEN but no on-chain position" },
    { "type": "unclaimed_payout", "conditionId": "0x7f5459af...", "amountUsd": 4.48 }
  ]
}
```

Every 30-second poll is a mini-reconciliation. No separate daemon needed.

## Files to Modify

**New:**
- `src/lib/usePortfolio.ts` — shared hook for `/api/portfolio`
- `src/types/portfolio.ts` — TypeScript types for unified response

**Modify:**
- `vite.config.ts` — new `/api/portfolio` middleware handler
- `src/pages/PolymarketPage.tsx` — consume `usePortfolio()`, remove Convex direct queries and merge logic
- `src/pages/SoftArbPage.tsx` — consume `usePortfolio()`, remove dual-fetch, add orphaned section

**Untouched:**
- `convex/polymarket.ts` — keeps syncing as fallback
- `convex/polymarketActions.ts` — keeps syncing as fallback
- `convex/crons.ts` — keeps running
- All JSONL files — pipeline keeps writing as before
- Oracle shield, calibration, discovery files and UI sections
