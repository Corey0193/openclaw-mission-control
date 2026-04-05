import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import {
	IconChartBar,
	IconExternalLink,
	IconRefresh,
	IconTrendingUp,
	IconTrendingDown,
	IconCoin,
} from "@tabler/icons-react";

function formatUsd(n: number): string {
	return n.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
	});
}

function formatPnl(n: number): string {
	const sign = n >= 0 ? "+" : "";
	return sign + formatUsd(n);
}

function timeAgo(ts: number): string {
	const diffMs = Date.now() - ts;
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

function PnlBadge({ value }: { value: number }) {
	const isPositive = value >= 0;
	return (
		<span
			className={`inline-flex items-center gap-1 font-semibold ${
				isPositive ? "text-emerald-600" : "text-red-500"
			}`}
		>
			{isPositive ? (
				<IconTrendingUp size={14} />
			) : (
				<IconTrendingDown size={14} />
			)}
			{formatPnl(value)}
		</span>
	);
}

function SummaryCard({
	label,
	value,
	icon,
	isPnl,
}: {
	label: string;
	value: number;
	icon: React.ReactNode;
	isPnl?: boolean;
}) {
	return (
		<div className="flex items-center gap-3 bg-white border border-border rounded-xl px-5 py-4">
			<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground">
				{icon}
			</div>
			<div>
				<div className="text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
					{label}
				</div>
				<div className="text-lg font-bold text-foreground">
					{isPnl ? <PnlBadge value={value} /> : formatUsd(value)}
				</div>
			</div>
		</div>
	);
}

interface PolymarketPosition {
	market: string;
	marketQuestion: string;
	marketSlug: string;
	outcome: string;
	shares: number;
	entryPrice: number;
	currentPrice: number;
	costBasis: number;
	currentValue: number;
	payout: number;
	unrealizedPnl: number;
	marketClosed: boolean;
	marketResolved: boolean;
	winner?: boolean;
}

interface PolymarketTrade {
	id: string;
	market: string;
	marketQuestion: string;
	side: string;
	outcome: string;
	shares: number;
	price: number;
	cost: number;
	payout: number;
	timestamp: number;
	txHash?: string;
	status: string;
}

interface PolymarketOpenOrder {
	id: string;
	status: string;
	market: string;
	marketQuestion: string;
	marketSlug: string;
	assetId: string;
	outcome: string;
	side: string;
	originalSize: number;
	sizeMatched: number;
	sizeRemaining: number;
	price: number;
	orderType: string;
	createdAt: number;
	expiration?: number;
}

interface PolymarketData {
	reportStatus: string;
	marketFetchFailures: number;
	lastSyncedAt: number;
	openOrders: PolymarketOpenOrder[];
	positions: PolymarketPosition[];
	trades: PolymarketTrade[];
	totalInvested: number;
	totalCurrentValue: number;
	totalPnl: number;
}

interface SoftArbTruthTrade {
	trade_id: string;
	pair: string;
	signal_family: string;
	signal_source: string;
	direction: string;
	entry_price: number;
	position_size_usd: number;
	shares: number;
	opened_at: string;
	resolves_by: string;
	polymarket_slug: string;
	event_slug?: string | null;
	status: string;
	settlement_state?: string | null;
	current_price: number | null;
	unrealized_pnl: number | null;
	realized_pnl: number | null;
	resolved_outcome: string | null;
	resolved_at?: string | null;
	claimed_at?: string | null;
	gross_payout?: number | null;
	fees_paid?: number | null;
	net_realized_pnl?: number | null;
	evidence_source?: string | null;
	tx_hash?: string | null;
	avg_entry_price?: number | null;
	entry_cost?: number | null;
	event_slug: string | null;
	is_real: boolean;
	order_id: string | null;
	order_status: string | null;
	mark_source: string;
	truth_status?: string | null;
}

interface SoftArbTruthSnapshot {
	trades: SoftArbTruthTrade[];
	summary: {
		total_trades?: number;
		total_invested?: number;
		total_unrealized_pnl?: number;
		total_realized_pnl?: number;
		win_rate?: number;
		open_positions?: number;
		claimable_positions?: number;
		claimed_positions?: number;
		closed_losses?: number;
		canceled_positions?: number;
		report_status?: string;
		market_fetch_failures?: number;
		[key: string]: unknown;
	};
	lastUpdated?: string | null;
}

function PolymarketOrderBadge({
	status,
}: {
	status: string;
}) {
	const normalized = status.trim().toUpperCase();
	const cls =
		normalized === "LIVE"
			? "bg-blue-100 text-blue-700"
			: normalized === "MATCHED"
				? "bg-emerald-100 text-emerald-700"
				: normalized === "UNMATCHED"
					? "bg-amber-100 text-amber-700"
					: "bg-slate-100 text-slate-600";
	return (
		<span
			className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}
		>
			{normalized || "LIVE"}
		</span>
	);
}

