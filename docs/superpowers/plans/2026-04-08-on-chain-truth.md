# On-Chain Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mission Control's dual-source position merge (Convex + JSONL) with Polymarket Data API as the single source of truth, JSONL files as metadata overlay, and built-in discrepancy detection — while keeping Convex as a silent fallback.

**Architecture:** A new `portfolioPlugin()` in `vite.config.ts` serves `GET /api/portfolio`. It fetches positions from the Polymarket Data API, reads `soft-arb-live-trades.jsonl` for pipeline context using the already-existing `buildMergedLedgerRows()` and `readJsonlSafe()` helpers, joins them by `polymarket_slug`, classifies each position as `tracked | manual | legacy`, and emits an alerts array. If the Polymarket API fails it falls back to Convex. Both `PolymarketPage` and `SoftArbPage` switch to a new `usePortfolio()` hook; `SoftArbPage` keeps its existing `useSoftArbTrades()` hook for pipeline-only data (calibration, shield, discovery).

**Tech Stack:** TypeScript 5.9, React 19, Vite 7, Node.js fetch (global in Node 22), no new dependencies.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/types/portfolio.ts` | Shared TypeScript types for `/api/portfolio` response |
| Create | `src/lib/usePortfolio.ts` | React hook — polls `/api/portfolio` every 30s |
| Modify | `vite.config.ts` | Add `portfolioPlugin()` (~150 lines) before `export default` |
| Modify | `src/pages/PolymarketPage.tsx` | Consume `usePortfolio()`, replace merge, add category groups + alerts |
| Modify | `src/pages/SoftArbPage.tsx` | Consume `usePortfolio()` for positions, drop `useConvexHttpQuery`, add orphaned section |

**Untouched:** `convex/`, all JSONL pipeline files, `useSoftArbTrades()` hook, oracle shield / calibration / discovery UI sections.

---

## Task 1: TypeScript Types

**Files:**
- Create: `src/types/portfolio.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/types/portfolio.ts

export type PositionCategory = "tracked" | "manual" | "legacy";
export type PortfolioSource = "polymarket-api" | "convex-fallback";
export type AlertType =
  | "orphaned_trade"
  | "unclaimed_payout"
  | "share_mismatch"
  | "stale_data";

export interface OnChainPosition {
  conditionId: string;
  slug: string;
  eventSlug: string;
  title: string;
  /** Exact string from API: "Yes", "No", or team name e.g. "Lightning" */
  outcome: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  initialValue: number;
  unrealizedPnl: number;
  resolved: boolean;
  redeemable: boolean;
  endDate: string | null;
}

export interface PipelineMetadata {
  tradeId: string;
  opportunityId: string | null;
  signalFamily: string | null;
  edgePct: number | null;
  /** "BUY_YES" | "BUY_NO" */
  direction: string;
  entryPrice: number | null;
  positionSizeUsd: number;
  /** Shares as recorded at trade entry — may differ from on-chain if fills partial */
  loggedShares: number;
  entryTimestamp: string | null;
  orderId: string | null;
  paperOrLive: "paper" | "live";
}

export interface PortfolioPosition {
  slug: string;
  title: string;
  outcome: string;
  category: PositionCategory;
  onChain: OnChainPosition;
  /** null for manual/legacy positions */
  pipeline: PipelineMetadata | null;
}

export interface PortfolioAlert {
  type: AlertType;
  message: string;
  tradeId?: string;
  slug?: string;
  amountUsd?: number;
  shareMismatch?: { pipeline: number; onChain: number };
}

export interface PortfolioResponse {
  source: PortfolioSource;
  fetchedAt: string;
  positions: PortfolioPosition[];
  alerts: PortfolioAlert[];
}
```

- [ ] **Step 2: Verify TypeScript sees the file**

```bash
cd ~/openclaw-mission-control
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors (file is types-only, nothing can break yet).

- [ ] **Step 3: Commit**

```bash
git add src/types/portfolio.ts
git commit -m "feat: add portfolio response TypeScript types"
```

---

## Task 2: `/api/portfolio` Vite Plugin

**Files:**
- Modify: `vite.config.ts` (insert ~150 lines before line 1875 `export default defineConfig`)

