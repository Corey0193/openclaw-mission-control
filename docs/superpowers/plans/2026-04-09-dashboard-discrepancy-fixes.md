# Dashboard Data Discrepancy Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 bugs causing the Polymarket page and Soft Arb page to show conflicting positions, P&L, and outcome data.

**Architecture:** All 4 fixes are in the Vite middleware (`vite.config.ts`) and the Soft Arb page component (`src/pages/SoftArbPage.tsx`). No new files needed. Changes are isolated — each task can be verified independently via the local API endpoints.

**Tech Stack:** TypeScript, Vite dev server middleware, React

**No test infrastructure exists.** Verification is done by hitting the local API endpoints (`/api/portfolio`, `/api/soft-arb/trades`) and checking the dashboard at `http://localhost:5173`.

---

## Context: Root Cause Summary

Investigation found these 4 bugs:

1. **Polymarket API timeout** — The 10s timeout causes `AbortError` in Node.js fetch, falling back to Convex unnecessarily. Logs confirm: `"DOMException [AbortError]: This operation was aborted"`.

2. **Outcome deduplication missing** — `getSoftArbTrades()` concatenates `truthOutcomes` + `rawOutcomeEntries` without dedup. Confirmed 4 duplicate trade_ids with contradictory WIN/LOSS data (e.g., `live-030` appears as both LOSS -$6.80 and WIN +$9.20). This corrupts win rate, realized P&L, and daily P&L.

3. **Convex `redeemable` logic wrong** — `p.marketResolved && p.currentPrice === 0` only marks losing positions as redeemable. Should be `p.marketResolved` since all resolved positions are redeemable on Polymarket.

4. **No on-chain reconciliation on Soft Arb page** — The resolved trades section uses soft arb outcome data exclusively. When the soft arb resolution script gets the outcome wrong (confirmed for Capitals-Leafs: soft arb says WIN +$9.2, on-chain says LOSS -$27.04), there's no warning.

---

### Task 1: Increase Polymarket API timeout

**Files:**
- Modify: `vite.config.ts:1914`

- [ ] **Step 1: Change the timeout constant**

In `vite.config.ts`, line 1914, change:

```typescript
const POLYMARKET_API_TIMEOUT_MS = 10_000;
```

to:

```typescript
const POLYMARKET_API_TIMEOUT_MS = 30_000;
```

- [ ] **Step 2: Verify the fix**

Wait 30s for the portfolio cache to expire, then run:

```bash
curl -s http://localhost:5173/api/portfolio | python3 -c "import json,sys; print('Source:', json.load(sys.stdin).get('source'))"
```

Expected: `Source: polymarket-api` (not `convex-fallback`).

If Vite doesn't hot-reload the config change, restart the dev server:

```bash
# Kill the running frontend process and restart
kill $(pgrep -f "vite --open") && cd /home/cburroughs/openclaw-mission-control && npm run dev:frontend &
```

Then re-run the curl check.

- [ ] **Step 3: Commit**

```bash
cd /home/cburroughs/openclaw-mission-control
git add vite.config.ts
git commit -m "fix: increase Polymarket API timeout from 10s to 30s

The 10s timeout was too aggressive for the Node.js fetch environment,
causing consistent AbortError fallbacks to Convex."
```

---

### Task 2: Deduplicate outcomes in getSoftArbTrades()

**Files:**
- Modify: `vite.config.ts:1541-1546`

The bug: `truthOutcomes` (from `soft-arb-truth.json`) and `rawOutcomeEntries` (from `outcome-tracking.jsonl`) are concatenated without dedup. Confirmed duplicates:
- `live-020`: truth says WIN +$18.46, raw says CONVERGED +$1.54
- `live-018`: truth says LOSS -$10.32, raw says CONVERGED $0
- `live-4`: truth has two entries itself (WIN +$4.84 and WIN +$7.37)
- `live-001`: truth says LOSS -$2.00, raw says CONVERGED -$0.26 (different pairs!)

Trade IDs can appear in different formats:
- Truth: `live-030`
- Raw: `live-live-030-scan-azuro-2026-04-08-0343`

The base trade ID must be extracted for matching: strip `live-` or `paper-` prefix, then take the next segment (e.g., `live-030` from `live-live-030-scan-...`).

- [ ] **Step 1: Add the deduplication helper function**

Add this function immediately before the `getSoftArbTrades` function (before line 1116):