function PolymarketSideBadge({ side }: { side: string }) {
	const normalized = side.trim().toUpperCase();
	const cls =
		normalized === "BUY"
			? "bg-emerald-100 text-emerald-700"
			: normalized === "SELL"
				? "bg-amber-100 text-amber-700"
				: "bg-slate-100 text-slate-600";
	return (
		<span
			className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}
		>
			{normalized || "---"}
		</span>
	);
}

function isTruthyStatus(status: string | null | undefined): boolean {
	const normalized = String(status ?? "").trim().toUpperCase();
	return normalized === "OPEN" || normalized === "POSTED" || normalized === "PARTIAL_FILL";
}

function normalizeOutcome(direction: string): string {
	const normalized = direction.trim().toUpperCase();
	if (normalized.includes("NO")) return "No";
	return "Yes";
}

function normalizeSide(direction: string): string {
	const normalized = direction.trim().toUpperCase();
	if (normalized.includes("SELL")) return "SELL";
	return "BUY";
}

function formatRemainingSize(n: number): string {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	});
}

function formatOrderAge(ts: number): string {
	const diffMs = Date.now() - ts;
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

function parseIsoTs(value: string | null | undefined): number {
	if (!value) return 0;
	const ts = Date.parse(value);
	return Number.isFinite(ts) ? ts : 0;
}

function mapTruthToPolymarketData(snapshot: SoftArbTruthSnapshot): PolymarketData {
	const trades = snapshot.trades ?? [];
	const positions = trades.map((trade) => {
		const currentPrice = Number(
			trade.current_price ?? trade.entry_price ?? 0,
		);
		const shares = Number(trade.shares ?? 0);
		const entryPrice = Number(trade.entry_price ?? 0);
		const costBasis = Number(
			trade.entry_cost ?? trade.position_size_usd ?? shares * entryPrice,
		);
		const currentValue = Number((shares * currentPrice).toFixed(2));
		const payout = Number(
			(
				trade.gross_payout ??
				(trade.resolved_outcome === "WIN" ? shares : 0) ??
				0
			).toFixed(2),
		);
		const unrealizedPnl =
			trade.unrealized_pnl != null
				? Number(trade.unrealized_pnl)
				: Number((currentValue - costBasis).toFixed(2));
		const marketResolved = Boolean(
			trade.resolved_at ||
				trade.claimed_at ||
				[
					"PAYOUT_CLAIMABLE",
					"PAYOUT_CLAIMED",
					"CLOSED_LOSS",
					"CLOSED_CONVERGED",
					"ORDER_CANCELED",
				].includes(
					String(trade.settlement_state ?? trade.status ?? "").toUpperCase(),
				),
		);
		return {
			market: trade.event_slug || trade.polymarket_slug || trade.trade_id,
			marketQuestion: trade.pair || trade.event_slug || trade.polymarket_slug || trade.trade_id,
			marketSlug: trade.event_slug || trade.polymarket_slug || trade.trade_id,
			outcome: normalizeOutcome(trade.direction),
			shares,
			entryPrice,
			currentPrice,
			costBasis,
			currentValue,
			payout,
			unrealizedPnl,
			marketClosed: marketResolved,
			marketResolved,
			winner:
				trade.resolved_outcome === "WIN"
					? true
					: trade.resolved_outcome === "LOSS"
						? false
						: undefined,
		};
	});

	const openOrders = trades
		.filter((trade) => isTruthyStatus(trade.status))
		.map((trade) => {
			const shares = Number(trade.shares ?? 0);
			return {
				id: trade.order_id || trade.trade_id,
				status: "LIVE",
				market: trade.event_slug || trade.polymarket_slug || trade.trade_id,
				marketQuestion: trade.pair || trade.event_slug || trade.polymarket_slug || trade.trade_id,
				marketSlug: trade.event_slug || trade.polymarket_slug || trade.trade_id,
				assetId: trade.trade_id,
				outcome: normalizeOutcome(trade.direction),
				side: normalizeSide(trade.direction),
				originalSize: shares,
				sizeMatched: 0,
				sizeRemaining: shares,
				price: Number(trade.entry_price ?? 0),
				orderType: String(trade.mark_source ?? "truth"),
				createdAt: parseIsoTs(trade.opened_at),
				expiration: parseIsoTs(trade.resolves_by) || undefined,
			};
		});

	const derivedTrades = trades
		.map((trade) => ({
			id: trade.trade_id,
			market: trade.event_slug || trade.polymarket_slug || trade.trade_id,
			marketQuestion: trade.pair || trade.event_slug || trade.polymarket_slug || trade.trade_id,
			side: normalizeSide(trade.direction),
			outcome: normalizeOutcome(trade.direction),
			shares: Number(trade.shares ?? 0),
			price: Number(trade.entry_price ?? 0),
			cost: Number(trade.entry_cost ?? trade.position_size_usd ?? 0),
			payout: Number(trade.gross_payout ?? 0),
			timestamp: parseIsoTs(
				trade.resolved_at ?? trade.claimed_at ?? trade.opened_at,
			),
			txHash: trade.tx_hash ?? undefined,
			status:
				String(trade.settlement_state ?? trade.status ?? trade.order_status ?? "").toUpperCase() ||
				"OPEN",
			settlementState: trade.settlement_state ?? null,
			markSource: trade.mark_source,
			truthStatus: trade.truth_status ?? null,
		}))
		.sort((a, b) => b.timestamp - a.timestamp);

	const totalInvested =
		Number(snapshot.summary.total_invested ?? 0) ||
		Math.round(
			positions.reduce((sum, position) => sum + position.costBasis, 0) * 100,
		) / 100;
	const totalCurrentValue = Math.round(
		positions.reduce((sum, position) => sum + position.currentValue, 0) * 100,
	) / 100;
	const totalPnl = Math.round(
		Number(
			(snapshot.summary.total_realized_pnl ?? 0) +
				(snapshot.summary.total_unrealized_pnl ?? 0),
		) * 100,
	) / 100;

	return {
		reportStatus: String(snapshot.summary.report_status ?? "ok"),
		marketFetchFailures: Number(snapshot.summary.market_fetch_failures ?? 0),
		lastSyncedAt: parseIsoTs(snapshot.lastUpdated ?? null),
		openOrders,
		positions,
		trades: derivedTrades,
		totalInvested,
		totalCurrentValue,
		totalPnl,
	};
}

function usePolymarketTruth() {
	const [data, setData] = useState<PolymarketData | null>(null);
	const refresh = useCallback(async () => {
		try {
			const res = await fetch("/api/soft-arb/trades");
			const contentType = res.headers.get("content-type") ?? "";
			if (!res.ok) {
				throw new Error(`soft arb truth request failed (${res.status})`);
			}
			if (!contentType.includes("application/json")) {
				const body = (await res.text()).slice(0, 120);
				throw new Error(`soft arb truth returned non-JSON: ${body}`);
			}
			const json = (await res.json()) as SoftArbTruthSnapshot;
			setData(mapTruthToPolymarketData(json));
		} catch (err) {
			console.error("Failed to fetch Polymarket truth snapshot:", err);
		}
	}, []);

	useEffect(() => {
		refresh();
		const interval = setInterval(refresh, 30000);
		return () => clearInterval(interval);
	}, [refresh]);

	return { data, refresh };
}

export default function PolymarketPage() {
	const { data, refresh: refreshPolymarket } = usePolymarketTruth();
	const [isRefreshing, setIsRefreshing] = useState(false);

	const handleRefresh = () => {
		if (isRefreshing) return;
		setIsRefreshing(true);
		void refreshPolymarket().finally(() => {
			setTimeout(() => setIsRefreshing(false), 1500);
		});
	};

	const openPositions = useMemo(
		() =>
			data?.positions.filter((p) => !p.marketResolved && p.shares > 0) ?? [],
		[data?.positions],
	);
	const openOrders = useMemo(() => data?.openOrders ?? [], [data?.openOrders]);
	const closedMarkets = useMemo(
		() =>
			new Set(
				(data?.positions ?? [])
					.filter((p) => p.marketResolved)
					.map((p) => p.market),
			),
		[data?.positions],
	);
	const cutoff = new Date("2026-01-01").getTime();
	const recentTrades = useMemo(
		() =>
			(data?.trades ?? [])
				.filter((t) => t.timestamp >= cutoff)
				.sort((a, b) => b.timestamp - a.timestamp),
		[data?.trades, cutoff],
	);
	const recentMarkets = useMemo(
		() => new Set(recentTrades.map((t) => t.market)),
		[recentTrades],
	);
	const resolvedPositions = useMemo(
		() =>
			(data?.positions ?? []).filter(
				(p) => p.marketResolved && recentMarkets.has(p.market),
			),
		[data?.positions, recentMarkets],
	);

	return (
		<div className="org-page bg-[#f8f9fa]">
			<Header />
			<main className="[grid-area:content] overflow-auto">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
					{/* Page title */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-orange)] text-white">
								<IconChartBar size={20} />
							</div>
							<div>
								<h2 className="text-lg font-bold text-foreground tracking-tight">
									Polymarket Truth
								</h2>
								<p className="text-[11px] text-muted-foreground">
									Hustle truth snapshot, not legacy Convex positions
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{data && (
								<span
									className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
										data.reportStatus.toUpperCase() === "DEGRADED"
											? "bg-amber-100 text-amber-800 border-amber-200"
											: "bg-emerald-100 text-emerald-800 border-emerald-200"
									}`}
								>
									Truth {data.reportStatus.toUpperCase()}
									{data.marketFetchFailures > 0
										? ` · ${data.marketFetchFailures} fetch failure${data.marketFetchFailures === 1 ? "" : "s"}`
										: ""}
								</span>
							)}
							{data && (
							<button
								type="button"
								onClick={handleRefresh}
								disabled={isRefreshing}
								className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
							>
								<IconRefresh
									size={14}
									className={isRefreshing ? "animate-spin" : ""}
								/>
								{isRefreshing
									? "Refreshing..."
									: `Snapshot: ${timeAgo(data.lastSyncedAt)}`}
							</button>
							)}
						</div>
					</div>

					{!data ? (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{[...Array(4)].map((_, i) => (
								<div
									key={i}
									className="h-20 bg-white border border-border rounded-xl animate-pulse"
								/>
							))}
						</div>
					) : (
						<>
							{/* Summary cards */}
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<SummaryCard
									label="Tracked Trades"
									value={data.trades.length}
									icon={<IconChartBar size={20} />}
								/>
								<SummaryCard
									label="Invested"
									value={data.totalInvested}
									icon={<IconCoin size={20} />}
								/>
								<SummaryCard
									label="Current Value"
									value={data.totalCurrentValue}
									icon={<IconTrendingUp size={20} />}
								/>
								<SummaryCard
									label="P&L"
									value={data.totalPnl}
									icon={<IconChartBar size={20} />}
									isPnl
								/>
							</div>

							{/* Open orders */}
							<section>
								<div className="mb-3 flex items-center gap-2">
									<h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
										Pending Orders
										{openOrders.length > 0 && (
											<span className="ml-2 text-muted-foreground font-normal normal-case">
												({openOrders.length})
											</span>
										)}
									</h3>
								</div>
								<p className="mb-3 text-xs text-muted-foreground">
									Orders inferred from the truth snapshot. If the snapshot is
									degraded, this table is still explicitly labeled as such.
								</p>
								{openOrders.length === 0 ? (
									<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
										No open orders found
									</div>
								) : (
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Placed</th>
													<th className="text-left px-3 py-3">Market</th>
													<th className="text-left px-3 py-3">Side</th>
													<th className="text-left px-3 py-3">Outcome</th>
													<th className="text-right px-3 py-3">Price</th>
													<th className="text-right px-3 py-3">Remaining</th>
													<th className="text-right px-3 py-3">Matched</th>
													<th className="text-right px-4 py-3">Status</th>
												</tr>
											</thead>
											<tbody>
						{openOrders.map((order, i) => (
													<tr
														key={order.id}
														className={
															i < openOrders.length - 1
																? "border-b border-border/50"
																: ""
														}
													>
														<td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
															{formatOrderAge(order.createdAt)}
														</td>
														<td className="px-3 py-3 max-w-[260px]">
															{order.marketSlug ? (
																<a
																	href={`https://polymarket.com/event/${order.marketSlug}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-foreground hover:text-[var(--accent-orange)] transition-colors font-medium flex items-center gap-1"
																>
																	<span className="truncate">
																		{order.marketQuestion}
																	</span>
																	<IconExternalLink
																		size={12}
																		className="shrink-0 opacity-40"
																	/>
																</a>
															) : (
																<span className="font-medium text-foreground">
																	{order.marketQuestion}
																</span>
															)}
														</td>
														<td className="px-3 py-3">
															<PolymarketSideBadge side={order.side} />
														</td>
														<td className="px-3 py-3">
															<span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-slate-100 text-slate-600">
																{order.outcome.toUpperCase()}
															</span>
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															${order.price.toFixed(3)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums font-medium">
															{formatRemainingSize(order.sizeRemaining)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															{formatRemainingSize(order.sizeMatched)}
														</td>
														<td className="text-right px-4 py-3">
															<PolymarketOrderBadge status={order.status} />
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</section>

							{/* Open positions */}
							<section>
								<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
									Open Positions
									{openPositions.length > 0 && (
										<span className="ml-2 text-muted-foreground font-normal normal-case">
											({openPositions.length})
										</span>
									)}
								</h3>
								{openPositions.length === 0 ? (
									<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
										No open positions
									</div>
								) : (
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Market</th>
													<th className="text-left px-3 py-3">Outcome</th>
													<th className="text-right px-3 py-3">Shares</th>
													<th className="text-right px-3 py-3">Entry</th>
													<th className="text-right px-3 py-3">Current</th>
													<th className="text-right px-3 py-3">Cost</th>
													<th className="text-right px-3 py-3">Value</th>
													<th className="text-right px-3 py-3">
														Payout (if wins)
													</th>
													<th className="text-right px-4 py-3">P&L</th>
												</tr>
											</thead>
											<tbody>
												{openPositions.map((p, i) => (
													<tr
														key={`${p.market}-${p.outcome}`}
														className={
															i < openPositions.length - 1
																? "border-b border-border/50"
																: ""
														}
													>
														<td className="px-4 py-3 max-w-[260px]">
															<a
																href={`https://polymarket.com/event/${p.marketSlug}`}
																target="_blank"
																rel="noopener noreferrer"
																className="text-foreground hover:text-[var(--accent-orange)] transition-colors font-medium flex items-center gap-1"
															>
																<span className="truncate">
																	{p.marketQuestion}
																</span>
																<IconExternalLink
																	size={12}
																	className="shrink-0 opacity-40"
																/>
															</a>
														</td>
														<td className="px-3 py-3">
															<span
																className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
																	p.outcome === "Yes"
																		? "bg-emerald-100 text-emerald-700"
																		: "bg-red-100 text-red-600"
																}`}
															>
																{p.outcome.toUpperCase()}
															</span>
														</td>
														<td className="text-right px-3 py-3 tabular-nums font-medium">
															{p.shares.toFixed(1)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															${p.entryPrice.toFixed(2)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															${p.currentPrice.toFixed(2)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.costBasis)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.currentValue)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums font-medium text-blue-600">
															{formatUsd(p.payout)}
														</td>
														<td className="text-right px-4 py-3 tabular-nums">
															<PnlBadge value={p.unrealizedPnl} />
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</section>

							{/* Resolved positions */}
							{resolvedPositions.length > 0 && (
								<section>
									<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
										Resolved
										<span className="ml-2 text-muted-foreground font-normal normal-case">
											({resolvedPositions.length})
										</span>
									</h3>
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Market</th>
													<th className="text-left px-3 py-3">Outcome</th>
													<th className="text-right px-3 py-3">Shares</th>
													<th className="text-right px-3 py-3">Cost</th>
													<th className="text-right px-3 py-3">Payout</th>
													<th className="text-right px-3 py-3">Result</th>
													<th className="text-right px-4 py-3">P&L</th>
												</tr>
											</thead>
											<tbody>
												{resolvedPositions.map((p, i) => (
													<tr
														key={`${p.market}-${p.outcome}`}
														className={
															i < resolvedPositions.length - 1
																? "border-b border-border/50"
																: ""
														}
													>
														<td className="px-4 py-3 max-w-[260px] text-muted-foreground">
															<span className="truncate block">
																{p.marketQuestion}
															</span>
														</td>
														<td className="px-3 py-3">
															<span
																className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
																	p.outcome === "Yes"
																		? "bg-emerald-100 text-emerald-700"
																		: "bg-red-100 text-red-600"
																}`}
															>
																{p.outcome.toUpperCase()}
															</span>
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{p.shares.toFixed(1)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.costBasis)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.payout)}
														</td>
														<td className="text-right px-3 py-3">
															{p.winner === true ? (
																<span className="text-emerald-600 font-bold">
																	WIN
																</span>
															) : p.winner === false ? (
																<span className="text-red-500 font-bold">
																	LOSS
																</span>
															) : (
																<span className="text-muted-foreground">
																	--
																</span>
															)}
														</td>
														<td className="text-right px-4 py-3 tabular-nums">
															<PnlBadge
																value={
																	p.winner === true
																		? p.payout - p.costBasis
																		: p.winner === false
																			? -p.costBasis
																			: p.unrealizedPnl
																}
															/>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</section>
							)}
							{/* Trade history */}
							<section>
								<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
									Trade History
									{data.trades.length > 0 && (
										<span className="ml-2 text-muted-foreground font-normal normal-case">
											({data.trades.length})
										</span>
									)}
								</h3>
								{data.trades.length === 0 ? (
									<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
										No trades recorded
									</div>
								) : (
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Date</th>
													<th className="text-left px-3 py-3">Market</th>
													<th className="text-left px-3 py-3">Side</th>
													<th className="text-left px-3 py-3">Outcome</th>
													<th className="text-right px-3 py-3">Shares</th>
													<th className="text-right px-3 py-3">Price</th>
													<th className="text-right px-3 py-3">Cost</th>
													<th className="text-right px-3 py-3">
														Payout (if wins)
													</th>
													<th className="text-right px-4 py-3">Status</th>
												</tr>
											</thead>
											<tbody>
												{recentTrades.map((t, i) => {
													const isClosed = closedMarkets.has(t.market);
													return (
														<tr
															key={t.id}
															className={`${
																i < recentTrades.length - 1
																	? "border-b border-border/50"
																	: ""
															}${isClosed ? " opacity-40" : ""}`}
														>
															<td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
																{new Date(t.timestamp).toLocaleDateString(
																	"en-US",
																	{
																		month: "short",
																		day: "numeric",
																		hour: "2-digit",
																		minute: "2-digit",
																	},
																)}
															</td>
															<td className="px-3 py-3 max-w-[200px]">
																<span
																	className={`truncate block ${isClosed ? "text-muted-foreground" : "font-medium"}`}
																>
																	{t.marketQuestion}
																</span>
															</td>
															<td className="px-3 py-3">
																<span
																	className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
																		isClosed
																			? "bg-gray-100 text-gray-500"
																			: t.side === "BUY"
																				? "bg-emerald-100 text-emerald-700"
																				: "bg-amber-100 text-amber-700"
																	}`}
																>
																	{t.side}
																</span>
															</td>
															<td className="px-3 py-3">
																<span
																	className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
																		isClosed
																			? "bg-gray-100 text-gray-500"
																			: t.outcome === "Yes"
																				? "bg-emerald-100 text-emerald-700"
																				: "bg-red-100 text-red-600"
																	}`}
																>
																	{t.outcome.toUpperCase()}
																</span>
															</td>
															<td className="text-right px-3 py-3 tabular-nums">
																{t.shares.toFixed(1)}
															</td>
															<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
																${t.price.toFixed(2)}
															</td>
															<td className="text-right px-3 py-3 tabular-nums">
																{formatUsd(t.cost)}
															</td>
															<td
																className={`text-right px-3 py-3 tabular-nums ${isClosed ? "text-muted-foreground" : "text-blue-600"}`}
															>
															{formatUsd(t.payout)}
														</td>
														<td className="text-right px-4 py-3">
															<span
																className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
																	t.settlementState === "PAYOUT_CLAIMED"
																		? "bg-emerald-100 text-emerald-700"
																		: t.settlementState === "PAYOUT_CLAIMABLE"
																			? "bg-blue-100 text-blue-700"
																			: t.settlementState === "CLOSED_LOSS"
																				? "bg-red-100 text-red-700"
																				: t.settlementState === "CLOSED_CONVERGED"
																					? "bg-slate-100 text-slate-700"
																				: t.status === "OPEN"
																					? "bg-blue-100 text-blue-700"
																					: "bg-gray-100 text-gray-600"
																}`}
															>
																{t.settlementState ?? t.status}
															</span>
														</td>
													</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</section>
						</>
					)}
				</div>
			</main>
		</div>
	);
}
