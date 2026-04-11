# Dashboard Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the Soft Arb and Polymarket dashboards into two focused pages with clear roles and a shared wallet header.

**Architecture:** Extract a shared `WalletSummary` component that both pages use. Refactor `SoftArbPage` to remove redundant wallet cards and reorder sections by priority. Refactor `PolymarketPage` to add wallet context and merge three tables into one unified filterable table.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Tabler Icons, Vite

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/WalletSummary.tsx` | Shared 3-card wallet header + cross-page link |
| Create | `src/components/SummaryCard.tsx` | Extracted shared SummaryCard component (currently duplicated) |
| Create | `src/components/PnlBadge.tsx` | Extracted shared PnlBadge component (currently duplicated) |
| Create | `src/lib/formatters.ts` | Shared `formatUsd`, `formatPnl`, `timeAgo` (currently duplicated) |
| Modify | `src/pages/SoftArbPage.tsx` | Remove wallet cards, reorder sections, import shared components |
| Modify | `src/pages/PolymarketPage.tsx` | Add wallet header, merge tables, add filter row, import shared components |
| Modify | `src/types/portfolio.ts` | Add `WalletSnapshot` type for wallet data |

---

### Task 1: Extract Shared Utility Functions

Both pages duplicate `formatUsd`, `formatPnl`, `timeAgo`. Extract once.

**Files:**
- Create: `src/lib/formatters.ts`

- [ ] **Step 1: Create `src/lib/formatters.ts`**

```ts
export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return sign + formatUsd(n);
}

export function timeAgo(isoOrMs: string | number): string {
  const ts =
    typeof isoOrMs === "string" ? new Date(isoOrMs).getTime() : isoOrMs;
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "---";
  return `${n.toFixed(digits)}%`;
}
```

- [ ] **Step 2: Verify the project builds**

Run: `cd /home/cburroughs/openclaw-mission-control && npx tsc --noEmit`
Expected: No errors (new file has no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/formatters.ts
git commit -m "refactor: extract shared formatUsd, formatPnl, timeAgo, formatPct into lib/formatters"
```

---

### Task 2: Extract Shared PnlBadge Component

Both pages have their own `PnlBadge`. Extract into a shared component.

**Files:**
- Create: `src/components/PnlBadge.tsx`

- [ ] **Step 1: Create `src/components/PnlBadge.tsx`**

```tsx
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { formatPnl } from "../lib/formatters";

export function PnlBadge({ value }: { value: number | null }) {
  if (value == null)
    return <span className="text-muted-foreground">---</span>;
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold ${
        isPositive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {isPositive ? (
        <IconTrendingUp size={14} />
      ) : (
        <IconTrendingDown size={14} />
      )}
      {formatPnl(value)}
    </span>
  );
}
```

- [ ] **Step 2: Verify the project builds**

Run: `cd /home/cburroughs/openclaw-mission-control && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/PnlBadge.tsx
git commit -m "refactor: extract shared PnlBadge component"
```

---

### Task 3: Extract Shared SummaryCard Component

Both pages have their own `SummaryCard` with slightly different APIs. Unify into one that supports all prop variants.

**Files:**
- Create: `src/components/SummaryCard.tsx`

- [ ] **Step 1: Create `src/components/SummaryCard.tsx`**

