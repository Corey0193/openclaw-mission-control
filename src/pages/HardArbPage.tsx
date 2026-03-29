import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import Header from "../components/Header";
import {
	IconArrowsExchange,
	IconChartBar,
	IconPercentage,
	IconTrendingUp,
	IconTrendingDown,
	IconShieldCheck,
	IconAlertTriangle,
	IconChevronDown,
} from "@tabler/icons-react";
import {
	ResponsiveContainer,
	AreaChart,
	Area,
	BarChart,
	Bar,
	ScatterChart,
	Scatter,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Cell,
} from "recharts";
import type { TooltipContentProps } from "recharts";

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

function timeAgo(isoOrMs: string | number): string {
	const ts =
		typeof isoOrMs === "string" ? new Date(isoOrMs).getTime() : isoOrMs;
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
	isPercent,
}: {
	label: string;
	value: number;
	icon: React.ReactNode;
	isPnl?: boolean;
	isPercent?: boolean;
}) {
	return (
		<div className="flex items-center gap-3 bg-white border border-border rounded-xl px-5 py-4 shadow-sm">
			<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground">
				{icon}
			</div>
			<div>
				<div className="text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
					{label}
				</div>
				<div className="text-lg font-bold text-foreground">
					{isPnl ? (
						<PnlBadge value={value} />
					) : isPercent ? (
						`${value.toFixed(1)}%`
					) : (
						value
					)}
				</div>
			</div>
		</div>
	);
}

// --- Chart tooltip components ---

type ChartTooltipProps = Partial<TooltipContentProps<number, string>>;

function PnlTooltip({ active, payload, label }: ChartTooltipProps) {
	if (!active || !payload?.length) return null;
	return (
		<div className="bg-white border border-border rounded-lg px-3 py-2 shadow-sm text-xs">
			<div className="text-muted-foreground mb-1">{label}</div>
			{payload.map((item) => (
				<div key={item.dataKey as string} className="font-semibold">
					{item.name}: {formatPnl(Number(item.value ?? 0))}
				</div>
			))}
		</div>
	);
}

function PairTooltip({ active, payload }: ChartTooltipProps) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as {
		pair: string;
		profit: number;
		count: number;
	};
	return (
		<div className="bg-white border border-border rounded-lg px-3 py-2 shadow-sm text-xs">
			<div className="font-medium mb-1 max-w-[200px] truncate">{d.pair}</div>
			<div className="text-muted-foreground">
				{d.count} trade{d.count !== 1 ? "s" : ""}
			</div>
			<div className="font-semibold">{formatPnl(d.profit)}</div>
		</div>
	);
}

function ScatterTooltip({ active, payload }: ChartTooltipProps) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as {
		viableSize: number;
		netProfit: number;
		makerExchange: string;
		pairName: string;
	};
	return (
		<div className="bg-white border border-border rounded-lg px-3 py-2 shadow-sm text-xs">
			<div className="font-medium mb-1 max-w-[200px] truncate">
				{d.pairName}
			</div>
			<div className="text-muted-foreground">Maker: {d.makerExchange}</div>
			<div className="text-muted-foreground">
				Size: {(Number(d.viableSize) || 0).toFixed(1)} shares
			</div>
			<div className="font-semibold">{formatPnl(d.netProfit)}</div>
		</div>
	);
}

// --- Chart data hooks ---

type PaperTrade = Doc<"arbPaperTrades">;
type StrategyTradeType = "spread" | "complement_lock" | "market_making";

function getTradeType(trade: PaperTrade): StrategyTradeType {
	if (
		trade.tradeType === "spread" ||
		trade.tradeType === "complement_lock" ||
		trade.tradeType === "market_making"
	) {
		return trade.tradeType;
	}

	// Older Mission Control rows did not persist strategy type. Market-making
	// fills arrive without book snapshots, while hard-arb rows include them.
	if (trade.polyBookSnapshot.length === 0 && trade.lmtsBookSnapshot.length === 0) {
		return "market_making";
	}

	return "spread";
}

