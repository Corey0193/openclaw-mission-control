import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { paginationOptsValidator } from "convex/server";

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

export const paginatedList = query({
        args: {
                tenantId: v.string(),
                paginationOpts: paginationOptsValidator,
                showOnlyInsiders: v.optional(v.boolean()),
                tag: v.optional(v.string()),
                minPnl: v.optional(v.number()),
                minCts: v.optional(v.number()),
                search: v.optional(v.string()),
        },
        handler: async (ctx, args) => {
                let q = ctx.db.query("wallets");

                // By default we sort by copyTradingScore (desc)
                const results = await q
                        .withIndex("by_tenant_cts", (q) => q.eq("tenantId", args.tenantId))
                        .order("desc")
                        .paginate(args.paginationOpts);

                // Note: Filtering after pagination will cause the page size to be smaller than requested.
                // For a small dataset (~5k), we can either filter on the server OR keep filtering on the client.
                // If we want to keep the UI fast, we should ideally keep the full list in memory IF it's not too big.
                // 5k wallets * ~1kb each = 5MB. This should be okay for modern browsers.
                
                // The current "slowness" might be from the initial .collect() taking too long to transfer.
                // Let's refine the list query to be more efficient.
                return results;
        },
});

export const count = query({
        args: {
                tenantId: v.string(),
        },
        handler: async (ctx, args) => {
                const wallets = await ctx.db
                        .query("wallets")
                        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
                        .collect();
                return wallets.length;
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