```typescript
/**
 * Extract the base trade ID for deduplication.
 * Handles formats like:
 *   "live-030" → "live-030"
 *   "live-live-030-scan-azuro-2026-04-08-0343" → "live-030"
 *   "paper-paper-016-scan-azuro-..." → "paper-016"
 */
function extractBaseTradeId(tradeId: string): string {
	// Match patterns like "live-live-NNN-..." or "paper-paper-NNN-..."
	const compoundMatch = tradeId.match(
		/^(?:live|paper)-((?:live|paper)-\d+)/,
	);
	if (compoundMatch) return compoundMatch[1];
	return tradeId;
}

/**
 * Deduplicate outcomes, preferring truth entries over raw entries.
 * Groups by base trade_id and keeps truth (first in array) when duplicates exist.
 */
function deduplicateOutcomes(
	truthOutcomes: SoftArbOutcome[],
	rawOutcomes: SoftArbOutcome[],
): SoftArbOutcome[] {
	const seen = new Map<string, SoftArbOutcome>();

	// Truth entries take priority — add them first
	for (const outcome of truthOutcomes) {
		const baseId = extractBaseTradeId(outcome.trade_id);
		if (!seen.has(baseId)) {
			seen.set(baseId, outcome);
		}
		// Skip duplicates within truth itself (e.g., live-4 appears twice)
	}

	// Raw entries only added if no truth entry exists for that base ID
	for (const outcome of rawOutcomes) {
		const baseId = extractBaseTradeId(outcome.trade_id);
		if (!seen.has(baseId)) {
			seen.set(baseId, outcome);
		}
	}

	return Array.from(seen.values());
}
```

- [ ] **Step 2: Replace the naive concatenation with deduplication**

In `getSoftArbTrades()`, replace lines 1541-1546:

```typescript
	const outcomes: SoftArbOutcome[] = [
		...truthOutcomes,
		...rawOutcomeEntries,
	].sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);
```

with:

```typescript
	const outcomes: SoftArbOutcome[] = deduplicateOutcomes(
		truthOutcomes,
		rawOutcomeEntries,
	).sort(
		(a, b) =>
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);
```

- [ ] **Step 3: Verify deduplication**

Restart the dev server if needed, then:

```bash
curl -s http://localhost:5173/api/soft-arb/trades | python3 -c "
import json, sys
from collections import Counter
data = json.load(sys.stdin)
outcomes = data.get('outcomes', [])
print(f'Total outcomes: {len(outcomes)}')
# Check for remaining duplicates by extracting base trade IDs
import re
def base_id(tid):
    m = re.match(r'^(?:live|paper)-((?:live|paper)-\d+)', tid)
    return m.group(1) if m else tid
ids = [base_id(o['trade_id']) for o in outcomes]
dupes = {k: v for k, v in Counter(ids).items() if v > 1}
print(f'Duplicate base IDs: {dupes if dupes else \"none\"}')
print(f'Win rate: {data[\"summary\"].get(\"win_rate\")}')
print(f'Realized P&L: {data[\"summary\"].get(\"total_realized_pnl\")}')
"
```

Expected: `Duplicate base IDs: none`. The outcome count should drop from 93 to ~70 (removing ~23 duplicates). Win rate and realized P&L will change to reflect deduplicated data.

- [ ] **Step 4: Commit**

```bash
cd /home/cburroughs/openclaw-mission-control
git add vite.config.ts
git commit -m "fix: deduplicate outcomes from truth + outcome-tracking sources

Truth outcomes and outcome-tracking.jsonl were concatenated without
dedup, causing 4+ duplicate trade_ids with contradictory WIN/LOSS data.
Now deduplicates by base trade_id, preferring truth entries."
```

---

### Task 3: Fix Convex redeemable logic

**Files:**
- Modify: `vite.config.ts:2015`

The bug: `redeemable: p.marketResolved && p.currentPrice === 0` only marks losing positions as redeemable. On Polymarket, ALL resolved positions can be redeemed (winners get $1/share, losers get $0/share). The `currentPrice === 0` check incorrectly excludes winning positions from the "legacy/resolved" category, making them appear as active tracked positions.

- [ ] **Step 1: Fix the redeemable check**

In `vite.config.ts`, line 2015, change:

```typescript
			redeemable: p.marketResolved && p.currentPrice === 0,
```

to:

```typescript
			redeemable: p.marketResolved,
```

- [ ] **Step 2: Verify**

This fix only affects the Convex fallback path. To test, temporarily set the timeout back to 1ms to force fallback, check the data, then restore. Or just verify the code change is correct — the Polymarket API path already gets `redeemable` directly from the API.

- [ ] **Step 3: Commit**