The existing `readJsonlSafe()` and `buildMergedLedgerRows()` functions are already in `vite.config.ts` — we reuse them directly. The existing path constants `SOFT_ARB_LIVE_TRADES_PATH` and `SOFT_ARB_TRADES_PATH` are already defined.

- [ ] **Step 1: Add the Polymarket API types and cache (insert before `export default defineConfig` at line 1875)**

Find the line `export default defineConfig({` in `vite.config.ts` and insert the following block immediately before it:

```typescript
// ─── Portfolio Plugin ────────────────────────────────────────────────────────

interface PolymarketApiRawPosition {
  conditionId: string;
  slug: string;
  eventSlug: string;
  title: string;
  outcome: string;
  outcomeIndex: number;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  initialValue: number;
  cashPnl: number;
  redeemable: boolean;
  endDate: string | null;
}

interface PolymarketApiRawTrade {
  transactionHash: string;
  timestamp: number;
  side: string;
  title: string;
  slug: string;
  outcome: string;
  size: number;
  price: number;
}

const WALLET_PATH = path.join(os.homedir(), ".polymarket/wallet.json");
const PORTFOLIO_CACHE_TTL_MS = 30_000;
const POLYMARKET_API_TIMEOUT_MS = 10_000;

let _portfolioCache: {
  data: { positions: PolymarketApiRawPosition[]; trades: PolymarketApiRawTrade[] };
  expiresAt: number;
} | null = null;

function _readWalletAddress(): string {
  const raw = fs.readFileSync(WALLET_PATH, "utf-8");
  const wallet = JSON.parse(raw) as { address: string };
  return wallet.address;
}

async function _fetchPolymarketApi(): Promise<{
  positions: PolymarketApiRawPosition[];
  trades: PolymarketApiRawTrade[];
}> {
  const now = Date.now();
  if (_portfolioCache && _portfolioCache.expiresAt > now) {
    return _portfolioCache.data;
  }
  const walletAddress = _readWalletAddress();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), POLYMARKET_API_TIMEOUT_MS);
  try {
    const [posRes, tradesRes] = await Promise.all([
      fetch(
        `https://data-api.polymarket.com/positions?user=${walletAddress}&sizeThreshold=0&limit=500`,
        { signal: controller.signal },
      ),
      fetch(
        `https://data-api.polymarket.com/trades?user=${walletAddress}&limit=500`,
        { signal: controller.signal },
      ),
    ]);
    clearTimeout(timeout);
    if (!posRes.ok || !tradesRes.ok) {
      throw new Error(
        `Polymarket API error: positions=${posRes.status} trades=${tradesRes.status}`,
      );
    }
    const positions = (await posRes.json()) as PolymarketApiRawPosition[];
    const trades = (await tradesRes.json()) as PolymarketApiRawTrade[];
    const data = { positions, trades };
    _portfolioCache = { data, expiresAt: now + PORTFOLIO_CACHE_TTL_MS };
    return data;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
```

- [ ] **Step 2: Add Convex fallback helper (append immediately after the block from Step 1)**

```typescript
interface ConvexPositionRecord {
  market: string;
  marketQuestion: string;
  marketSlug: string;
  outcome: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  costBasis: number;
  currentValue: number;
  unrealizedPnl: number;
  marketResolved: boolean;
}

