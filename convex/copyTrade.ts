import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertStatus = mutation({
	args: {
		tenantId: v.string(),
		running: v.boolean(),
		pid: v.optional(v.number()),
		mode: v.string(),
		bankroll: v.number(),
		openPositions: v.number(),
		totalPaperPnl: v.number(),
		status: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("copyTradeDaemonStatus")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();

		const now = Date.now();
		const base = {
			running: args.running,
			pid: args.pid,
			mode: args.mode,
			bankroll: args.bankroll,
			openPositions: args.openPositions,
			totalPaperPnl: args.totalPaperPnl,
			status: args.status,
			lastHeartbeatAt: now,
		};

		if (existing) {
			await ctx.db.patch("copyTradeDaemonStatus", existing._id, base);
		} else {
			await ctx.db.insert("copyTradeDaemonStatus", {
				tenantId: args.tenantId,
				...base,
			});
		}
		return null;
	},
});

export const getStatus = query({
	args: { tenantId: v.string() },
	returns: v.union(
		v.object({
			running: v.boolean(),
			pid: v.optional(v.number()),
			mode: v.string(),
			bankroll: v.number(),
			openPositions: v.number(),
			totalPaperPnl: v.number(),
			status: v.string(),
			lastHeartbeatAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const row = await ctx.db
			.query("copyTradeDaemonStatus")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();
		if (!row) return null;
		return {
			running: row.running,
			pid: row.pid,
			mode: row.mode,
			bankroll: row.bankroll,
			openPositions: row.openPositions,
			totalPaperPnl: row.totalPaperPnl,
			status: row.status,
			lastHeartbeatAt: row.lastHeartbeatAt,
		};
	},
});
