import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
	args: {
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wallets")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.order("desc")
			.collect();
	},
});

export const upsert = mutation({
	args: {
		address: v.string(),
		username: v.optional(v.string()),
		totalPnl: v.number(),
		performanceScore: v.number(),
		winRate: v.optional(v.union(v.number(), v.null())),
		tradeCount: v.optional(v.union(v.number(), v.null())),
		firstTradeAt: v.optional(v.union(v.string(), v.null())),
		isInsider: v.boolean(),
		tags: v.array(v.string()),
		tenantId: v.optional(v.string()),
		// CTS fields
		copyTradingScore: v.optional(v.number()),
		ctsConsistency: v.optional(v.number()),
		ctsWinRate: v.optional(v.number()),
		pnl7d: v.optional(v.number()),
		pnl30d: v.optional(v.number()),
		pnl90d: v.optional(v.number()),
		maxDrawdownPct: v.optional(v.number()),
		profitableWeeksRatio: v.optional(v.number()),
		computedWinRate: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("wallets")
			.withIndex("by_address", (q) => q.eq("address", args.address))
			.first();

		const now = Date.now();
		const ctsFields = {
			...(args.copyTradingScore !== undefined && { copyTradingScore: args.copyTradingScore }),
			...(args.ctsConsistency !== undefined && { ctsConsistency: args.ctsConsistency }),
			...(args.ctsWinRate !== undefined && { ctsWinRate: args.ctsWinRate }),
			...(args.pnl7d !== undefined && { pnl7d: args.pnl7d }),
			...(args.pnl30d !== undefined && { pnl30d: args.pnl30d }),
			...(args.pnl90d !== undefined && { pnl90d: args.pnl90d }),
			...(args.maxDrawdownPct !== undefined && { maxDrawdownPct: args.maxDrawdownPct }),
			...(args.profitableWeeksRatio !== undefined && { profitableWeeksRatio: args.profitableWeeksRatio }),
			...(args.computedWinRate !== undefined && { computedWinRate: args.computedWinRate }),
		};

		if (existing) {
			await ctx.db.patch(existing._id, {
				username: args.username,
				totalPnl: args.totalPnl,
				performanceScore: args.performanceScore,
				winRate: args.winRate,
				tradeCount: args.tradeCount,
				firstTradeAt: args.firstTradeAt,
				isInsider: args.isInsider,
				tags: args.tags,
				lastSyncedAt: now,
				...ctsFields,
			});
			return existing._id;
		} else {
			return await ctx.db.insert("wallets", {
				address: args.address,
				username: args.username,
				totalPnl: args.totalPnl,
				performanceScore: args.performanceScore,
				winRate: args.winRate,
				tradeCount: args.tradeCount,
				firstTradeAt: args.firstTradeAt,
				isInsider: args.isInsider,
				tags: args.tags,
				lastSyncedAt: now,
				tenantId: args.tenantId,
				...ctsFields,
			});
		}
	},
});

export const getByAddress = query({
	args: { address: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wallets")
			.withIndex("by_address", (q) => q.eq("address", args.address))
			.first();
	},
});
