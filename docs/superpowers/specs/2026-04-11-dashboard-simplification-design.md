# Dashboard Simplification: Two Focused Pages with Clear Roles

**Date:** 2026-04-11
**Status:** Draft
**Pages affected:** `/arb/soft` (SoftArbPage), `/arb/polymarket` (PolymarketPage)

## Problem

The Soft Arb and Polymarket pages both display Polymarket wallet/position data but through different lenses, with different calculations, and no explanation of how they relate. The Soft Arb page has 11 summary cards (4 showing subtly different wallet slices) and 6+ expandable sections. The Polymarket page shows no wallet balance at all. Users must mentally reconcile numbers across pages to answer basic questions like "how much money do I have?"

## Solution

Redefine each page with a single clear purpose and a shared wallet header that eliminates number discrepancies.

- **`/arb/soft`** = "Strategy Dashboard" — how is the soft arb strategy performing?
- **`/arb/polymarket`** = "Portfolio View" — what do I own and what's it worth?

## Shared Component: WalletSummary

A new component used at the top of both pages. Three cards:

| Card | Label | Value | Source |
|------|-------|-------|--------|
| 1 | Total Value | All assets (USDC + POL + open position equity) | Wallet snapshot + portfolio positions |
| 2 | Available Cash | USDC balances (Magic + Phantom) not locked in open positions | `deployable_bankroll_usd` from wallet snapshot |
| 3 | In Positions | Sum of current value of all open positions | Portfolio on-chain data |

- Single data source, single calculation — replaces the 4 different wallet cards on Soft Arb
- Small text line below cards showing last-updated timestamp
- POL balance shown as tooltip/subtitle on "Available Cash" only if > $1

## Soft Arb Page: Strategy Dashboard

Layout top to bottom:

### 1. Wallet Header
Shared `WalletSummary` component. Below it, subtle link: "Full portfolio view →" to `/arb/polymarket`.

### 2. Strategy Performance Cards (4 cards)
- **Unrealized P&L** — current open position gains/losses
- **Realized P&L** — closed trade gains/losses
- **Daily P&L** — today's performance (yesterday's as subtitle text)
- **Win Rate** — percentage with trade count as subtitle

### 3. Open Positions Table
Same columns as today: Opened, Market, Direction, Entry, Wallet, Edge, P&L. Signal family badges, trade kind, shield status retained. No changes.

### 4. Stale Open Trades
Same as today — shown inline below open positions when present. Amber styling with "RECONCILE" badge.

### 5. Pipeline Scan History (expandable)
Same as today — last 20 runs with verdict/decision badges, expandable dossier JSON.

### 6. Resolved Trades (expandable)
Last 10 resolved trades with WIN/LOSS badges and on-chain mismatch detection.

### 7. Calibration & Feedback (expandable, collapsed by default)
Same content as today — calibration families, edge thresholds, recommendations. Demoted to bottom of page.

### 8. Oracle Shield & Safety (expandable, collapsed by default)
Same content as today — watcher status, mapped assets, active alerts, learnings loop. Demoted to bottom of page.

### Removed from this page
- 4 wallet summary cards (replaced by shared WalletSummary)
- "Tracked Trades" card (count visible from table)
- "Avg Daily P&L" card (not daily-use)
- "Other Wallet Positions" section (moves to Polymarket page)
- Verbose wallet breakdown text line (replaced by timestamp)

**Net:** 11 summary cards → 4 performance + 3 wallet. 6+ sections → same sections but reordered by priority.

## Polymarket Page: Portfolio View

Layout top to bottom:

### 1. Wallet Header
Shared `WalletSummary` component. Below it, subtle link: "Strategy dashboard →" to `/arb/soft`.

### 2. Portfolio Summary Cards (3 cards)
- **Invested** — total cost basis across all positions
- **Current Value** — total current value of all positions
- **Total P&L** — sum of unrealized P&L (with +/- coloring)

### 3. Alert Banners (conditional)
- Orphaned trade warnings (red)
- Claimable payout notices (blue)
Shown above the table when present.

### 4. All Positions Table (unified)
Single table replacing the current 3 separate tables (open, manual, resolved).

**Columns:** Market, Outcome, Shares, Entry Price, Current Price, Value, P&L, Status

**Status badges:**
- **Soft Arb** (blue) — managed by strategy pipeline
- **Manual** (gray) — manually placed
- **Legacy** (dim gray) — old positions
- **Claimable** (green) — resolved, ready to claim
- **Resolved** (slate) — settled, no action needed

**Filter row:** All / Soft Arb / Manual / Resolved

Table is sortable.

### Removed from this page
- Source badge ("Live" / "Cached") — demoted to tooltip on wallet timestamp
- Separate manual and legacy tables — merged into unified table

**No pipeline metadata, no edge %, no signal families.** This page is the financial ledger.

## What stays the same
- All existing API endpoints (`/api/soft-arb/trades`, `/api/portfolio`)
- Data fetching hooks (`useSoftArbTrades`, `usePortfolio`)
- Pipeline run card component
- Alert detection logic
- Polling intervals (30s)

## Out of scope
- No new `/arb/health` route
- No changes to backend Python scripts or API handlers
- No changes to other arb routes (pipeline, experiments, wallets)
