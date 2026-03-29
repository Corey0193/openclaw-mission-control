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
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("wallets")
			.withIndex("by_address", (q) => q.eq("address", args.address))
			.first();

		const now = Date.now();
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