```bash
cd /home/cburroughs/openclaw-mission-control
git add vite.config.ts
git commit -m "fix: mark all resolved Convex positions as redeemable

Previously only positions with currentPrice === 0 (losers) were marked
redeemable. On Polymarket, all resolved positions are redeemable."
```

---

### Task 4: Add on-chain reconciliation warnings to Soft Arb resolved trades

**Files:**
- Modify: `src/pages/SoftArbPage.tsx:801-806` (resolvedTrades memo)
- Modify: `src/pages/SoftArbPage.tsx:1312-1327` (resolved trades table cells)

When the soft arb system records an outcome that conflicts with on-chain data (e.g., soft arb says WIN but on-chain says the position lost), the dashboard should flag it. This uses the portfolio data already fetched by the page.

- [ ] **Step 1: Enrich resolvedTrades with on-chain reconciliation data**

In `SoftArbPage.tsx`, replace the `resolvedTrades` memo (lines 801-806):

```typescript
	const resolvedTrades = useMemo(() => {
		return (softArbData?.outcomes || []).sort(
			(a, b) =>
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		);
	}, [softArbData]);
```

with:

```typescript
	const resolvedTrades = useMemo(() => {
		const onChainBySlug = new Map<
			string,
			{ pnl: number; resolved: boolean; curPrice: number }
		>();
		if (portfolio) {
			for (const p of portfolio.positions) {
				onChainBySlug.set(p.slug, {
					pnl: p.onChain.unrealizedPnl,
					resolved: p.onChain.resolved,
					curPrice: p.onChain.currentPrice,
				});
			}
		}

		return (softArbData?.outcomes || [])
			.map((t) => {
				const slug = t.event_slug ?? t.polymarket_slug ?? "";
				const onChain = onChainBySlug.get(slug) ?? null;
				let mismatch: string | null = null;

				if (onChain && onChain.resolved) {
					const softArbWin = t.actual_outcome === "WIN";
					const onChainWin = onChain.curPrice > 0;
					if (softArbWin !== onChainWin) {
						mismatch = `On-chain: ${onChainWin ? "WIN" : "LOSS"} (${onChain.pnl >= 0 ? "+" : ""}$${onChain.pnl.toFixed(2)}), Soft Arb: ${t.actual_outcome} (${t.pnl_usd >= 0 ? "+" : ""}$${t.pnl_usd.toFixed(2)})`;
					}
				}

				return { ...t, onChainMismatch: mismatch };
			})
			.sort(
				(a, b) =>
					new Date(b.timestamp).getTime() -
					new Date(a.timestamp).getTime(),
			);
	}, [softArbData, portfolio]);
```

- [ ] **Step 2: Add mismatch warning badge to the resolved trades table**

In the resolved trades table, after the P&L cell (after line 1327 `<PnlBadge value={t.pnl_usd} />`), add a mismatch indicator. Replace the P&L `<td>` cell (lines 1325-1327):

```typescript
												<td className="px-4 py-3 text-right tabular-nums">
													<PnlBadge value={t.pnl_usd} />
												</td>
```

with:

```typescript
												<td className="px-4 py-3 text-right tabular-nums">
													<PnlBadge value={t.pnl_usd} />
													{t.onChainMismatch && (
														<div
															className="mt-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"
															title={t.onChainMismatch}
														>
															ON-CHAIN MISMATCH
														</div>
													)}
												</td>
```

- [ ] **Step 3: Add a summary mismatch count badge next to the section header**

In the resolved trades section header (around line 1242), after the total count badge, add a mismatch count. Replace:

```typescript
						<span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
							{resolvedTrades.length} TOTAL
						</span>
```

with:

```typescript
						<span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
							{resolvedTrades.length} TOTAL
						</span>
						{resolvedTrades.filter((t) => t.onChainMismatch).length > 0 && (
							<span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
								{resolvedTrades.filter((t) => t.onChainMismatch).length} MISMATCH
							</span>
						)}
```

- [ ] **Step 4: Verify on the dashboard**

Open `http://localhost:5173/arb/soft` and scroll to the "Recent Resolved Trades" section. Any trade where the soft arb outcome disagrees with on-chain data should show an amber "ON-CHAIN MISMATCH" badge below the P&L. Hover over the badge to see details.

- [ ] **Step 5: Commit**

```bash
cd /home/cburroughs/openclaw-mission-control
git add src/pages/SoftArbPage.tsx
git commit -m "feat: flag on-chain reconciliation mismatches in resolved trades

Cross-references resolved trade outcomes with on-chain portfolio data.
When the soft arb system disagrees with on-chain (e.g., soft arb says
WIN but on-chain position lost), shows an amber warning badge."
```