function formatTradeTypeLabel(tradeType: StrategyTradeType): string {
	if (tradeType === "complement_lock") return "Complement Lock";
	if (tradeType === "market_making") return "Market Making";
	return "Spread";
}

function summarizePaperTrades(trades: PaperTrade[]) {
	let totalTrades = 0;
	let projectedOpenPnl = 0;
	let realizedPnl = 0;
	let wins = 0;
	let losses = 0;

	for (const t of trades) {
		totalTrades++;
		if (t.status === "PAPER_FILL") {
			projectedOpenPnl += t.netProfit;
		} else if (t.status === "RESOLVED_WIN") {
			wins++;
			realizedPnl += t.actualPnl ?? t.netProfit;
		} else if (t.status === "RESOLVED_LOSS") {
			losses++;
			realizedPnl += t.actualPnl ?? 0;
		}
	}

	const resolvedCount = wins + losses;
	const winRate = resolvedCount > 0 ? (wins / resolvedCount) * 100 : 0;
	return {
		totalTrades,
		projectedOpenPnl: Math.round(projectedOpenPnl * 100) / 100,
		realizedPnl: Math.round(realizedPnl * 100) / 100,
		totalPaperPnl: Math.round((projectedOpenPnl + realizedPnl) * 100) / 100,
		wins,
		losses,
		winRate: Math.round(winRate * 10) / 10,
	};
}

function useCumulativePnlData(trades: PaperTrade[]) {
	return useMemo(() => {
		const sorted = [...trades].sort((a, b) => a.epochMs - b.epochMs);
		return sorted.reduce<
			Array<{
				date: string;
				projectedPnl: number;
				realizedPnl: number;
				totalPnl: number;
			}>
		>((acc, t) => {
			const prev =
				acc.length > 0
					? acc[acc.length - 1]
					: { projectedPnl: 0, realizedPnl: 0, totalPnl: 0 };
			const realizedPnl =
				t.status === "RESOLVED_WIN" || t.status === "RESOLVED_LOSS"
					? (t.actualPnl ?? 0)
					: 0;
			const projectedPnl = t.status === "PAPER_FILL" ? t.netProfit : 0;
			acc.push({
				date: new Date(t.epochMs).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
				}),
				projectedPnl:
					Math.round((prev.projectedPnl + projectedPnl) * 100) / 100,
				realizedPnl: Math.round((prev.realizedPnl + realizedPnl) * 100) / 100,
				totalPnl:
					Math.round((prev.totalPnl + projectedPnl + realizedPnl) * 100) / 100,
			});
			return acc;
		}, []);
	}, [trades]);
}

function useProfitByPairData(trades: PaperTrade[]) {
	return useMemo(() => {
		const map = new Map<string, { profit: number; count: number }>();
		for (const t of trades) {
			const existing = map.get(t.pairName);
			if (existing) {
				existing.profit += t.netProfit;
				existing.count++;
			} else {
				map.set(t.pairName, { profit: t.netProfit, count: 1 });
			}
		}
		return Array.from(map.entries())
			.map(([pair, { profit, count }]) => ({
				pair,
				profit: Math.round(profit * 100) / 100,
				count,
			}))
			.sort((a, b) => b.profit - a.profit)
			.slice(0, 10);
	}, [trades]);
}

function useScatterData(trades: PaperTrade[]) {
	return useMemo(() => {
		return trades.map((t) => ({
			viableSize: t.viableSize,
			netProfit: Math.round(t.netProfit * 100) / 100,
			makerExchange: t.makerExchange,
			pairName: t.pairName,
		}));
	}, [trades]);
}

