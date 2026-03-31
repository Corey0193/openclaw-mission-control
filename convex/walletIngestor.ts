import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertStatus = mutation({
	args: {
		tenantId: v.string(),
		running: v.boolean(),
		pid: v.optional(v.number()),
		walletCount: v.number(),
		tradeCount: v.number(),
		status: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("walletIngestorStatus")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();

		const now = Date.now();
		if (existing) {
			await ctx.db.patch("walletIngestorStatus", existing._id, {
				running: args.running,
				pid: args.pid,
				walletCount: args.walletCount,
				tradeCount: args.tradeCount,
				lastHeartbeatAt: now,
				status: args.status,
			});
		} else {
			await ctx.db.insert("walletIngestorStatus", {
				tenantId: args.tenantId,
				running: args.running,
				pid: args.pid,
				walletCount: args.walletCount,
				tradeCount: args.tradeCount,
				lastHeartbeatAt: now,
				status: args.status,
			});
		}
	},
});

export const getStatus = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("walletIngestorStatus")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();
	},
});
