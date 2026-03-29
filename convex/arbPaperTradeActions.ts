import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const LIMITLESS_API = "https://api.limitless.exchange";

export const checkResolutions = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const unresolved = await ctx.runQuery(
			internal.arbPaperTrades.listUnresolvedInternal,
			{},
		);

		if (unresolved.length === 0) return null;

		// Deduplicate slugs to minimize API calls
		const slugs = [...new Set(unresolved.map((t) => t.lmtsSlug))];
		const marketResults = new Map<
			string,
			{ resolved: boolean; winningIndex: number | null }
		>();

		for (const slug of slugs) {
			try {
				const resp = await fetch(`${LIMITLESS_API}/markets/${slug}`);
				if (!resp.ok) {
					console.warn(`Limitless API returned ${resp.status} for ${slug}`);
					continue;
				}
				const market = await resp.json();
				if (market.resolved) {
					marketResults.set(slug, {
						resolved: true,
						winningIndex: market.winningOutcomeIndex ?? null,
					});
				}
			} catch (e) {
				console.warn(`Failed to fetch market ${slug}:`, e);
			}
		}

		// Resolve trades whose markets have settled
		const resolvedAt = new Date().toISOString();
		for (const trade of unresolved) {
			const result = marketResults.get(trade.lmtsSlug);
			if (!result?.resolved) continue;

			// In a hedged arb, both sides resolve — P&L is the locked spread
			// regardless of which outcome wins. Status tracks direction for info.
			const isWin = result.winningIndex === trade.lmtsOutcomeIndex;
			const actualPnl = trade.netProfit;

			await ctx.runMutation(internal.arbPaperTrades.resolvePaperTrade, {
				id: trade._id,
				status: isWin ? "RESOLVED_WIN" : "RESOLVED_LOSS",
				resolvedAt,
				actualPnl: Math.round(actualPnl * 100) / 100,
			});
		}

		return null;
	},
});