export default function HardArbPage() {
	const trades = useQuery(api.arbPaperTrades.listPaperTrades, {
		tenantId: DEFAULT_TENANT_ID,
	});
	const daemonStatus = useQuery(api.arbDaemon.getDaemonStatus, {
		tenantId: DEFAULT_TENANT_ID,
	});

	const [hardArbOpen, setHardArbOpen] = useState(true);
	const [showLowConf, setShowLowConf] = useState(false);
	const [nowMs, setNowMs] = useState(0);

	useEffect(() => {
		const updateNow = () => setNowMs(Date.now());
		updateNow();
		const intervalId = window.setInterval(updateNow, 30_000);
		return () => window.clearInterval(intervalId);
	}, []);

	const allTrades = useMemo(() => trades ?? [], [trades]);

	const filteredTrades = useMemo(
		() =>
			showLowConf
				? allTrades
				: allTrades.filter((t) => (t.confidence ?? "HIGH") === "HIGH"),
		[allTrades, showLowConf],
	);
	const hardArbTrades = useMemo(
		() => filteredTrades.filter((t) => getTradeType(t) !== "market_making"),
		[filteredTrades],
	);
	const marketMakingTrades = useMemo(
		() => filteredTrades.filter((t) => getTradeType(t) === "market_making"),
		[filteredTrades],
	);

	const unresolvedTrades = useMemo(
		() => hardArbTrades.filter((t) => t.status === "PAPER_FILL"),
		[hardArbTrades],
	);
	const resolvedTrades = useMemo(
		() =>
			hardArbTrades
				.filter(
					(t) => t.status === "RESOLVED_WIN" || t.status === "RESOLVED_LOSS",
				)
				.sort((a, b) => b.epochMs - a.epochMs),
		[hardArbTrades],
	);
	const failedTrades = useMemo(
		() =>
			hardArbTrades
				.filter(
					(t) =>
						t.status === "PAPER_TIMEOUT" || t.status === "PAPER_FOK_FAILED",
				)
				.sort((a, b) => b.epochMs - a.epochMs),
		[hardArbTrades],
	);

	const pnlData = useCumulativePnlData(hardArbTrades);
	const pairData = useProfitByPairData(hardArbTrades);
	const scatterData = useScatterData(hardArbTrades);

	const summary = useMemo(() => summarizePaperTrades(hardArbTrades), [hardArbTrades]);
	const marketMakingSummary = useMemo(
		() => summarizePaperTrades(marketMakingTrades),
		[marketMakingTrades],
	);
	const daemonHeartbeatStale =
		daemonStatus !== null &&
		daemonStatus !== undefined &&
		nowMs > 0 &&
		nowMs - daemonStatus.lastHeartbeatAt > 2 * 60 * 1000;
	const staleHeartbeatLabel = daemonStatus
		? timeAgo(daemonStatus.lastHeartbeatAt)
		: "";

	const summaryCards = useMemo(() => {
		return [
			{
				label: "Hard Arb Signals",
				value: summary.totalTrades,
				icon: <IconArrowsExchange size={20} />,
			},
			{
				label: "Open Paper Edge",
				value: summary.projectedOpenPnl,
				icon: <IconTrendingUp size={20} />,
				isPnl: true,
			},
			{
				label: "Realized P&L",
				value: summary.realizedPnl,
				icon: <IconChartBar size={20} />,
				isPnl: true,
			},
			{
				label: "Total Paper P&L",
				value: summary.totalPaperPnl,
				icon: <IconPercentage size={20} />,
				isPnl: true,
			},
		];
	}, [summary]);
	const marketMakingCards = useMemo(() => {
		if (marketMakingSummary.totalTrades === 0) return [];
		return [
			{
				label: "MM Paper Fills",
				value: marketMakingSummary.totalTrades,
				icon: <IconArrowsExchange size={20} />,
			},
			{
				label: "MM Open Paper P&L",
				value: marketMakingSummary.projectedOpenPnl,
				icon: <IconTrendingUp size={20} />,
				isPnl: true,
			},
			{
				label: "MM Total Paper P&L",
				value: marketMakingSummary.totalPaperPnl,
				icon: <IconChartBar size={20} />,
				isPnl: true,
			},
		];
	}, [marketMakingSummary]);

	return (
		<div className="h-screen bg-[#f8f9fa] overflow-y-auto">
			<Header />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
				{/* Page title */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm">
							<IconArrowsExchange size={22} />
						</div>
						<div>
							<h2 className="text-xl font-bold text-foreground tracking-tight leading-none mb-1">
								Hard Arbitrage
							</h2>
							<p className="text-xs text-muted-foreground font-medium">
								Mechanical Cross-Market Arb
							</p>
						</div>
					</div>
				</div>

				<section className="rounded-2xl border border-blue-100 bg-blue-50/30 p-5 shadow-sm">
					<button
						type="button"
						onClick={() => setHardArbOpen((v) => !v)}
						className="flex items-center gap-3 text-left w-full group focus:outline-none"
					>
						<div className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-200">
							<IconChevronDown
								size={14}
								className={`transition-transform duration-200 ${hardArbOpen ? "" : "-rotate-90"}`}
							/>
						</div>
						<div className="flex items-center gap-2">
							<h3 className="text-sm font-bold text-blue-900 tracking-wide uppercase">
								Paper Trades
							</h3>
							<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-blue-600 text-white shadow-sm">
								SIMULATED
							</span>
						</div>
					</button>

					{hardArbOpen && (
						<div className="mt-4 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
							{trades === undefined ? (
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
									{[...Array(4)].map((_, i) => (
										<div
											key={`hard-skeleton-${i}`}
											className="h-24 bg-white border border-border rounded-2xl animate-pulse"
										/>
									))}
								</div>
							) : allTrades.length === 0 ? (
								<div className="bg-white border border-border rounded-2xl p-12 text-center shadow-sm">
									<div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
										<IconArrowsExchange
											size={32}
											className="text-muted-foreground opacity-40"
										/>
									</div>
									<p className="font-semibold text-foreground">
										No trades identified yet
									</p>
									<p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
										The arb-engine is active and scanning for cross-market
										opportunities.
									</p>
								</div>
							) : (
								<div className="space-y-8">
									{hardArbTrades.length === 0 && marketMakingTrades.length > 0 && (
										<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
											No hard-arb paper trades are in this filtered view yet.
											Market-making fills are tracked separately below and no
											longer count toward the hard-arb headline metrics.
										</div>
									)}

									{/* Confidence filter toggle */}
									<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-white border border-border rounded-xl shadow-sm">
										<button
											type="button"
											onClick={() => setShowLowConf((v) => !v)}
											className={`flex-shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm ${
												showLowConf
													? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
													: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
											}`}
										>
											{showLowConf ? (
												<IconAlertTriangle size={16} />
											) : (
												<IconShieldCheck size={16} />
											)}
											{showLowConf
												? "Showing All Trades"
												: "High-Confidence Only"}
										</button>
										<div className="flex items-center gap-2">
											<div
												className={`p-1 rounded-full ${showLowConf ? "bg-amber-100" : "bg-emerald-100"}`}
											>
												<div
													className={`w-1.5 h-1.5 rounded-full ${showLowConf ? "bg-amber-500" : "bg-emerald-500"}`}
												/>
											</div>
											<p className="text-xs text-muted-foreground font-medium leading-snug">
												{showLowConf
													? "Historical data includes trades where API latency or low liquidity may have impacted execution."
													: "Currently filtering for optimal conditions where API health and market depth were verified."}
											</p>
										</div>
									</div>

									{/* Summary cards */}
									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
										{summaryCards.map((card) => (
											<SummaryCard key={card.label} {...card} />
										))}
									</div>

									{marketMakingCards.length > 0 && (
										<section className="space-y-3">
											<div className="flex items-center gap-2">
												<div className="w-1 h-4 bg-slate-400 rounded-full" />
												<h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
													Market Making Paper
												</h3>
											</div>
											<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
												{marketMakingCards.map((card) => (
													<SummaryCard key={card.label} {...card} />
												))}
											</div>
										</section>
									)}

									<div className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
										<div>
											<div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
												Paper Mode Status
											</div>
												<div className="text-sm font-semibold text-slate-900">
													{daemonHeartbeatStale
														? `Daemon heartbeat stale (${staleHeartbeatLabel})`
														: daemonStatus?.running
														? daemonStatus.mode === "live"
														? "Daemon connected in LIVE mode"
														: "Daemon connected in PAPER mode"
													: "Using paper-trade history from Mission Control"}
											</div>
										</div>
										<div className="text-xs text-muted-foreground">
											Headline hard-arb totals exclude market making. Open
											paper edge is still simulated until settlement updates
											actual P&L.
										</div>
									</div>

									{/* Historical Performance Charts */}
									<section className="space-y-4">
										<div className="flex items-center gap-2">
											<div className="w-1 h-4 bg-blue-600 rounded-full" />
											<h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
												Performance Analytics
											</h3>
										</div>
										<div className="grid grid-cols-1 gap-6">
											{/* Chart A: Cumulative P&L */}
											<div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
												<div className="flex items-center justify-between mb-6">
													<div className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
														Hard-Arb Paper Equity Curve (USD)
													</div>
													<div className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
														OPEN + REALIZED
													</div>
												</div>
												<div className="w-full h-[300px]">
													{pnlData.length > 0 ? (
														<ResponsiveContainer width="100%" height="100%">
															<AreaChart
																data={pnlData}
																margin={{
																	top: 10,
																	right: 10,
																	left: 0,
																	bottom: 0,
																}}
															>
																<defs>
																	<linearGradient
																		id="totalPnlGradient"
																		x1="0"
																		y1="0"
																		x2="0"
																		y2="1"
																	>
																		<stop
																			offset="5%"
																			stopColor="#2563eb"
																			stopOpacity={0.12}
																		/>
																		<stop
																			offset="95%"
																			stopColor="#2563eb"
																			stopOpacity={0}
																		/>
																	</linearGradient>
																</defs>
																<CartesianGrid
																	strokeDasharray="3 3"
																	vertical={false}
																	stroke="#f1f5f9"
																/>
																<XAxis
																	dataKey="date"
																	tick={{
																		fontSize: 10,
																		fill: "#94a3b8",
																		fontWeight: 500,
																	}}
																	axisLine={false}
																	tickLine={false}
																	dy={10}
																/>
																<YAxis
																	tick={{
																		fontSize: 10,
																		fill: "#94a3b8",
																		fontWeight: 500,
																	}}
																	axisLine={false}
																	tickLine={false}
																	tickFormatter={(v) => `$${v}`}
																/>
																<Tooltip
																	content={<PnlTooltip />}
																	cursor={{ stroke: "#2563eb", strokeWidth: 1 }}
																/>
																<Area
																	type="monotone"
																	dataKey="totalPnl"
																	name="Total paper"
																	stroke="#2563eb"
																	strokeWidth={2.5}
																	fill="url(#totalPnlGradient)"
																	animationDuration={1000}
																/>
																<Area
																	type="monotone"
																	dataKey="projectedPnl"
																	name="Open paper"
																	stroke="#f59e0b"
																	strokeWidth={2}
																	fillOpacity={0}
																	animationDuration={1000}
																/>
																<Area
																	type="monotone"
																	dataKey="realizedPnl"
																	name="Realized"
																	stroke="#10b981"
																	strokeWidth={2}
																	fillOpacity={0}
																	animationDuration={1000}
																/>
															</AreaChart>
														</ResponsiveContainer>
													) : (
														<div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
															<IconChartBar
																size={32}
																className="mb-2 opacity-20"
															/>
															No paper trades available for chart
														</div>
													)}
												</div>
											</div>

											{/* Charts B & C side by side */}
											<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
												{/* Chart B: Profit by Market Pair */}
												<div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
													<div className="text-xs font-bold text-muted-foreground tracking-widest uppercase mb-6">
														Top Alpha Pairs
													</div>
													<div className="w-full h-[320px]">
														{pairData.length > 0 ? (
															<ResponsiveContainer width="100%" height="100%">
																<BarChart
																	data={pairData}
																	layout="vertical"
																	margin={{
																		left: 0,
																		right: 30,
																		top: 0,
																		bottom: 0,
																	}}
																>
																	<CartesianGrid
																		strokeDasharray="3 3"
																		stroke="#f1f5f9"
																		horizontal={false}
																	/>
																	<XAxis
																		type="number"
																		tick={{
																			fontSize: 10,
																			fill: "#94a3b8",
																			fontWeight: 500,
																		}}
																		tickLine={false}
																		axisLine={false}
																		tickFormatter={(v) => `$${v}`}
																	/>
																	<YAxis
																		type="category"
																		dataKey="pair"
																		tick={{
																			fontSize: 10,
																			fill: "#64748b",
																			fontWeight: 600,
																		}}
																		tickLine={false}
																		axisLine={false}
																		width={100}
																	/>
																	<Tooltip
																		content={<PairTooltip />}
																		cursor={{ fill: "#f8fafc" }}
																	/>
																	<Bar
																		dataKey="profit"
																		radius={[0, 6, 6, 0]}
																		barSize={20}
																	>
																		{pairData.map((entry) => (
																			<Cell
																				key={`bar-${entry.pair}`}
																				fill={
																					entry.profit >= 0
																						? "#10b981"
																						: "#ef4444"
																				}
																			/>
																		))}
																	</Bar>
																</BarChart>
															</ResponsiveContainer>
														) : (
															<div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
																<IconChartBar
																	size={32}
																	className="mb-2 opacity-20"
																/>
																No paper trades available for chart
															</div>
														)}
													</div>
												</div>

												{/* Chart C: Size vs Profit Scatter */}
												<div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
													<div className="flex items-center justify-between mb-6">
														<div className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
															Scale vs. Efficiency
														</div>
														<div className="flex items-center gap-3">
															<div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase">
																<span className="w-2 h-2 rounded-full bg-blue-500" />
																Poly
															</div>
															<div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase">
																<span className="w-2 h-2 rounded-full bg-amber-500" />
																Other
															</div>
														</div>
													</div>
													<div className="w-full h-[280px]">
														{scatterData.length > 0 ? (
															<ResponsiveContainer width="100%" height="100%">
																<ScatterChart
																	margin={{
																		top: 10,
																		right: 10,
																		bottom: 20,
																		left: 0,
																	}}
																>
																	<CartesianGrid
																		strokeDasharray="3 3"
																		stroke="#f1f5f9"
																	/>
																	<XAxis
																		dataKey="viableSize"
																		type="number"
																		name="Size"
																		tick={{ fontSize: 10, fill: "#94a3b8" }}
																		tickLine={false}
																		axisLine={false}
																		label={{
																			value: "Size (Shares)",
																			position: "bottom",
																			offset: 0,
																			fontSize: 9,
																			fontWeight: 700,
																			fill: "#94a3b8",
																		}}
																	/>
																	<YAxis
																		dataKey="netProfit"
																		type="number"
																		name="Profit"
																		tick={{ fontSize: 10, fill: "#94a3b8" }}
																		tickLine={false}
																		axisLine={false}
																		tickFormatter={(v) => `$${v}`}
																	/>
																	<Tooltip content={<ScatterTooltip />} />
																	<Scatter data={scatterData}>
																		{scatterData.map((entry, idx) => (
																			<Cell
																				key={`scatter-${entry.pairName}-${idx}`}
																				fill={
																					entry.makerExchange === "polymarket"
																						? "#3b82f6"
																						: "#f59e0b"
																				}
																				fillOpacity={0.6}
																				strokeWidth={1}
																				stroke={
																					entry.makerExchange === "polymarket"
																						? "#2563eb"
																						: "#d97706"
																				}
																			/>
																		))}
																	</Scatter>
																</ScatterChart>
															</ResponsiveContainer>
														) : (
															<div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
																<IconChartBar
																	size={32}
																	className="mb-2 opacity-20"
																/>
																No paper trades available for chart
															</div>
														)}
													</div>
												</div>
											</div>
										</div>
									</section>

									{/* Unresolved trades */}
									<section className="space-y-4">
										<div className="flex items-center gap-2">
											<div className="w-1 h-4 bg-amber-500 rounded-full" />
											<h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
												Unresolved Positions
												{unresolvedTrades.length > 0 && (
													<span className="ml-2 text-muted-foreground font-medium normal-case">
														({unresolvedTrades.length})
													</span>
												)}
											</h3>
										</div>
										{unresolvedTrades.length === 0 ? (
											<div className="bg-white border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-sm">
												No active paper positions
											</div>
										) : (
											<div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
												<div className="overflow-x-auto">
													<table className="w-full text-sm">
														<thead>
															<tr className="bg-slate-50/50 border-b border-border text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
																<th className="text-left px-6 py-4">Time</th>
																<th className="text-left px-4 py-4">Pair</th>
																<th className="text-left px-4 py-4">
																	Structure
																</th>
																<th className="text-right px-4 py-4">
																	Execution
																</th>
																<th className="text-right px-4 py-4">Size</th>
																<th className="text-right px-4 py-4">Alpha</th>
																<th className="text-center px-6 py-4">Conf.</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-border/50">
															{unresolvedTrades.map((t) => (
																<tr
																	key={t._id}
																	className="hover:bg-slate-50/30 transition-colors"
																>
																	<td className="px-6 py-4 text-muted-foreground tabular-nums whitespace-nowrap text-xs font-medium">
																		{timeAgo(t.timestamp)}
																	</td>
																	<td className="px-4 py-4 font-bold text-slate-900 max-w-[220px] truncate">
																		<div className="max-w-[220px] truncate">
																			{t.pairName}
																		</div>
																		<div className="mt-1 text-[10px] font-bold tracking-wide uppercase text-muted-foreground">
																			{formatTradeTypeLabel(getTradeType(t))}
																		</div>
																	</td>
																	<td className="px-4 py-4">
																		<div className="flex items-center gap-1.5">
																			<span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
																				{t.makerExchange.toUpperCase()}
																			</span>
																			<span className="text-muted-foreground/40 font-bold">
																				→
																			</span>
																			<span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
																				{t.takerExchange.toUpperCase()}
																			</span>
																		</div>
																	</td>
																	<td className="px-4 py-4 text-right">
																		<div className="text-xs font-bold tabular-nums">
																			${t.makerPrice.toFixed(3)}
																		</div>
																		<div className="text-[10px] text-muted-foreground font-medium">
																			vs ${t.takerPrice.toFixed(3)}
																		</div>
																	</td>
																	<td className="px-4 py-4 text-right tabular-nums font-bold text-slate-700">
																		{t.viableSize.toFixed(1)}
																	</td>
																	<td className="px-4 py-4 text-right">
																		<PnlBadge value={t.netProfit} />
																	</td>
																	<td className="px-6 py-4 text-center">
																		{(t.confidence ?? "HIGH") === "HIGH" ? (
																			<span
																				className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700"
																				title="Optimal: Validated depth & low latency"
																			>
																				<IconShieldCheck size={12} />
																			</span>
																		) : (
																			<span
																				className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700"
																				title="Suboptimal: API or timing warnings"
																			>
																				<IconAlertTriangle size={12} />
																			</span>
																		)}
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											</div>
										)}
									</section>

									{/* Resolved trades */}
									{resolvedTrades.length > 0 && (
										<section className="space-y-4">
											<div className="flex items-center gap-2">
												<div className="w-1 h-4 bg-emerald-500 rounded-full" />
												<h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
													Resolved History
													<span className="ml-2 text-muted-foreground font-medium normal-case">
														({resolvedTrades.length})
													</span>
												</h3>
											</div>
											<div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
												<div className="overflow-x-auto">
													<table className="w-full text-sm">
														<thead>
															<tr className="bg-slate-50/50 border-b border-border text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
																<th className="text-left px-6 py-4">
																	Resolved
																</th>
																<th className="text-left px-4 py-4">Pair</th>
																<th className="text-left px-4 py-4">
																	Maker/Taker
																</th>
																<th className="text-right px-4 py-4">Size</th>
																<th className="text-right px-4 py-4">
																	Expected
																</th>
																<th className="text-center px-4 py-4">
																	Result
																</th>
																<th className="text-right px-6 py-4">
																	Actual P&L
																</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-border/50">
															{resolvedTrades.map((t) => (
																<tr
																	key={t._id}
																	className="hover:bg-slate-50/30 transition-colors"
																>
																	<td className="px-6 py-4 text-muted-foreground tabular-nums text-xs font-medium">
																		{t.resolvedAt
																			? timeAgo(t.resolvedAt)
																			: timeAgo(t.timestamp)}
																	</td>
																	<td className="px-4 py-4 font-bold text-slate-900 max-w-[220px] truncate">
																		<div className="max-w-[220px] truncate">
																			{t.pairName}
																		</div>
																		<div className="mt-1 text-[10px] font-bold tracking-wide uppercase text-muted-foreground">
																			{formatTradeTypeLabel(getTradeType(t))}
																		</div>
																	</td>
																	<td className="px-4 py-4">
																		<div className="flex items-center gap-1.5">
																			<span className="text-[10px] font-bold text-blue-600 uppercase">
																				{t.makerExchange.substring(0, 4)}
																			</span>
																			<span className="text-muted-foreground/30">
																				/
																			</span>
																			<span className="text-[10px] font-bold text-amber-600 uppercase">
																				{t.takerExchange.substring(0, 4)}
																			</span>
																		</div>
																	</td>
																	<td className="px-4 py-4 text-right tabular-nums font-medium text-slate-600">
																		{t.viableSize.toFixed(1)}
																	</td>
																	<td className="px-4 py-4 text-right tabular-nums text-muted-foreground">
																		{formatPnl(t.netProfit)}
																	</td>
																	<td className="px-4 py-4 text-center">
																		{t.status === "RESOLVED_WIN" ? (
																			<span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
																				WIN
																			</span>
																		) : (
																			<span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
																				LOSS
																			</span>
																		)}
																	</td>
																	<td className="px-6 py-4 text-right">
																		<PnlBadge value={t.actualPnl ?? 0} />
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											</div>
										</section>
									)}

									{/* Failed trades */}
									{failedTrades.length > 0 && (
										<section className="space-y-4">
											<div className="flex items-center gap-2">
												<div className="w-1 h-4 bg-red-500 rounded-full" />
												<h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
													Failed / Timed Out
													<span className="ml-2 text-muted-foreground font-medium normal-case">
														({failedTrades.length})
													</span>
												</h3>
											</div>
											<div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden opacity-80">
												<div className="overflow-x-auto">
													<table className="w-full text-sm">
														<thead>
															<tr className="bg-slate-50/50 border-b border-border text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
																<th className="text-left px-6 py-4">Time</th>
																<th className="text-left px-4 py-4">Pair</th>
																<th className="text-left px-4 py-4">
																	Maker/Taker
																</th>
																<th className="text-right px-4 py-4">Size</th>
																<th className="text-right px-4 py-4">
																	Expected
																</th>
																<th className="text-center px-6 py-4">
																	Status
																</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-border/50">
															{failedTrades.map((t) => (
																<tr
																	key={t._id}
																	className="hover:bg-slate-50/30 transition-colors"
																>
																	<td className="px-6 py-4 text-muted-foreground tabular-nums text-xs font-medium">
																		{timeAgo(t.timestamp)}
																	</td>
																	<td className="px-4 py-4 font-bold text-slate-900 max-w-[220px] truncate">
																		<div className="max-w-[220px] truncate">
																			{t.pairName}
																		</div>
																		<div className="mt-1 text-[10px] font-bold tracking-wide uppercase text-muted-foreground">
																			{formatTradeTypeLabel(getTradeType(t))}
																		</div>
																	</td>
																	<td className="px-4 py-4">
																		<div className="flex items-center gap-1.5">
																			<span className="text-[10px] font-bold text-blue-600 uppercase">
																				{t.makerExchange.substring(0, 4)}
																			</span>
																			<span className="text-muted-foreground/30">
																				/
																			</span>
																			<span className="text-[10px] font-bold text-amber-600 uppercase">
																				{t.takerExchange.substring(0, 4)}
																			</span>
																		</div>
																	</td>
																	<td className="px-4 py-4 text-right tabular-nums font-medium text-slate-600">
																		{t.viableSize.toFixed(1)}
																	</td>
																	<td className="px-4 py-4 text-right tabular-nums text-muted-foreground">
																		{formatPnl(t.netProfit)}
																	</td>
																	<td className="px-6 py-4 text-center">
																		<span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
																			{t.status.replace("PAPER_", "")}
																		</span>
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											</div>
										</section>
									)}
								</div>
							)}
						</div>
					)}
				</section>
			</main>
		</div>
	);
}
