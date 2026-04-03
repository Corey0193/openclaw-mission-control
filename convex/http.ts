import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

async function upsertWalletIngestorStatus(ctx: any, body: any) {
	await ctx.runMutation(api.walletIngestor.upsertStatus, {
		tenantId: body.tenant_id ?? "default",
		running: body.running ?? false,
		pid: body.pid,
		walletCount: body.wallet_count ?? 0,
		tradeCount: body.trade_count ?? 0,
		status: body.status ?? "unknown",
	});
}

async function upsertWallet(ctx: any, body: any) {
	await ctx.runMutation(api.wallets.upsert, {
		address: String(body.address ?? ""),
		username:
			body.username != null && body.username !== ""
				? String(body.username)
				: undefined,
		totalPnl: Number(body.totalPnl ?? body.total_pnl ?? 0),
		performanceScore: Number(
			body.performanceScore ?? body.performance_score ?? 0,
		),
		winRate:
			body.winRate != null
				? Number(body.winRate)
				: body.win_rate != null
					? Number(body.win_rate)
					: undefined,
		tradeCount:
			body.tradeCount != null
				? Number(body.tradeCount)
				: body.trade_count != null
					? Number(body.trade_count)
					: undefined,
		firstTradeAt:
			body.firstTradeAt != null
				? String(body.firstTradeAt)
				: body.first_trade_at != null
					? String(body.first_trade_at)
					: undefined,
		isInsider: Boolean(body.isInsider ?? body.is_insider ?? false),
		tags: Array.isArray(body.tags)
			? body.tags.map((tag: unknown) => String(tag))
			: [],
		tenantId: body.tenantId ?? body.tenant_id ?? "default",
		copyTradingScore:
			body.copyTradingScore != null
				? Number(body.copyTradingScore)
				: body.copy_trading_score != null
					? Number(body.copy_trading_score)
					: undefined,
		ctsConsistency:
			body.ctsConsistency != null
				? Number(body.ctsConsistency)
				: body.cts_consistency != null
					? Number(body.cts_consistency)
					: undefined,
		ctsWinRate:
			body.ctsWinRate != null
				? Number(body.ctsWinRate)
				: body.cts_win_rate != null
					? Number(body.cts_win_rate)
					: undefined,
		pnl7d:
			body.pnl7d != null
				? Number(body.pnl7d)
				: body.pnl_7d != null
					? Number(body.pnl_7d)
					: undefined,
		pnl30d:
			body.pnl30d != null
				? Number(body.pnl30d)
				: body.pnl_30d != null
					? Number(body.pnl_30d)
					: undefined,
		pnl90d:
			body.pnl90d != null
				? Number(body.pnl90d)
				: body.pnl_90d != null
					? Number(body.pnl_90d)
					: undefined,
		maxDrawdownPct:
			body.maxDrawdownPct != null
				? Number(body.maxDrawdownPct)
				: body.max_drawdown_pct != null
					? Number(body.max_drawdown_pct)
					: undefined,
		profitableWeeksRatio:
			body.profitableWeeksRatio != null
				? Number(body.profitableWeeksRatio)
				: body.profitable_weeks_ratio != null
					? Number(body.profitable_weeks_ratio)
					: undefined,
		computedWinRate:
			body.computedWinRate != null
				? Number(body.computedWinRate)
				: body.computed_win_rate != null
					? Number(body.computed_win_rate)
					: undefined,
	});
}

