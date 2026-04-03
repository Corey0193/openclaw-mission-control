import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const canaryStatusValidator = v.object({
	session_id: v.string(),
	session_started_at: v.string(),
	attempts: v.number(),
	rejected: v.number(),
	posted: v.number(),
	maker_fills: v.number(),
	maker_timeouts: v.number(),
	successes: v.number(),
	fok_kills: v.number(),
	emergency_dump_failures: v.number(),
	modeled_pnl: v.number(),
	last_reject_reason: v.string(),
	last_halt_reason: v.string(),
	last_event_at: v.string(),
});

export const upsertDaemonStatus = mutation({
	args: {
		tenantId: v.string(),
		running: v.boolean(),
		mode: v.string(),
		processCount: v.number(),
		pid: v.optional(v.number()),
		event: v.string(),
		canary: v.optional(canaryStatusValidator),
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
			canary: args.canary,
		};

		if (existing) {
			await ctx.db.patch("arbDaemonStatus", existing._id, {
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
			canary: v.optional(canaryStatusValidator),
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
			canary: status.canary,
		};
	},
});
