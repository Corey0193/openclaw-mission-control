import {
	mutation,
	query,
	internalQuery,
	internalMutation,
} from "./_generated/server";
import { v } from "convex/values";

const bookLevelValidator = v.object({
	price: v.string(),
	size: v.string(),
});

export const insertPaperTrade = mutation({
	args: {
		pairName: v.string(),
		makerExchange: v.string(),
		takerExchange: v.string(),
		polySide: v.string(),
		lmtsSide: v.string(),
		makerPrice: v.number(),
		takerPrice: v.number(),
		viableSize: v.number(),
		netProfit: v.number(),
		polyBookSnapshot: v.array(bookLevelValidator),
		lmtsBookSnapshot: v.array(bookLevelValidator),
		tokenId: v.string(),
		lmtsSlug: v.string(),
		lmtsOutcomeIndex: v.number(),
		timestamp: v.string(),
		epochMs: v.number(),
		confidence: v.optional(v.union(v.literal("HIGH"), v.literal("LOW"))),
		tenantId: v.optional(v.string()),
		status: v.optional(v.union(
			v.literal("PAPER_FILL"),
			v.literal("PAPER_TIMEOUT"),
			v.literal("PAPER_FOK_FAILED"),
		)),
		simulation: v.optional(v.any()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.insert("arbPaperTrades", {
			...args,
			tenantId: args.tenantId ?? "default",
			confidence: args.confidence ?? "HIGH",
			status: args.status ?? "PAPER_FILL",
		});
		return null;
	},
});

export const listPaperTrades = query({
	args: {
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("arbPaperTrades")
			.withIndex("by_tenant_epochMs", (q) => q.eq("tenantId", args.tenantId))
			.order("desc")
			.collect();
	},
});

export const getPaperTradeSummary = query({
	args: {
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		const trades = await ctx.db
			.query("arbPaperTrades")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		let totalTrades = 0;
		let projectedPnl = 0;
		let actualPnl = 0;
		let wins = 0;
		let losses = 0;
		let unresolved = 0;
		let timeouts = 0;
		let fokFails = 0;
		let highConfTrades = 0;
		let highConfPnl = 0;
		let lowConfTrades = 0;
		let lowConfPnl = 0;

		for (const t of trades) {
			totalTrades++;
			projectedPnl += t.netProfit;

			const isHigh = (t.confidence ?? "HIGH") === "HIGH";
			if (isHigh) {
				highConfTrades++;
				highConfPnl += t.netProfit;
			} else {
				lowConfTrades++;
				lowConfPnl += t.netProfit;
			}

			if (t.status === "PAPER_FILL") {
				unresolved++;
			} else if (t.status === "PAPER_TIMEOUT") {
				timeouts++;
			} else if (t.status === "PAPER_FOK_FAILED") {
				fokFails++;
			} else if (t.status === "RESOLVED_WIN") {
				wins++;
				actualPnl += t.actualPnl ?? t.netProfit;
			} else if (t.status === "RESOLVED_LOSS") {
				losses++;
				actualPnl += t.actualPnl ?? 0;
			}
		}

		const resolved = wins + losses;
		const winRate = resolved > 0 ? wins / resolved : 0;
		const fillRate = totalTrades > 0
			? (totalTrades - timeouts - fokFails) / totalTrades
			: 0;

		return {
			totalTrades,
			projectedPnl: Math.round(projectedPnl * 100) / 100,
			actualPnl: Math.round(actualPnl * 100) / 100,
			wins,
			losses,
			unresolved,
			timeouts,
			fokFails,
			winRate: Math.round(winRate * 1000) / 10,
			fillRate: Math.round(fillRate * 1000) / 10,
			highConfTrades,
			highConfPnl: Math.round(highConfPnl * 100) / 100,
			lowConfTrades,
			lowConfPnl: Math.round(lowConfPnl * 100) / 100,
		};
	},
});

export const listUnresolvedInternal = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query("arbPaperTrades")
			.withIndex("by_tenant_status", (q) =>
				q.eq("tenantId", "default").eq("status", "PAPER_FILL"),
			)
			.collect();
	},
});

export const clearAllPaperTrades = mutation({
	args: {
		tenantId: v.string(),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const trades = await ctx.db
			.query("arbPaperTrades")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();
		for (const t of trades) {
			await ctx.db.delete(t._id);
		}
		return trades.length;
	},
});

export const resolvePaperTrade = internalMutation({
	args: {
		id: v.id("arbPaperTrades"),
		status: v.union(v.literal("RESOLVED_WIN"), v.literal("RESOLVED_LOSS")),
		resolvedAt: v.string(),
		actualPnl: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.id, {
			status: args.status,
			resolvedAt: args.resolvedAt,
			actualPnl: args.actualPnl,
		});
		return null;
	},
});
