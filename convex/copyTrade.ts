import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Daemon status ─────────────────────────────────────────────────────────────

export const upsertStatus = mutation({
	args: {
		tenantId: v.string(),
		running: v.boolean(),
		pid: v.optional(v.number()),
		mode: v.string(),
        leaderLabel: v.optional(v.string()),
        marketTitle: v.optional(v.string()),
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
			leaderLabel: args.leaderLabel,
			marketTitle: args.marketTitle,
			bankroll: args.bankroll,
			openPositions: args.openPositions,
			totalPaperPnl: args.totalPaperPnl,
			status: args.status,
			lastHeartbeatAt: now,
		};
		if (existing) {
			await ctx.db.patch("copyTradeDaemonStatus", existing._id, base);
		} else {
			await ctx.db.insert("copyTradeDaemonStatus", { tenantId: args.tenantId, ...base });
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
        leaderLabel: v.optional(v.string()),
        marketTitle: v.optional(v.string()),
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
			leaderLabel: row.leaderLabel,
			marketTitle: row.marketTitle,
			bankroll: row.bankroll,
			openPositions: row.openPositions,
			totalPaperPnl: row.totalPaperPnl,
			status: row.status,
			lastHeartbeatAt: row.lastHeartbeatAt,
		};	},
});

// ── Positions ─────────────────────────────────────────────────────────────────

const positionShape = v.object({
	positionId: v.string(),
	leaderAddress: v.string(),
	marketId: v.string(),
	tokenId: v.string(),
	outcomeIndex: v.number(),
	shares: v.number(),
	entryPrice: v.number(),
	leaderEntryPrice: v.number(),
	entryUsd: v.number(),
	entryTimestamp: v.number(),
	peak_price: v.number(),
	currentPrice: v.optional(v.number()),
	stopLossPrice: v.optional(v.number()),
	takeProfitPrice: v.optional(v.number()),
	exitStrategy: v.optional(v.string()),
	timeLimitAt: v.optional(v.number()),
	exitPrice: v.optional(v.number()),	exitTimestamp: v.optional(v.number()),
	exitReason: v.optional(v.string()),
	pnl: v.optional(v.number()),
	mode: v.string(),
	leaderLabel: v.optional(v.string()),
	marketTitle: v.optional(v.string()),
});

export const syncPositions = mutation({
	args: {
		tenantId: v.string(),
		positions: v.array(positionShape),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		for (const pos of args.positions) {
			const existing = await ctx.db
				.query("copyTradePositions")
				.withIndex("by_position_id", (q) => q.eq("positionId", pos.positionId))
				.first();
			if (existing) {
				await ctx.db.patch("copyTradePositions", existing._id, pos);
			} else {
				await ctx.db.insert("copyTradePositions", {
					tenantId: args.tenantId,
					...pos,
				});
			}
		}
		return null;
	},
});

export const listPositions = query({
	args: { tenantId: v.string() },
	returns: v.array(
		v.object({
			positionId: v.string(),
			leaderAddress: v.string(),
			marketId: v.string(),
			tokenId: v.string(),
			outcomeIndex: v.number(),
			shares: v.number(),
			entryPrice: v.number(),
			leaderEntryPrice: v.number(),
			entryUsd: v.number(),
			entryTimestamp: v.number(),
			peak_price: v.number(),
			currentPrice: v.optional(v.number()),
			stopLossPrice: v.optional(v.number()),
			takeProfitPrice: v.optional(v.number()),
			exitStrategy: v.optional(v.string()),
			timeLimitAt: v.optional(v.number()),
			exitPrice: v.optional(v.number()),			exitTimestamp: v.optional(v.number()),
			exitReason: v.optional(v.string()),
			pnl: v.optional(v.number()),
			mode: v.string(),
        leaderLabel: v.optional(v.string()),
        marketTitle: v.optional(v.string()),
		}),
	),
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("copyTradePositions")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();
		return rows
			.sort((a, b) => b.entryTimestamp - a.entryTimestamp)
			.map((r) => ({
				positionId: r.positionId,
				leaderAddress: r.leaderAddress,
				marketId: r.marketId,
				tokenId: r.tokenId,
				outcomeIndex: r.outcomeIndex,
				shares: r.shares,
				entryPrice: r.entryPrice,
				leaderEntryPrice: r.leaderEntryPrice,
				entryUsd: r.entryUsd,
				entryTimestamp: r.entryTimestamp,
				peakPrice: r.peakPrice,
				currentPrice: r.currentPrice,
				stopLossPrice: r.stopLossPrice,
				takeProfitPrice: r.takeProfitPrice,
				exitStrategy: r.exitStrategy,
				timeLimitAt: r.timeLimitAt,
				exitPrice: r.exitPrice,
				exitTimestamp: r.exitTimestamp,
				exitReason: r.exitReason,
				pnl: r.pnl,
				mode: r.mode,
				leaderLabel: r.leaderLabel,
				marketTitle: r.marketTitle,
			}));
	},
});

export const getDaemonStatus = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("copyTradeDaemonStatus")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.first();
	},
});
