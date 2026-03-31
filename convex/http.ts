import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

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
		await ctx.runMutation(api.polymarket.syncPositions, body);
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
		});
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Wallet ingestor status endpoint
http.route({
	path: "/wallet/ingestor-status",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await ctx.runMutation(api.walletIngestor.upsertStatus, {
			tenantId: body.tenant_id ?? "default",
			running: body.running ?? false,
			pid: body.pid,
			walletCount: body.wallet_count ?? 0,
			tradeCount: body.trade_count ?? 0,
			status: body.status ?? "unknown",
		});
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

// Wallet upsert endpoint
http.route({
	path: "/wallet/upsert",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await ctx.runMutation(api.wallets.upsert, {
			address: body.address,
			username: body.username,
			totalPnl: body.totalPnl ?? 0,
			performanceScore: body.performanceScore ?? 0,
			winRate: body.winRate,
			tradeCount: body.tradeCount,
			firstTradeAt: body.firstTradeAt,
			isInsider: body.isInsider ?? false,
			tags: body.tags ?? [],
			tenantId: body.tenantId ?? "default",
			// CTS fields
			copyTradingScore: body.copyTradingScore,
			ctsConsistency: body.ctsConsistency,
			ctsWinRate: body.ctsWinRate,
			pnl7d: body.pnl7d,
			pnl30d: body.pnl30d,
			pnl90d: body.pnl90d,
			maxDrawdownPct: body.maxDrawdownPct,
			profitableWeeksRatio: body.profitableWeeksRatio,
			computedWinRate: body.computedWinRate,
		});
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});
// Token telemetry endpoint
http.route({
	path: "/telemetry/tokens",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await request.json();
		await ctx.runMutation(api.tokens.logTokenUsage, {
			agentId: body.agentId,
			agentName: body.agentName,
			skillName: body.skillName,
			inputTokens: body.inputTokens ?? 0,
			outputTokens: body.outputTokens ?? 0,
			totalTokens: body.totalTokens ?? body.inputTokens + body.outputTokens,
			runId: body.runId,
			tenantId: body.tenantId ?? "default",
		});
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

export default http;
