import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
	...authTables,
	agents: defineTable({
		name: v.string(),
		role: v.string(),
		status: v.union(
			v.literal("idle"),
			v.literal("active"),
			v.literal("blocked"),
		),
		level: v.union(v.literal("LEAD"), v.literal("INT"), v.literal("SPC")),
		avatar: v.string(),
		currentTaskId: v.optional(v.id("tasks")),
		sessionKey: v.optional(v.string()),
		systemPrompt: v.optional(v.string()),
		character: v.optional(v.string()),
		lore: v.optional(v.string()),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	}).index("by_tenant", ["tenantId"]),
	tasks: defineTable({
		title: v.string(),
		description: v.string(),
		status: v.union(
			v.literal("inbox"),
			v.literal("assigned"),
			v.literal("in_progress"),
			v.literal("review"),
			v.literal("done"),
			v.literal("archived"),
		),
		assigneeIds: v.array(v.id("agents")),
		tags: v.array(v.string()),
		borderColor: v.optional(v.string()),
		sessionKey: v.optional(v.string()),
		openclawRunId: v.optional(v.string()),
		startedAt: v.optional(v.number()),
		usedCodingTools: v.optional(v.boolean()),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	}).index("by_tenant", ["tenantId"]),
	messages: defineTable({
		taskId: v.id("tasks"),
		fromAgentId: v.id("agents"),
		content: v.string(),
		attachments: v.array(v.id("documents")),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_task", ["tenantId", "taskId"]),
	activities: defineTable({
		type: v.string(),
		agentId: v.id("agents"),
		message: v.string(),
		targetId: v.optional(v.id("tasks")),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_target", ["tenantId", "targetId"]),
	documents: defineTable({
		title: v.string(),
		content: v.string(),
		type: v.string(),
		path: v.optional(v.string()),
		taskId: v.optional(v.id("tasks")),
		createdByAgentId: v.optional(v.id("agents")),
		messageId: v.optional(v.id("messages")),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_task", ["tenantId", "taskId"]),
	notifications: defineTable({
		mentionedAgentId: v.id("agents"),
		content: v.string(),
		delivered: v.boolean(),
		orgId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	}),
	apiTokens: defineTable({
		tokenHash: v.string(),
		tokenPrefix: v.string(),
		tenantId: v.optional(v.string()),
		orgId: v.optional(v.string()),
		name: v.optional(v.string()),
		createdAt: v.number(),
		lastUsedAt: v.optional(v.number()),
		revokedAt: v.optional(v.number()),
	})
		.index("by_tokenHash", ["tokenHash"])
		.index("by_tenant", ["tenantId"]),
	tenantSettings: defineTable({
		tenantId: v.string(),
		retentionDays: v.number(),
		onboardingCompletedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_tenant", ["tenantId"]),
	rateLimits: defineTable({
		tenantId: v.optional(v.string()),
		orgId: v.optional(v.string()),
		windowStartMs: v.number(),
		count: v.number(),
	}).index("by_tenant", ["tenantId"]),
	arbPaperTrades: defineTable({
		tradeType: v.optional(
			v.union(
				v.literal("spread"),
				v.literal("complement_lock"),
				v.literal("market_making"),
			),
		),
		pairName: v.string(),
		makerExchange: v.string(),
		takerExchange: v.string(),
		polySide: v.string(),
		lmtsSide: v.string(),
		makerPrice: v.number(),
		takerPrice: v.number(),
		viableSize: v.number(),
		netProfit: v.number(),
		polyBookSnapshot: v.array(
			v.object({ price: v.string(), size: v.string() }),
		),
		lmtsBookSnapshot: v.array(
			v.object({ price: v.string(), size: v.string() }),
		),
		tokenId: v.string(),
		lmtsSlug: v.string(),
		lmtsOutcomeIndex: v.number(),
		timestamp: v.string(),
		epochMs: v.number(),
		status: v.union(
			v.literal("PAPER_FILL"),
			v.literal("PAPER_TIMEOUT"),
			v.literal("PAPER_FOK_FAILED"),
			v.literal("RESOLVED_WIN"),
			v.literal("RESOLVED_LOSS"),
		),
		confidence: v.optional(v.union(v.literal("HIGH"), v.literal("LOW"))),
		resolvedAt: v.optional(v.string()),
		actualPnl: v.optional(v.number()),
		tenantId: v.optional(v.string()),
		simulation: v.optional(v.any()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_tenant_status", ["tenantId", "status"])
		.index("by_tenant_epochMs", ["tenantId", "epochMs"]),
	arbDaemonStatus: defineTable({
		tenantId: v.string(),
		running: v.boolean(),
		mode: v.string(),
		leaderLabel: v.optional(v.string()),
		marketTitle: v.optional(v.string()),
		processCount: v.number(),
		pid: v.optional(v.number()),
		startedAt: v.optional(v.number()),
		lastHeartbeatAt: v.number(),
		event: v.string(),
	}).index("by_tenant", ["tenantId"]),
	walletIngestorStatus: defineTable({
		tenantId: v.string(),
		running: v.boolean(),
		pid: v.optional(v.number()),
		walletCount: v.number(),
		tradeCount: v.number(),
		lastHeartbeatAt: v.number(),
		status: v.string(), // "active", "idle", "error"
	}).index("by_tenant", ["tenantId"]),
	copyTradePositions: defineTable({
		tenantId: v.string(),
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
		peakPrice: v.number(),
		exitPrice: v.optional(v.number()),
		exitTimestamp: v.optional(v.number()),
		exitReason: v.optional(v.string()),
		pnl: v.optional(v.number()),
		mode: v.string(),
		leaderLabel: v.optional(v.string()),
		marketTitle: v.optional(v.string()),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_position_id", ["positionId"]),
	copyTradeDaemonStatus: defineTable({
		tenantId: v.string(),
		running: v.boolean(),
		pid: v.optional(v.number()),
		mode: v.string(),
		leaderLabel: v.optional(v.string()),
		marketTitle: v.optional(v.string()), // "PAPER" | "LIVE"
		bankroll: v.number(),
		openPositions: v.number(),
		totalPaperPnl: v.number(),
		status: v.string(), // "starting" | "active" | "idle" | "error" | "stopped"
		lastHeartbeatAt: v.number(),
	}).index("by_tenant", ["tenantId"]),
	polymarketPositions: defineTable({
		walletAddress: v.string(),
		balanceUsdc: v.number(),
		openOrders: v.optional(
			v.array(
				v.object({
					id: v.string(),
					status: v.string(),
					market: v.string(),
					marketQuestion: v.string(),
					marketSlug: v.string(),
					assetId: v.string(),
					outcome: v.string(),
					side: v.string(),
					originalSize: v.number(),
					sizeMatched: v.number(),
					sizeRemaining: v.number(),
					price: v.number(),
					orderType: v.string(),
					createdAt: v.number(),
					expiration: v.optional(v.number()),
				}),
			),
		),
		positions: v.array(
			v.object({
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
				isOpen: v.optional(v.boolean()),
				winner: v.optional(v.boolean()),
			}),
		),
		trades: v.array(
			v.object({
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
			}),
		),
		totalInvested: v.number(),
		totalCurrentValue: v.number(),
		totalPnl: v.number(),
		lastSyncedAt: v.number(),
		tenantId: v.optional(v.string()),
	}).index("by_tenant", ["tenantId"]),
	tokenUsage: defineTable({
		agentId: v.optional(v.id("agents")),
		agentName: v.string(),
		skillName: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		totalTokens: v.number(),
		timestamp: v.number(),
		runId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	})
		.index("by_tenant_timestamp", ["tenantId", "timestamp"])
		.index("by_agent_timestamp", ["agentId", "timestamp"])
		.index("by_agent_skill", ["agentName", "skillName"]),
	wallets: defineTable({
		address: v.string(),
		username: v.optional(v.string()),
		totalPnl: v.number(),
		performanceScore: v.number(),
		winRate: v.optional(v.union(v.number(), v.null())),
		tradeCount: v.optional(v.union(v.number(), v.null())),
		firstTradeAt: v.optional(v.union(v.string(), v.null())),
		isInsider: v.boolean(),
		lastSyncedAt: v.number(),
		tags: v.array(v.string()),
		tenantId: v.optional(v.string()),
		// Copy-Trading Score (CTS) fields
		copyTradingScore: v.optional(v.number()),
		ctsConsistency: v.optional(v.number()),
		ctsWinRate: v.optional(v.number()),
		pnl7d: v.optional(v.number()),
		pnl30d: v.optional(v.number()),
		pnl90d: v.optional(v.number()),
		maxDrawdownPct: v.optional(v.number()),
		profitableWeeksRatio: v.optional(v.number()),
		computedWinRate: v.optional(v.number()),
		})
		.index("by_tenant", ["tenantId"])
		.index("by_address", ["address"])
		.index("by_pnl", ["totalPnl"])
		.index("by_score", ["performanceScore"])
		.index("by_cts", ["copyTradingScore"])
		.index("by_tenant_cts", ["tenantId", "copyTradingScore"])
		.index("by_tenant_insider", ["tenantId", "isInsider"]),
		experiments: defineTable({
		        tenantId: v.string(),
		        experimentId: v.string(), // "seed_04_pnl_hold_resolution"
		        hypothesis: v.string(),
		        status: v.string(), // "pending" | "completed" | "error" | "milestone"
		        completedAt: v.optional(v.string()),
		        durationSeconds: v.optional(v.number()),
		        frozenParams: v.optional(v.any()),
		        bestTrial: v.optional(
		                v.object({
		                        number: v.number(),
		                        params: v.any(),
		                        train: v.any(),
		                        validate: v.optional(v.any()),
		                        test: v.optional(v.any()),
		                }),
		        ),		        summary: v.optional(
		                v.object({
		                        total_trials: v.number(),
		                        completed_trials: v.number(),
		                        pruned_trials: v.number(),
		                }),
		        ),
		        error: v.optional(v.union(v.string(), v.null())),
		        lastSyncedAt: v.number(),
		        })		        .index("by_tenant", ["tenantId"])
		        .index("by_tenant_status", ["tenantId", "status"]),
		});