Uses the SoftArbPage version as the base (it's the superset with `isPercent` and `isCurrency`).

```tsx
import { PnlBadge } from "./PnlBadge";
import { formatUsd } from "../lib/formatters";

export function SummaryCard({
  label,
  value,
  icon,
  isPnl,
  isPercent,
  isCurrency,
  subtitle,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  isPnl?: boolean;
  isPercent?: boolean;
  isCurrency?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-white border border-border rounded-xl px-3 py-3 shadow-sm min-w-0">
      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-semibold text-muted-foreground tracking-wide uppercase truncate">
          {label}
        </div>
        <div className="text-sm font-bold text-foreground truncate">
          {value == null ? (
            "---"
          ) : isPnl ? (
            <PnlBadge value={value} />
          ) : isPercent ? (
            `${value.toFixed(1)}%`
          ) : isCurrency ? (
            formatUsd(value)
          ) : (
            value
          )}
        </div>
        {subtitle && (
          <div className="text-[9px] text-muted-foreground truncate">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
```

Note the `subtitle` prop — this is new. The spec says Daily P&L should show "yesterday's as subtitle text" and Win Rate should show "trade count as subtitle". This one prop handles both without adding complexity.

- [ ] **Step 2: Verify the project builds**

Run: `cd /home/cburroughs/openclaw-mission-control && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SummaryCard.tsx
git commit -m "refactor: extract shared SummaryCard component with subtitle support"
```

---

### Task 4: Add WalletSnapshot Type

The wallet data from the soft arb API needs a proper type so `WalletSummary` can accept it cleanly.

**Files:**
- Modify: `src/types/portfolio.ts`

- [ ] **Step 1: Add `WalletSnapshot` interface to `src/types/portfolio.ts`**

Add at the end of the file (after line 70):

```ts
/** Wallet balance snapshot from soft_arb_live_risk.get_wallet_snapshot() */
export interface WalletSnapshot {
  total_wallet_value_usd: number;
  deployable_bankroll_usd: number;
  magic_usdc: number;
  phantom_usdc: number;
  phantom_pol: number;
  phantom_pol_usd_value: number;
  updated_at: string;
}
```

- [ ] **Step 2: Verify the project builds**

Run: `cd /home/cburroughs/openclaw-mission-control && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/portfolio.ts
git commit -m "feat: add WalletSnapshot type for shared wallet header"
```

---

### Task 5: Create WalletSummary Component

The shared 3-card wallet header used by both pages.

**Files:**
- Create: `src/components/WalletSummary.tsx`

- [ ] **Step 1: Create `src/components/WalletSummary.tsx`**

```tsx
import { Link } from "react-router-dom";
import { IconWallet, IconCurrencyDollar, IconChartBar } from "@tabler/icons-react";
import { SummaryCard } from "./SummaryCard";
import { timeAgo, formatUsd } from "../lib/formatters";
import type { WalletSnapshot } from "../types/portfolio";

interface WalletSummaryProps {
  /** Wallet balance snapshot from soft arb API. Null while loading. */
  wallet: WalletSnapshot | null;
  /** Sum of current value of all open positions (on-chain). Null while loading. */
  positionsValue: number | null;
  /** Link target and label for the cross-page nav */
  crossLink: { to: string; label: string };
}

export function WalletSummary({ wallet, positionsValue, crossLink }: WalletSummaryProps) {
  const totalValue =
    wallet != null && positionsValue != null
      ? wallet.total_wallet_value_usd + positionsValue
      : null;

  const availableCash = wallet?.deployable_bankroll_usd ?? null;

  const polSubtitle =
    wallet != null && wallet.phantom_pol_usd_value > 1
      ? `incl. ${formatUsd(wallet.phantom_pol_usd_value)} POL`
      : undefined;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Total Value"
          value={totalValue}
          icon={<IconWallet size={18} />}
          isCurrency
        />
        <SummaryCard
          label="Available Cash"
          value={availableCash}
          icon={<IconCurrencyDollar size={18} />}
          isCurrency
          subtitle={polSubtitle}
        />
        <SummaryCard
          label="In Positions"
          value={positionsValue}
          icon={<IconChartBar size={18} />}
          isCurrency
        />
      </div>
      <div className="flex items-center justify-between">
        {wallet?.updated_at ? (
          <span className="text-[10px] text-muted-foreground">
            Wallet updated {timeAgo(wallet.updated_at)}
          </span>
        ) : (
          <span />
        )}
        <Link
          to={crossLink.to}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {crossLink.label} &rarr;
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the project builds**

Run: `cd /home/cburroughs/openclaw-mission-control && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/WalletSummary.tsx
git commit -m "feat: add shared WalletSummary component (3-card wallet header with cross-page link)"
```

---

### Task 6: Refactor SoftArbPage — Wire Up Shared Components and Restructure Cards

Replace the 11 summary cards with the shared `WalletSummary` + 4 strategy performance cards. Remove duplicate local components. Reorder sections.

**Files:**
- Modify: `src/pages/SoftArbPage.tsx`

- [ ] **Step 1: Update imports at top of file (lines 1-20)**

Replace the existing imports with:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortfolio } from "../lib/usePortfolio";
import Header from "../components/Header";
import { WalletSummary } from "../components/WalletSummary";
import { SummaryCard } from "../components/SummaryCard";
import { PnlBadge } from "../components/PnlBadge";
import { formatUsd, formatPnl, timeAgo, formatPct } from "../lib/formatters";
import type { WalletSnapshot } from "../types/portfolio";
import {
  IconArrowsExchange,
  IconChartBar,
  IconPercentage,
  IconTrendingUp,
  IconTrendingDown,
  IconShieldCheck,
  IconScan,
  IconChevronDown,
  IconTarget,
  IconRefresh,
  IconBrain,
  IconCircleCheck,
  IconAlertTriangle,
  IconWallet,
  IconCurrencyDollar,
} from "@tabler/icons-react";
```

- [ ] **Step 2: Remove local `formatUsd`, `formatPnl`, `timeAgo`, `formatPct` functions (lines 21-50)**

Delete these four functions — they're now imported from `../lib/formatters`.

- [ ] **Step 3: Remove local `PnlBadge` component (lines 119-136)**

Delete the local `PnlBadge` function — it's now imported from `../components/PnlBadge`.

- [ ] **Step 4: Remove local `SummaryCard` component (lines 138-178)**

Delete the local `SummaryCard` function — it's now imported from `../components/SummaryCard`.

- [ ] **Step 5: Simplify `walletStats` useMemo (around lines 828-868)**

Replace the walletStats block with a simpler version that just extracts wallet data for WalletSummary and position equity for passing down:

```tsx
const walletSnapshot: WalletSnapshot | null = useMemo(() => {
  const w = softArbData?.wallet;
  if (!w || w.total_wallet_value_usd == null) return null;
  return {
    total_wallet_value_usd: Number(w.total_wallet_value_usd),
    deployable_bankroll_usd: Number(w.deployable_bankroll_usd ?? 0),
    magic_usdc: Number(w.magic_usdc ?? 0),
    phantom_usdc: Number(w.phantom_usdc ?? 0),
    phantom_pol: Number(w.phantom_pol ?? 0),
    phantom_pol_usd_value: Number(w.phantom_pol_usd_value ?? 0),
    updated_at: w.updated_at,
  };
}, [softArbData]);

const positionsValue = useMemo(() => {
  if (!portfolio) return null;
  const openPositions = (portfolio.positions ?? []).filter(
    (p) => !p.onChain.resolved && p.onChain.shares > 0,
  );
  return Math.round(
    openPositions.reduce((sum, p) => sum + p.onChain.currentValue, 0) * 100,
  ) / 100;
}, [portfolio]);
```

- [ ] **Step 6: Replace the 11-card grid (lines 952-1039) with WalletSummary + 4 strategy cards**

Replace the entire block from the `{/* Summary stats */}` comment through the wallet snapshot text and disclaimer with:

```tsx
{/* Wallet header */}
<WalletSummary
  wallet={walletSnapshot}
  positionsValue={positionsValue}
  crossLink={{ to: "/arb/polymarket", label: "Full portfolio view" }}
/>

{/* Strategy performance cards */}
<div
  className="grid gap-3"
  style={{
    gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
  }}
>
  <SummaryCard
    label="Unrealized P&L"
    value={Number(softArbData?.summary.total_unrealized_pnl ?? 0)}
    icon={<IconTrendingUp size={20} />}
    isPnl
  />
  <SummaryCard
    label="Realized P&L"
    value={Number(softArbData?.summary.total_realized_pnl ?? 0)}
    icon={<IconPercentage size={20} />}
    isPnl
  />
  <SummaryCard
    label="Daily P&L"
    value={dailyStats.today}
    icon={<IconChartBar size={20} />}
    isPnl
    subtitle={`Yesterday: ${formatPnl(dailyStats.yesterday)}`}
  />
  <SummaryCard
    label="Win Rate"
    value={Number(softArbData?.summary.win_rate ?? 0)}
    icon={<IconTarget size={20} />}
    isPercent
    subtitle={`${softArbData?.trades.length ?? 0} trades`}
  />
</div>
```

- [ ] **Step 7: Remove the "Other Wallet Positions" section (lines 1360-1431)**

Delete the entire `{unmappedPositions.length > 0 && (...)}` block. These positions now live on the Polymarket page.

Also remove the `unmappedPositions` useMemo that computed this data (search for `unmappedPositions` definition earlier in the file and remove it).

- [ ] **Step 8: Verify the project builds**

Run: `cd /home/cburroughs/openclaw-mission-control && npx tsc --noEmit`
Expected: No errors. Fix any type mismatches.

- [ ] **Step 9: Commit**

```bash
git add src/pages/SoftArbPage.tsx
git commit -m "refactor(soft-arb): replace 11 wallet cards with shared WalletSummary + 4 strategy cards

Removes: Tracked Trades, Soft Arb Wallet, Soft Arb Capital, Soft Arb Portfolio,
Full Wallet Value, Yesterday P&L, Avg Daily P&L cards.
Removes: Other Wallet Positions section (moved to Polymarket page).
Adds: Shared WalletSummary header (Total Value, Available Cash, In Positions).
Keeps: 4 strategy cards (Unrealized P&L, Realized P&L, Daily P&L, Win Rate)."
```

---

### Task 7: Refactor PolymarketPage — Add Wallet Header and Unified Table

Add `WalletSummary` to the top, merge three tables into one with status badges and filter row.

**Files:**
- Modify: `src/pages/PolymarketPage.tsx`

- [ ] **Step 1: Update imports (lines 1-12)**

Replace the existing imports with:

```tsx
import { useEffect, useMemo, useState } from "react";
import { usePortfolio } from "../lib/usePortfolio";
import type { PortfolioPosition, PortfolioAlert } from "../types/portfolio";
import type { WalletSnapshot } from "../types/portfolio";
import Header from "../components/Header";
import { WalletSummary } from "../components/WalletSummary";
import { SummaryCard } from "../components/SummaryCard";
import { PnlBadge } from "../components/PnlBadge";
import { formatUsd, timeAgo } from "../lib/formatters";
import {
  IconChartBar,
  IconExternalLink,
  IconRefresh,
  IconTrendingUp,
  IconCoin,
} from "@tabler/icons-react";
```

- [ ] **Step 2: Remove local `formatUsd`, `formatPnl`, `timeAgo` functions (lines 14-36)**

Delete — now imported from `../lib/formatters`.

- [ ] **Step 3: Remove local `PnlBadge` component (lines 38-54)**

Delete — now imported from `../components/PnlBadge`.

- [ ] **Step 4: Remove local `SummaryCard` component (lines 56-82)**

Delete — now imported from `../components/SummaryCard`.

- [ ] **Step 5: Add wallet data fetching and filter state**

Inside the `PolymarketPage` component, after the existing `usePortfolio()` call (line 85), add:

```tsx
const [walletSnapshot, setWalletSnapshot] = useState<WalletSnapshot | null>(null);
const [statusFilter, setStatusFilter] = useState<"all" | "soft-arb" | "manual" | "resolved">("all");

// Fetch wallet data from soft-arb API (same source as SoftArbPage)
useEffect(() => {
  let cancelled = false;
  async function fetchWallet() {
    try {
      const res = await fetch("/api/soft-arb/trades");
      if (!res.ok) return;
      const json = await res.json();
      if (!cancelled && json?.wallet) {
        setWalletSnapshot({
          total_wallet_value_usd: Number(json.wallet.total_wallet_value_usd ?? 0),
          deployable_bankroll_usd: Number(json.wallet.deployable_bankroll_usd ?? 0),
          magic_usdc: Number(json.wallet.magic_usdc ?? 0),
          phantom_usdc: Number(json.wallet.phantom_usdc ?? 0),
          phantom_pol: Number(json.wallet.phantom_pol ?? 0),
          phantom_pol_usd_value: Number(json.wallet.phantom_pol_usd_value ?? 0),
          updated_at: json.wallet.updated_at,
        });
      }
    } catch { /* wallet is optional enhancement */ }
  }
  fetchWallet();
  const interval = setInterval(fetchWallet, 30_000);
  return () => { cancelled = true; clearInterval(interval); };
}, []);
```

`useEffect` is already included in the updated imports from Step 1.

- [ ] **Step 6: Add `positionsValue` and `allPositions` computed values**

After the existing `totalPnl` useMemo, add:

```tsx
const positionsValue = useMemo(
  () =>
    Math.round(
      (portfolio?.positions ?? [])
        .filter((p) => !p.onChain.resolved && p.onChain.shares > 0)
        .reduce((sum, p) => sum + p.onChain.currentValue, 0) * 100,
    ) / 100,
  [portfolio],
);

const allPositions = useMemo(() => {
  const positions = portfolio?.positions ?? [];
  if (statusFilter === "all") return positions;
  if (statusFilter === "soft-arb")
    return positions.filter((p) => p.category === "tracked");
  if (statusFilter === "manual")
    return positions.filter((p) => p.category === "manual");
  if (statusFilter === "resolved")
    return positions.filter(
      (p) => p.onChain.resolved || p.onChain.redeemable || p.category === "legacy",
    );
  return positions;
}, [portfolio, statusFilter]);
```

- [ ] **Step 7: Remove old derived slices that are no longer needed**

Delete these useMemo blocks — no longer used:
- `trackedPositions` (lines 97-100)
- `manualPositions` (lines 102-105)
- `legacyPositions` (lines 107-110)
- `openPositions` (lines 124-130)
- `resolvedPositions` (lines 133-139)

Keep: `highAlerts`, `claimableAlerts`, `totalInvested`, `totalCurrentValue`, `totalPnl`.

- [ ] **Step 8: Replace the JSX return — remove source badge, add WalletSummary, replace tables**

Replace the entire return JSX (from `return (` to the closing `)`) with this restructured version:

```tsx
return (
  <div className="h-screen overflow-y-auto bg-[#f8f9fa] text-slate-800">
    <Header />

    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-orange)] text-white">
            <IconChartBar size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              Polymarket Portfolio
            </h2>
            <p className="text-[11px] text-muted-foreground">
              On-chain truth via unified portfolio API
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {portfolio && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <IconRefresh
                size={14}
                className={isRefreshing ? "animate-spin" : ""}
              />
              {isRefreshing
                ? "Refreshing..."
                : `Fetched: ${timeAgo(portfolio.fetchedAt)}`}
            </button>
          )}
        </div>
      </div>

      {!isLoaded ? (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-white border border-border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Wallet header */}
          <WalletSummary
            wallet={walletSnapshot}
            positionsValue={positionsValue}
            crossLink={{ to: "/arb/soft", label: "Strategy dashboard" }}
          />

          {/* Portfolio summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="Invested"
              value={totalInvested}
              icon={<IconCoin size={18} />}
              isCurrency
            />
            <SummaryCard
              label="Current Value"
              value={totalCurrentValue}
              icon={<IconTrendingUp size={18} />}
              isCurrency
            />
            <SummaryCard
              label="Total P&L"
              value={totalPnl}
              icon={<IconChartBar size={18} />}
              isPnl
            />
          </div>

          {/* Alert banners */}
          {highAlerts.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="mb-1 text-sm font-semibold text-red-700">
                Pipeline Tracking Errors ({highAlerts.length})
              </p>
              {highAlerts.map((a: PortfolioAlert) => (
                <p key={a.tradeId ?? a.slug} className="text-xs text-red-600">
                  {a.message}
                </p>
              ))}
            </div>
          )}

          {claimableAlerts.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="mb-1 text-sm font-semibold text-blue-700">
                Unclaimed Payouts ({claimableAlerts.length})
              </p>
              {claimableAlerts.map((a: PortfolioAlert) => (
                <p
                  key={a.tradeId ?? a.slug}
                  className="text-xs text-blue-600"
                >
                  {a.message}
                </p>
              ))}
            </div>
          )}

          {/* Filter row */}
          <div className="flex items-center gap-2">
            {(["all", "soft-arb", "manual", "resolved"] as const).map(
              (filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    statusFilter === filter
                      ? "bg-foreground text-white"
                      : "bg-white border border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {filter === "soft-arb" ? "Soft Arb" : filter === "all" ? "All" : filter === "manual" ? "Manual" : "Resolved"}
                  {filter === "all" && (
                    <span className="ml-1 opacity-60">
                      ({(portfolio?.positions ?? []).length})
                    </span>
                  )}
                </button>
              ),
            )}
          </div>

          {/* Unified positions table */}
          <section>
            {allPositions.length === 0 ? (
              <div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                No positions
                {statusFilter !== "all" && " matching this filter"}
              </div>
            ) : (
              <div className="bg-white border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
                      <th className="text-left px-4 py-3">Market</th>
                      <th className="text-left px-3 py-3">Outcome</th>
                      <th className="text-right px-3 py-3">Shares</th>
                      <th className="text-right px-3 py-3">Entry</th>
                      <th className="text-right px-3 py-3">Current</th>
                      <th className="text-right px-3 py-3">Value</th>
                      <th className="text-right px-3 py-3">P&L</th>
                      <th className="text-right px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPositions.map((p: PortfolioPosition, i) => (
                      <tr
                        key={`${p.slug}-${p.outcome}`}
                        className={
                          i < allPositions.length - 1
                            ? "border-b border-border/50 hover:bg-muted/5"
                            : "hover:bg-muted/5"
                        }
                      >
                        <td className="px-4 py-3 max-w-[260px]">
                          <a
                            href={`https://polymarket.com/event/${p.onChain.eventSlug || p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:text-[var(--accent-orange)] transition-colors font-medium flex items-center gap-1"
                          >
                            <span className="truncate">{p.title}</span>
                            <IconExternalLink
                              size={12}
                              className="shrink-0 opacity-40"
                            />
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                              p.outcome === "Yes"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {p.outcome.toUpperCase()}
                          </span>
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums font-medium">
                          {p.onChain.shares.toFixed(1)}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
                          ${p.onChain.avgPrice.toFixed(2)}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
                          ${p.onChain.currentPrice.toFixed(2)}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums">
                          {formatUsd(p.onChain.currentValue)}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums">
                          <PnlBadge value={p.onChain.unrealizedPnl} />
                        </td>
                        <td className="text-right px-4 py-3">
                          {p.onChain.redeemable ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-emerald-100 text-emerald-700">
                              Claimable
                            </span>
                          ) : p.onChain.resolved ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-slate-100 text-slate-600">
                              Resolved
                            </span>
                          ) : p.category === "tracked" ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-blue-100 text-blue-700">
                              Soft Arb
                            </span>
                          ) : p.category === "manual" ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-gray-100 text-gray-600">
                              Manual
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-gray-50 text-gray-400">
                              Legacy
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  </div>
);
```

- [ ] **Step 9: Verify the project builds**

Run: `cd /home/cburroughs/openclaw-mission-control && npx tsc --noEmit`
Expected: No errors. Fix any type issues.

- [ ] **Step 10: Commit**

```bash
git add src/pages/PolymarketPage.tsx
git commit -m "refactor(polymarket): add wallet header, merge 3 tables into unified filterable table