// OpenClaw webhook endpoint
http.route({
	path: "/openclaw/event",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await ctx.runMutation(api.openclaw.receiveAgentEvent, body);
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Polymarket position sync endpoint
http.route({
	path: "/polymarket/sync",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await ctx.runMutation(api.polymarket.syncPositions, {
			walletAddress: String(body.walletAddress ?? body.wallet_address ?? ""),
			balanceUsdc: Number(body.balanceUsdc ?? body.balance_usdc ?? 0),
			openOrders: (body.openOrders ?? body.open_orders ?? []).map(
				(order: Record<string, unknown>) => ({
					id: String(order.id ?? ""),
					status: String(order.status ?? "LIVE"),
					market: String(order.market ?? ""),
					marketQuestion: String(
						order.marketQuestion ?? order.market_question ?? "",
					),
					marketSlug: String(order.marketSlug ?? order.market_slug ?? ""),
					assetId: String(order.assetId ?? order.asset_id ?? ""),
					outcome: String(order.outcome ?? ""),
					side: String(order.side ?? ""),
					originalSize: Number(
						order.originalSize ?? order.original_size ?? 0,
					),
					sizeMatched: Number(order.sizeMatched ?? order.size_matched ?? 0),
					sizeRemaining: Number(
						order.sizeRemaining ?? order.size_remaining ?? 0,
					),
					price: Number(order.price ?? 0),
					orderType: String(order.orderType ?? order.order_type ?? ""),
					createdAt: Number(order.createdAt ?? order.created_at ?? Date.now()),
					...(order.expiration != null && order.expiration !== ""
						? { expiration: Number(order.expiration) }
						: {}),
				}),
			),
			positions: (body.positions ?? []).map((position: Record<string, unknown>) => ({
				market: String(position.market ?? ""),
				marketQuestion: String(
					position.marketQuestion ?? position.market_question ?? "",
				),
				marketSlug: String(position.marketSlug ?? position.market_slug ?? ""),
				outcome: String(position.outcome ?? ""),
				shares: Number(position.shares ?? 0),
				entryPrice: Number(position.entryPrice ?? position.entry_price ?? 0),
				currentPrice: Number(
					position.currentPrice ?? position.current_price ?? 0,
				),
				costBasis: Number(position.costBasis ?? position.cost_basis ?? 0),
				currentValue: Number(
					position.currentValue ?? position.current_value ?? 0,
				),
				payout: Number(position.payout ?? 0),
				unrealizedPnl: Number(
					position.unrealizedPnl ?? position.unrealized_pnl ?? 0,
				),
				marketClosed: Boolean(
					position.marketClosed ?? position.market_closed ?? false,
				),
				marketResolved: Boolean(
					position.marketResolved ?? position.market_resolved ?? false,
				),
				...(position.winner != null
					? { winner: Boolean(position.winner) }
					: {}),
			})),
			trades: (body.trades ?? []).map((trade: Record<string, unknown>) => ({
				id: String(trade.id ?? ""),
				market: String(trade.market ?? ""),
				marketQuestion: String(
					trade.marketQuestion ?? trade.market_question ?? "",
				),
				side: String(trade.side ?? ""),
				outcome: String(trade.outcome ?? ""),
				shares: Number(trade.shares ?? 0),
				price: Number(trade.price ?? 0),
				cost: Number(trade.cost ?? 0),
				payout: Number(trade.payout ?? 0),
				timestamp: Number(trade.timestamp ?? 0),
				status: String(trade.status ?? "CONFIRMED"),
				...(trade.txHash != null || trade.tx_hash != null
					? { txHash: String(trade.txHash ?? trade.tx_hash) }
					: {}),
			})),
			totalInvested: Number(body.totalInvested ?? body.total_invested ?? 0),
			totalCurrentValue: Number(
				body.totalCurrentValue ?? body.total_current_value ?? 0,
			),
			totalPnl: Number(body.totalPnl ?? body.total_pnl ?? 0),
			lastSyncedAt: Number(body.lastSyncedAt ?? body.last_synced_at ?? Date.now()),
			tenantId: String(body.tenantId ?? body.tenant_id ?? "default"),
		});
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Arb paper trade endpoint
http.route({
	path: "/arb/paper-trade",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();

		let makerPrice = body.maker_price ?? 0;
		let takerPrice = body.taker_price ?? 0;
		let viableSize = body.viable_size ?? 0;
		let netProfit = body.net_profit ?? 0;
		let makerExchange = body.maker_exchange ?? "";
		let takerExchange = body.taker_exchange ?? "";
		let polySide = body.poly_side ?? "";
		let lmtsSide = body.lmts_side ?? "";
		let tradeType: "spread" | "complement_lock" | "market_making" = "spread";

		// Handle different trade types from arb-engine
		if (body.type === "complement_lock") {
			tradeType = "complement_lock";
			makerPrice = body.yes_price ?? 0;
			takerPrice = body.no_price ?? 0;
			viableSize = body.viable_size ?? 0;
			netProfit = body.net_profit ?? 0;
			makerExchange = body.yes_exchange ?? "";
			takerExchange = body.no_exchange ?? "";
			polySide = "BUY";
			lmtsSide = "BUY";
		} else if (body.type === "market_making") {
			tradeType = "market_making";
			makerPrice = body.fill_price ?? 0;
			takerPrice = body.hedge_price ?? 0;
			viableSize = body.fill_size ?? 0;
			netProfit = body.pnl_per_fill ?? 0;
			makerExchange = "limitless";
			takerExchange = "polymarket";
			lmtsSide = body.mm_side === "BID" ? "BUY" : "SELL";
			polySide = body.hedge_side === "BUY" ? "BUY" : "SELL";
		}

		await ctx.runMutation(api.arbPaperTrades.insertPaperTrade, {
			tradeType,
			pairName: body.pair_name ?? "",
			makerExchange,
			takerExchange,
			polySide,
			lmtsSide,
			makerPrice,
			takerPrice,
			viableSize,
			netProfit,
			polyBookSnapshot: body.poly_book_snapshot ?? [],
			lmtsBookSnapshot: body.lmts_book_snapshot ?? [],
			tokenId: body.token_id ?? body.poly_token_id ?? "",
			lmtsSlug: body.lmts_slug ?? "",
			lmtsOutcomeIndex: body.lmts_outcome_index ?? 0,
			timestamp: body.timestamp ?? new Date().toISOString(),
			epochMs: body.epoch_ms ?? Date.now(),
			confidence: body.confidence === "LOW" ? "LOW" : "HIGH",
			tenantId: body.tenant_id ?? "default",
			status: body.status ?? "PAPER_FILL",
			simulation: body.simulation ?? {},
		});
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});
// Clear all paper trades endpoint
http.route({
	path: "/arb/clear-trades",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		const tenantId = body.tenant_id ?? "default";
		const count = await ctx.runMutation(
			api.arbPaperTrades.clearAllPaperTrades,
			{
				tenantId,
			},
		);
		return new Response(JSON.stringify({ ok: true, deleted: count }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Arb daemon status endpoint
http.route({
	path: "/arb/daemon-status",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await ctx.runMutation(api.arbDaemon.upsertDaemonStatus, {
			tenantId: body.tenant_id ?? "default",
			running: body.running ?? false,
			mode: body.mode ?? "unknown",
			processCount: body.process_count ?? 0,
			pid: body.pid,
			event: body.event ?? "heartbeat",
			canary: body.canary,
		});
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Copy-trade daemon status endpoint
http.route({
	path: "/copy-trade/status",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await ctx.runMutation(api.copyTrade.upsertStatus, {
			tenantId: body.tenant_id ?? "default",
			running: body.running ?? false,
			pid: body.pid,
			mode: body.mode ?? "PAPER",
			bankroll: body.bankroll ?? 0,
			openPositions: body.open_positions ?? 0,
			totalPaperPnl: body.total_paper_pnl ?? 0,
			status: body.status ?? "unknown",
			leaderLabel: body.leader_label != null ? String(body.leader_label) : undefined,
			marketTitle: body.market_title != null ? String(body.market_title) : undefined,
		});
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Copy-trade positions sync endpoint
http.route({
	path: "/copy-trade/sync-positions",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		console.log("SYNC DEBUG: Received", (body.positions ?? []).length, "positions");
		const positions = (body.positions ?? []).map((p: Record<string, any>) => ({
			positionId: String(p.position_id),
			leaderAddress: String(p.leader_address),
			marketId: String(p.market_id),
			tokenId: String(p.token_id),
			outcomeIndex: Number(p.outcome_index),
			shares: Number(p.shares),
			entryPrice: Number(p.entry_price),
			leaderEntryPrice: Number(p.leader_entry_price),
			entryUsd: Number(p.entry_usd),
			entryTimestamp: Number(p.entry_timestamp),
			peakPrice: Number(p.peak_price),
			currentPrice: p.current_price != null ? Number(p.current_price) : undefined,
			stopLossPrice: p.stop_loss_price != null ? Number(p.stop_loss_price) : undefined,
			takeProfitPrice: p.take_profit_price != null ? Number(p.take_profit_price) : undefined,
			exitStrategy: p.exit_strategy != null ? String(p.exit_strategy) : undefined,
			timeLimitAt: p.time_limit_at != null ? Number(p.time_limit_at) : undefined,
			exitPrice: p.exit_price != null ? Number(p.exit_price) : undefined,
			exitTimestamp: p.exit_timestamp != null ? Number(p.exit_timestamp) : undefined,
			exitReason:
				typeof p.exit_reason === "string"
					? p.exit_reason
					: p.exit_reason != null
						? JSON.stringify(p.exit_reason)
						: undefined,
			pnl: p.pnl != null ? Number(p.pnl) : undefined,
			mode: String(p.mode ?? "PAPER"),
			leaderLabel: p.leader_label != null ? String(p.leader_label) : undefined,
			marketTitle: p.market_title != null ? String(p.market_title) : undefined,
		}));
		if (positions.length > 0) {
			console.log("SYNC DEBUG: Calling syncPositions for", positions.length, "mapped positions");
			await ctx.runMutation(api.copyTrade.syncPositions, {
				tenantId: String(body.tenant_id ?? "default"),
				positions,
			});
		}
		return new Response(JSON.stringify({ ok: true, synced: positions.length }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Wallet ingestor status endpoint
http.route({
	path: "/wallet-ingestor/status",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await upsertWalletIngestorStatus(ctx, body);
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Backward-compatible alias used by existing wallet_ingestor.py deployments.
http.route({
	path: "/wallet/ingestor-status",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await upsertWalletIngestorStatus(ctx, body);
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Backward-compatible wallet sync endpoint used by existing sync scripts.
http.route({
	path: "/wallet/upsert",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await upsertWallet(ctx, body);
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

export default http;
