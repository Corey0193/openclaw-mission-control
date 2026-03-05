import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const positionValidator = v.object({
	market: v.string(),
	marketQuestion: v.string(),
	marketSlug: v.string(),
	outcome: v.string(),
	shares: v.number(),
	entryPrice: v.number(),
	currentPrice: v.number(),
	costBasis: v.number(),
	currentValue: v.number(),
	payout: v.number(),
	unrealizedPnl: v.number(),
	marketClosed: v.boolean(),
	marketResolved: v.boolean(),
	winner: v.optional(v.boolean()),
});

const tradeValidator = v.object({
	id: v.string(),
	market: v.string(),
	marketQuestion: v.string(),
	side: v.string(),
	outcome: v.string(),
	shares: v.number(),
	price: v.number(),
	cost: v.number(),
	payout: v.number(),
	timestamp: v.number(),
	txHash: v.optional(v.string()),
	status: v.string(),
});

export const syncPositions = mutation({
	args: {
		walletAddress: v.string(),
		balanceUsdc: v.number(),
		positions: v.array(positionValidator),
		trades: v.array(tradeValidator),
		totalInvested: v.number(),
		totalCurrentValue: v.number(),
		totalPnl: v.number(),
		lastSyncedAt: v.number(),
		tenantId: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const tenantId = args.tenantId ?? "default";

		const existing = await ctx.db
			.query("polymarketPositions")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				walletAddress: args.walletAddress,
				balanceUsdc: args.balanceUsdc,
				positions: args.positions,
				trades: args.trades,
				totalInvested: args.totalInvested,
				totalCurrentValue: args.totalCurrentValue,
				totalPnl: args.totalPnl,
				lastSyncedAt: args.lastSyncedAt,
			});
		} else {
			await ctx.db.insert("polymarketPositions", {
				walletAddress: args.walletAddress,
				balanceUsdc: args.balanceUsdc,
				positions: args.positions,
				trades: args.trades,
				totalInvested: args.totalInvested,
				totalCurrentValue: args.totalCurrentValue,
				totalPnl: args.totalPnl,
				lastSyncedAt: args.lastSyncedAt,
				tenantId,
			});
		}

		return null;
	},
});

export const getPositions = query({
	args: {
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("polymarketPositions")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();
	},
});