Adds: Shared WalletSummary header (Total Value, Available Cash, In Positions).
Replaces: Separate Open/Manual/Resolved tables with single unified table.
Adds: Filter row (All / Soft Arb / Manual / Resolved) with status badges.
Removes: Source badge (Live/Cached) — data freshness shown in wallet timestamp.
Moves: Alert banners to light theme styling consistent with rest of page."
```

---

### Task 8: Visual Verification

Start the dev server and verify both pages look correct.

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `cd /home/cburroughs/openclaw-mission-control && npm run dev:frontend`
Expected: Vite dev server starts on http://localhost:5173

- [ ] **Step 2: Check `/arb/soft`**

Open http://localhost:5173/arb/soft in a browser. Verify:
- Wallet header shows 3 cards: Total Value, Available Cash, In Positions
- "Full portfolio view" link appears below wallet header, links to `/arb/polymarket`
- 4 strategy cards: Unrealized P&L, Realized P&L, Daily P&L (with yesterday subtitle), Win Rate (with trade count subtitle)
- Open positions table unchanged
- Stale trades section present if applicable
- Pipeline scan history expandable section present
- Resolved trades expandable section present
- Calibration & Feedback section at bottom (collapsed by default)
- Oracle Shield & Safety section at bottom (collapsed by default)
- No "Other Wallet Positions" section
- No "Tracked Trades", "Soft Arb Wallet", "Soft Arb Capital", "Soft Arb Portfolio", "Full Wallet Value", "Yesterday P&L", "Avg Daily P&L" cards

- [ ] **Step 3: Check `/arb/polymarket`**

Open http://localhost:5173/arb/polymarket in a browser. Verify:
- Wallet header shows 3 cards: Total Value, Available Cash, In Positions
- "Strategy dashboard" link appears below wallet header, links to `/arb/soft`
- 3 portfolio cards: Invested, Current Value, Total P&L
- Filter row with All / Soft Arb / Manual / Resolved buttons
- Single unified table with Status column showing correct badges
- Clicking filters correctly narrows the table
- Alert banners appear when relevant (orphaned trades, unclaimed payouts)
- No source badge (Live/Cached) visible — data freshness in wallet timestamp only

- [ ] **Step 4: Verify wallet numbers match between pages**

With both pages open, confirm:
- Total Value, Available Cash, and In Positions are identical on both pages
- The numbers make sense: Total Value = Available Cash + In Positions (approximately)

- [ ] **Step 5: Commit any fixes discovered during testing**

If any visual issues were found and fixed:
```bash
git add -u
git commit -m "fix: visual adjustments from manual testing of dashboard simplification"
```