async function _fetchConvexPositions(
  convexUrl: string,
): Promise<PolymarketApiRawPosition[]> {
  const res = await fetch(`${convexUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "polymarket:getPositions",
      args: { tenantId: "default" },
    }),
  });
  if (!res.ok) throw new Error(`Convex query failed: ${res.status}`);
  const payload = (await res.json()) as {
    status: string;
    value: { positions: ConvexPositionRecord[] };
  };
  if (payload.status !== "success") throw new Error("Convex query error status");
  return payload.value.positions.map((p) => ({
    conditionId: p.market,
    slug: p.marketSlug,
    eventSlug: p.marketSlug,
    title: p.marketQuestion,
    outcome: p.outcome,
    outcomeIndex: 0,
    size: p.shares,
    avgPrice: p.entryPrice,
    curPrice: p.currentPrice,
    currentValue: p.currentValue,
    initialValue: p.costBasis,
    cashPnl: p.unrealizedPnl,
    redeemable: p.marketResolved && p.currentPrice === 0,
    endDate: null,
  }));
}
```

- [ ] **Step 3: Add join + classify + alerts logic (append immediately after Step 2)**

```typescript
type PipelineLiveRecord = Record<string, unknown> & {
  trade_id?: string;
  opportunity_id?: string;
  signal_family?: string;
  polymarket_slug?: string;
  direction?: string;
  entry_price?: number | null;
  position_size_usd?: number;
  shares?: number;
  edge_pct?: number | null;
  executed_at?: string | null;
  order_id?: string | null;
  status?: string;
};

const OPEN_PIPELINE_STATUSES = new Set([
  "OPEN",
  "POSTED",
  "PARTIAL_FILL",
  "FILLED",
  "PAYOUT_CLAIMABLE",
  "ORDER_PENDING",
]);

function _readPipelineBySlug(): Map<string, PipelineLiveRecord> {
  // Reuse the already-defined readJsonlSafe + buildMergedLedgerRows helpers.
  const rawRows = readJsonlSafe(SOFT_ARB_LIVE_TRADES_PATH) as PipelineLiveRecord[];
  const merged = buildMergedLedgerRows(rawRows, "live");
  const bySlug = new Map<string, PipelineLiveRecord>();
  for (const row of merged.values()) {
    const slug = row.polymarket_slug as string | undefined;
    if (slug) bySlug.set(slug, row);
  }
  return bySlug;
}

function _buildPortfolioResponse(
  onChainPositions: PolymarketApiRawPosition[],
  source: "polymarket-api" | "convex-fallback",
): import("./src/types/portfolio").PortfolioResponse {
  const pipeline = _readPipelineBySlug();
  const alerts: import("./src/types/portfolio").PortfolioAlert[] = [];

  // Build positions
  const positions: import("./src/types/portfolio").PortfolioPosition[] = onChainPositions.map(
    (p) => {
      const pipelineRow = pipeline.get(p.slug) ?? pipeline.get(p.eventSlug);
      let category: import("./src/types/portfolio").PositionCategory = "manual";
      let pipelineMeta: import("./src/types/portfolio").PipelineMetadata | null = null;

      if (pipelineRow) {
        category = p.redeemable ? "legacy" : "tracked";
        pipelineMeta = {
          tradeId: String(pipelineRow.trade_id ?? ""),
          opportunityId: (pipelineRow.opportunity_id as string) ?? null,
          signalFamily: (pipelineRow.signal_family as string) ?? null,
          edgePct: (pipelineRow.edge_pct as number) ?? null,
          direction: String(pipelineRow.direction ?? "BUY_YES"),
          entryPrice: (pipelineRow.entry_price as number) ?? null,
          positionSizeUsd: Number(pipelineRow.position_size_usd ?? 0),
          loggedShares: Number(pipelineRow.shares ?? 0),
          entryTimestamp: (pipelineRow.executed_at as string) ?? null,
          orderId: (pipelineRow.order_id as string) ?? null,
          paperOrLive: "live",
        };

        // Share mismatch alert (>5% difference)
        const loggedShares = Number(pipelineRow.shares ?? 0);
        if (loggedShares > 0 && Math.abs(p.size - loggedShares) / loggedShares > 0.05) {
          alerts.push({
            type: "share_mismatch",
            slug: p.slug,
            message: `Pipeline logged ${loggedShares.toFixed(2)} shares, on-chain has ${p.size.toFixed(2)}`,
            shareMismatch: { pipeline: loggedShares, onChain: p.size },
          });
        }

        // Remove from pipeline map so we can detect orphans
        pipeline.delete(p.slug);
        pipeline.delete(p.eventSlug);
      } else if (p.redeemable) {
        category = "legacy";
      }

      // Unclaimed payout alert
      if (p.redeemable && p.initialValue > 0) {
        alerts.push({
          type: "unclaimed_payout",
          slug: p.slug,
          message: `${p.title} — ${p.outcome} resolved. Claimable: $${p.initialValue.toFixed(2)}`,
          amountUsd: p.initialValue,
        });
      }

      return {
        slug: p.slug,
        title: p.title,
        outcome: p.outcome,
        category,
        onChain: {
          conditionId: p.conditionId,
          slug: p.slug,
          eventSlug: p.eventSlug,
          title: p.title,
          outcome: p.outcome,
          shares: p.size,
          avgPrice: p.avgPrice,
          currentPrice: p.curPrice,
          currentValue: p.currentValue,
          initialValue: p.initialValue,
          unrealizedPnl: p.cashPnl,
          resolved: p.redeemable,
          redeemable: p.redeemable,
          endDate: p.endDate,
        },
        pipeline: pipelineMeta,
      };
    },
  );

  // Orphaned pipeline records (still in map = no on-chain match)
  for (const [slug, row] of pipeline) {
    const status = String(row.status ?? "").toUpperCase();
    if (OPEN_PIPELINE_STATUSES.has(status)) {
      alerts.push({
        type: "orphaned_trade",
        tradeId: String(row.trade_id ?? ""),
        slug,
        message: `Pipeline trade ${String(row.trade_id ?? slug)} is ${status} but no on-chain position found`,
      });
    }
  }

  return {
    source,
    fetchedAt: new Date().toISOString(),
    positions,
    alerts,
  };
}
```

- [ ] **Step 4: Add the plugin function and register it (append after Step 3, then add to plugins array)**

Append after Step 3:

```typescript
function portfolioPlugin() {
  return {
    name: "portfolio",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use(
        (
          req: import("http").IncomingMessage,
          res: import("http").ServerResponse,
          next: () => void,
        ) => {
          const url = (req.url ?? "/").split("?")[0];
          if (req.method !== "GET" || url !== "/api/portfolio") {
            next();
            return;
          }
          void (async () => {
            try {
              let rawPositions: PolymarketApiRawPosition[];
              let source: "polymarket-api" | "convex-fallback";
              try {
                const apiData = await _fetchPolymarketApi();
                rawPositions = apiData.positions;
                source = "polymarket-api";
              } catch (apiErr) {
                console.warn("[portfolio] Polymarket API failed, falling back to Convex:", apiErr);
                const convexUrl = server.config.env["VITE_CONVEX_URL"] ?? "";
                rawPositions = await _fetchConvexPositions(convexUrl);
                source = "convex-fallback";
              }
              const body = _buildPortfolioResponse(rawPositions, source);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(body));
            } catch (err) {
              console.error("[portfolio] handler error:", err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "portfolio fetch failed" }));
            }
          })();
        },
      );
    },
  };
}
```

Then register in the plugins array inside `export default defineConfig({ plugins: [ ... ] })`. Add `portfolioPlugin()` on the line after `softArbTradesPlugin()`:

```typescript
// in the plugins array, after softArbTradesPlugin():
portfolioPlugin(),
```

- [ ] **Step 5: Typecheck and smoke test**

```bash
cd ~/openclaw-mission-control
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

Start the dev server and curl the endpoint:

```bash
npm run dev &
sleep 3
curl -s http://localhost:5173/api/portfolio | python3 -m json.tool | head -60
```

Expected: JSON with `source`, `fetchedAt`, `positions` array, `alerts` array. No 500 error.

Kill the dev server: `kill %1`

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add /api/portfolio endpoint with on-chain truth + Convex fallback"
```

---

## Task 3: `usePortfolio` Hook

**Files:**
- Create: `src/lib/usePortfolio.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/lib/usePortfolio.ts
import { useCallback, useEffect, useState } from "react";
import type { PortfolioResponse } from "../types/portfolio";

const DEFAULT_POLL_MS = 30_000;

export function usePortfolio(options?: { pollMs?: number }): {
  data: PortfolioResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error(`portfolio request failed (${res.status})`);
      const json = (await res.json()) as PortfolioResponse;
      setData(json);
    } catch (err) {
      console.error("[usePortfolio] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(interval);
  }, [refresh, pollMs]);

  return { data, loading, refresh };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd ~/openclaw-mission-control
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/usePortfolio.ts
git commit -m "feat: add usePortfolio hook polling /api/portfolio"
```

---

## Task 4: Update PolymarketPage

**Files:**
- Modify: `src/pages/PolymarketPage.tsx`

`PolymarketPage` currently dual-fetches: `useConvexHttpQuery("polymarket:getPositions")` and `/api/soft-arb/trades` (via its own inline hook). We replace both with `usePortfolio()`. The page groups positions into three panels: Tracked (pipeline trades), Manual, and Legacy (resolved/redeemable).

- [ ] **Step 1: Add `usePortfolio` import and replace data fetching**

Find the existing imports block at the top of `PolymarketPage.tsx`. Add:

```typescript
import { usePortfolio } from "../lib/usePortfolio";
import type { PortfolioPosition, PortfolioAlert } from "../types/portfolio";
```

Remove these two import lines (they will no longer be used by this page after the refactor):
```typescript
import { useConvexHttpQuery } from "../lib/useConvexHttpQuery";
```

And remove the `DEFAULT_TENANT_ID` import if it is only used for the Convex query (check — if it's used elsewhere, keep it).

- [ ] **Step 2: Replace the data-fetching hooks in the component body**

In the `PolymarketPage` function body, find and remove:
- The `useConvexHttpQuery` call (assigns to `convexSnapshot`)
- The existing inline hook or `useSoftArbTrades` call that fetches soft-arb data for this page

Replace them with:
```typescript
const { data: portfolio, loading, refresh } = usePortfolio();
```

- [ ] **Step 3: Replace position-derived state with portfolio categories**

Remove the existing `openPositions`, `closedMarkets`, `recentTrades`, and `openOrders` useMemo blocks that merge Convex + soft-arb data.

Add:

```typescript
const trackedPositions = useMemo(
  () => (portfolio?.positions ?? []).filter((p) => p.category === "tracked"),
  [portfolio],
);

const manualPositions = useMemo(
  () => (portfolio?.positions ?? []).filter((p) => p.category === "manual"),
  [portfolio],
);

const legacyPositions = useMemo(
  () => (portfolio?.positions ?? []).filter((p) => p.category === "legacy"),
  [portfolio],
);

const highAlerts = useMemo(
  () => (portfolio?.alerts ?? []).filter((a) => a.type === "orphaned_trade"),
  [portfolio],
);

const claimableAlerts = useMemo(
  () => (portfolio?.alerts ?? []).filter((a) => a.type === "unclaimed_payout"),
  [portfolio],
);
```

- [ ] **Step 4: Add source badge and alerts section to JSX**

Near the top of the returned JSX (just after the `<Header />` component), add:

```tsx
{/* Source badge */}
<div className="flex items-center gap-2 px-4 py-1 text-xs">
  <span
    className={`rounded-full px-2 py-0.5 font-mono ${
      portfolio?.source === "polymarket-api"
        ? "bg-green-900 text-green-300"
        : "bg-yellow-900 text-yellow-300"
    }`}
  >
    {portfolio?.source === "polymarket-api" ? "Live" : "Cached"}
  </span>
  {portfolio?.fetchedAt && (
    <span className="text-gray-500">
      {new Date(portfolio.fetchedAt).toLocaleTimeString()}
    </span>
  )}
</div>

{/* Orphaned trade alerts */}
{highAlerts.length > 0 && (
  <div className="mx-4 mb-4 rounded border border-red-700 bg-red-950 p-3">
    <p className="mb-1 text-sm font-semibold text-red-400">
      Pipeline Tracking Errors ({highAlerts.length})
    </p>
    {highAlerts.map((a) => (
      <p key={a.tradeId ?? a.slug} className="text-xs text-red-300">
        {a.message}
      </p>
    ))}
  </div>
)}
```

- [ ] **Step 5: Update position rendering to use the new structure**

Where positions are rendered (the existing table/card rows), update each position reference:

- `position.shares` → `position.onChain.shares`
- `position.entryPrice` → `position.onChain.avgPrice`
- `position.currentPrice` → `position.onChain.currentPrice`
- `position.currentValue` → `position.onChain.currentValue`
- `position.unrealizedPnl` → `position.onChain.unrealizedPnl`
- `position.marketQuestion` → `position.title`
- `position.marketSlug` → `position.slug`
- `position.marketResolved` → `position.onChain.resolved`

For pipeline-specific fields (edge %, opportunity ID), access via `position.pipeline?.edgePct` etc. — guard with `?` since manual/legacy positions have `pipeline: null`.

Add a section header and render all three groups — tracked, manual, legacy — in sequence. For legacy positions add a "Claim" label next to the payout amount.

- [ ] **Step 6: Typecheck and manual verify**

```bash
cd ~/openclaw-mission-control
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

Start dev server, navigate to `http://localhost:5173/arb/polymarket`:
- Should see positions grouped with source badge
- Piastri F1 should appear under "Manual" category
- Capitals/Maple Leafs and Sabres/Rangers under "Tracked" (if pipeline records match)
- 8 legacy positions in "Legacy" section with "Claim" labels
- Any orphaned pipeline trades in the red alert box

- [ ] **Step 7: Commit**

```bash
git add src/pages/PolymarketPage.tsx
git commit -m "feat: PolymarketPage uses on-chain truth via usePortfolio"
```

---

## Task 5: Update SoftArbPage

**Files:**
- Modify: `src/pages/SoftArbPage.tsx`

`SoftArbPage` keeps `useSoftArbTrades()` for calibration, shield, discovery, and summary stats. We add `usePortfolio()` for position state and remove the direct `useConvexHttpQuery` call. The `polymarketData` derived state that maps JSONL trades to positions is removed; we use `portfolio.positions` instead. An "Orphaned" alert banner appears at the top if any pipeline trades have no on-chain match.

- [ ] **Step 1: Add import and hook call**

Add to the imports at the top:

```typescript
import { usePortfolio } from "../lib/usePortfolio";
import type { PortfolioPosition } from "../types/portfolio";
```

Remove:
```typescript
import { useConvexHttpQuery } from "../lib/useConvexHttpQuery";
```

In the `SoftArbPage` function body, find the `useConvexHttpQuery` call and the `const convexSnapshot = ...` line — remove them both.

Add after the existing `useSoftArbTrades()` call:
```typescript
const { data: portfolio, refresh: refreshPortfolio } = usePortfolio();
```

- [ ] **Step 2: Remove the derived `polymarketData` memo**

Find and delete the `polymarketData` useMemo block (currently around lines 640–730). It maps `softArbData.trades` to fake position objects for Convex matching — this is no longer needed since `usePortfolio()` gives us real on-chain positions.

- [ ] **Step 3: Replace `activePositions` memo**

Find the `activePositions` useMemo block (currently around lines 729–773). Replace its implementation:

```typescript
const activePositions = useMemo(() => {
  // Use tracked positions from on-chain truth.
  // Fall back to softArbData trades if portfolio not yet loaded.
  if (portfolio) {
    return portfolio.positions
      .filter((p) => p.category === "tracked" && !p.onChain.resolved)
      .map((p) => ({
        // Preserve SoftArbTrade shape for downstream UI compatibility
        trade_id: p.pipeline?.tradeId ?? p.slug,
        pair: p.title,
        polymarket_slug: p.slug,
        event_slug: p.slug,
        direction: p.pipeline?.direction ?? "BUY_YES",
        entry_price: p.pipeline?.entryPrice ?? p.onChain.avgPrice,
        position_size_usd: p.pipeline?.positionSizeUsd ?? p.onChain.initialValue,
        shares: p.onChain.shares,
        edge_pct: null,
        adjusted_edge_pct: p.pipeline?.edgePct ?? 0,
        opened_at: p.pipeline?.entryTimestamp ?? "",
        resolves_by: p.onChain.endDate ?? "",
        status: "FILLED",
        current_price: p.onChain.currentPrice,
        unrealized_pnl: p.onChain.unrealizedPnl,
        realized_pnl: null,
        shadow_pnl: null,
        ready_to_close: false,
        fair_value: null,
        exit_price: null,
        resolved_outcome: null,
        is_real: true,
        order_id: p.pipeline?.orderId ?? null,
        shield_coin: null,
        shield_state: null,
        shield_reason: null,
        shield_updated_at: null,
        // New fields for UI
        actual_shares: p.onChain.shares,
        actual_pnl: p.onChain.unrealizedPnl,
        display_pnl: p.onChain.unrealizedPnl,
        expired: false,
        tradeUrlSlug: p.slug,
        actual_status: "POSITION" as const,
        onChain: p.onChain,
        pipeline: p.pipeline,
      }))
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
  }

  // Fallback: use softArbData while portfolio loads
  return (softArbData?.trades ?? [])
    .filter((t) => isVisiblePositionStatus(t.status))
    .map((t) => ({
      ...t,
      actual_shares: t.shares,
      actual_pnl: t.unrealized_pnl,
      display_pnl: t.unrealized_pnl,
      expired: false,
      tradeUrlSlug: t.event_slug ?? t.polymarket_slug,
      actual_status: "LOG_ONLY" as const,
      onChain: null,
      pipeline: null,
    }));
}, [portfolio, softArbData]);
```

- [ ] **Step 4: Add orphaned trades section to JSX**

Find the existing position list section header in the JSX. Add immediately before it:

```tsx
{/* Orphaned pipeline trades */}
{(portfolio?.alerts ?? []).filter((a) => a.type === "orphaned_trade").length > 0 && (
  <div className="mb-4 rounded border border-red-700 bg-red-950 p-3">
    <p className="mb-1 text-sm font-semibold text-red-400">
      Orphaned Trades — Pipeline recorded but no on-chain position found
    </p>
    {portfolio!.alerts
      .filter((a) => a.type === "orphaned_trade")
      .map((a) => (
        <p key={a.tradeId ?? a.slug} className="text-xs text-red-300">
          {a.message}
        </p>
      ))}
  </div>
)}
```

- [ ] **Step 5: Update refresh handler**

Find the existing refresh button / refresh callback. Update it to also refresh portfolio:

```typescript
const handleRefresh = useCallback(async () => {
  await Promise.all([refreshSoftArb(), refreshPortfolio()]);
}, [refreshSoftArb, refreshPortfolio]);
```

- [ ] **Step 6: Typecheck and manual verify**

```bash
cd ~/openclaw-mission-control
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

Navigate to `http://localhost:5173/arb/soft`:
- Active positions should show on-chain share counts
- `actual_status` should say "POSITION" for all matched positions (not "LOG_ONLY")
- live-019 orphaned trade should appear in the red alert banner
- PnL figures should match what you see on PolymarketPage for the same markets

- [ ] **Step 7: Commit**

```bash
git add src/pages/SoftArbPage.tsx
git commit -m "feat: SoftArbPage uses on-chain truth for positions, adds orphaned trade alerts"
```

---

## Self-Review

### Spec Coverage Check

| Spec Section | Covered by |
|---|---|
| `/api/portfolio` endpoint | Task 2 |
| Polymarket API as source of truth | Task 2 Step 1–3 |
| JSONL metadata overlay | Task 2 Step 3 (`_readPipelineBySlug`) |
| Convex fallback on failure | Task 2 Step 2 (`_fetchConvexPositions`) |
| 30s in-memory cache | Task 2 Step 1 (`_portfolioCache`) |
| Join by slug | Task 2 Step 3 (`pipeline.get(p.slug)`) |
| Category: tracked / manual / legacy | Task 2 Step 3 (`_buildPortfolioResponse`) |
| Orphaned trade alert | Task 2 Step 3 (remaining entries in `pipeline` map) |
| Unclaimed payout alert | Task 2 Step 3 (`redeemable && initialValue > 0`) |
| Share mismatch alert | Task 2 Step 3 (>5% check) |
| Source badge (Live/Cached) | Task 4 Step 4 |
| `usePortfolio()` hook | Task 3 |
| PolymarketPage category groups | Task 4 Step 3 |
| SoftArbPage orphaned section | Task 5 Step 4 |
| Convex untouched | No Convex files modified ✓ |
| JSONL pipeline still writes | No pipeline files modified ✓ |
| `useSoftArbTrades` kept for calibration/shield | Task 5 Step 1 (only Convex query removed) ✓ |

### Placeholder Scan

No TBDs, TODOs, or "implement later" phrases. All code blocks are complete.

### Type Consistency

- `PortfolioResponse`, `PortfolioPosition`, `OnChainPosition`, `PipelineMetadata`, `PortfolioAlert` defined in Task 1, used in Tasks 3–5. ✓
- `_buildPortfolioResponse` returns `PortfolioResponse` (Task 2) — same type consumed by `usePortfolio` (Task 3). ✓
- `PolymarketApiRawPosition` defined in Task 2 Step 1, used in Steps 2–4. ✓
- `PipelineLiveRecord` defined in Task 2 Step 3, not referenced elsewhere. ✓
- `actual_status` typed as `"POSITION" | "LOG_ONLY"` via `as const` — consistent with existing SoftArbPage usage. ✓
