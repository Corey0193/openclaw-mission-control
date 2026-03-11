import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertDaemonStatus = mutation({
	args: {
		tenantId: v.string(),
		running: v.boolean(),
		mode: v.string(),
		processCount: v.number(),
		pid: v.optional(v.number()),
		event: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("arbDaemonStatus")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();

		const now = Date.now();
		const base = {
			running: args.running,
			mode: args.mode,
			processCount: args.processCount,
			pid: args.pid,
			lastHeartbeatAt: now,
			event: args.event,
		};

		if (existing) {
			await ctx.db.patch(existing._id, {
				...base,
				// Only overwrite startedAt on explicit "started" event
				...(args.event === "started" ? { startedAt: now } : {}),
			});
		} else {
			await ctx.db.insert("arbDaemonStatus", {
				tenantId: args.tenantId,
				startedAt: args.event === "started" ? now : undefined,
				...base,
			});
		}
		return null;
	},
});

export const getDaemonStatus = query({
	args: { tenantId: v.string() },
	returns: v.union(
		v.object({
			running: v.boolean(),
			mode: v.string(),
			processCount: v.number(),
			pid: v.optional(v.number()),
			startedAt: v.optional(v.number()),
			lastHeartbeatAt: v.number(),
			event: v.string(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const status = await ctx.db
			.query("arbDaemonStatus")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();
		if (!status) return null;
		return {
			running: status.running,
			mode: status.mode,
			processCount: status.processCount,
			pid: status.pid,
			startedAt: status.startedAt,
			lastHeartbeatAt: status.lastHeartbeatAt,
			event: status.event,
		};
	},
});
