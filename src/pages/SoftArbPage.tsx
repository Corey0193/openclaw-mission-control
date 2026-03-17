import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import {
	IconTrendingUp,
	IconTrendingDown,
	IconChevronDown,
	IconChevronRight,
	IconCircleCheck,
	IconCircleX,
	IconLoader2,
	IconScan,
	IconChartBar,
	IconArrowsExchange,
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

function timeAgo(isoOrMs: string | number): string {
	const ts = typeof isoOrMs === "string" ? new Date(isoOrMs).getTime() : isoOrMs;
	const diffMs = Date.now() - ts;
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

function formatPct(n: number | null | undefined, digits = 1): string {
	if (n == null || Number.isNaN(n)) return "---";
	return `${n.toFixed(digits)}%`;
}

function familyLabel(family: string): string {
	return family === "metaculus" ? "Metaculus" : family === "sportsbook" ? "Sportsbook" : family;
}

function PnlBadge({ value }: { value: number | null }) {
	if (value === null) return <span className="text-muted-foreground">---</span>;
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

interface SoftArbTrade {
	trade_id: string;
	pair: string;
	signal_family: string;
	direction: string;
	entry_price: number;
	position_size_usd: number;
	shares: number;
	adjusted_edge_pct: number;
	opened_at: string;
	resolves_by: string;
	polymarket_slug: string;
	metaculus_id: number;
	status: string;
	current_price: number | null;
	unrealized_pnl: number | null;
	realized_pnl: number | null;
	shadow_pnl: number | null;
	ready_to_close: boolean;
	fair_value: number | null;
	exit_price: number | null;
	resolved_outcome: string | null;

	event_slug: string | null;
}

interface SoftArbOutcome {
	timestamp: string;
	opportunity_id: string;
	trade_id: string;
	pair: string;
	signal_family: string;
	signal_source: string;
	direction: string;
	sample_key: string;
	adjusted_edge_pct: number | null;
	pnl_usd: number;
	actual_outcome: string;
	edge_was_real: boolean;
}

interface SoftArbCalibrationFamily {
	label: string;
	status: string;
	progress: {
		unique_resolved: number;
		required: number;
		remaining: number;
	};
	baseline: {
		edge_threshold_pct: number;
		kelly_multiplier: number;
	};
	recommended: {
		edge_threshold_pct: number;
		kelly_multiplier: number;
	};
	summary: {
		unique_resolved_samples: number;
		wins: number;
		losses: number;
		win_rate_pct: number;
		avg_market_prob_side_pct: number;
		market_outperformance_pp: number;
		total_pnl_usd: number;
	};
	selected_bucket: {
		threshold_pct: number;
		eligible_unique_samples: number;
		win_rate_pct: number;
		market_outperformance_pp: number;
		total_pnl_usd: number;
		avg_adjusted_edge_pct: number;
	};
	recommendation_reason: string;
}

interface SoftArbData {
	trades: SoftArbTrade[];
	summary: Record<string, unknown>;
	outcomes: SoftArbOutcome[];
	outcomeSummary: {
		resolvedTrades: number;
		wins: number;
		losses: number;
		winRatePct: number;
		totalPnl: number;
		avgAdjustedEdgePct: number;
	};
	calibration: {
		families: Record<string, SoftArbCalibrationFamily>;
	} | null;
	lastUpdated: string | null;
}

function useSoftArbTrades() {
	const [data, setData] = useState<SoftArbData | null>(null);
	const refresh = useCallback(() => {
		fetch("/api/soft-arb-trades")
			.then((r) => r.json())
			.then((d) => setData(d))
			.catch(() =>
				setData({
					trades: [],
					summary: {},
					outcomes: [],
					outcomeSummary: {
						resolvedTrades: 0,
						wins: 0,
						losses: 0,
						winRatePct: 0,
						totalPnl: 0,
						avgAdjustedEdgePct: 0,
					},
					calibration: null,
					lastUpdated: null,
				}),
			);
	}, []);
	useEffect(() => {
		refresh();
	}, [refresh]);
	return { data, refresh };
}

export default function SoftArbPage() {
	const { data: softArbData, refresh: refreshSoftArb } = useSoftArbTrades();
	const [softArbOpen, setSoftArbOpen] = useState(true);
	const [softArbPaperOpen, setSoftArbPaperOpen] = useState(true);

	const softArbOpenTrades = useMemo(
		() => (softArbData?.trades ?? []).filter((t) => t.status === "OPEN").sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()),
		[softArbData?.trades],
	);
	const softArbResolvedTrades = useMemo(
		() => (softArbData?.trades ?? []).filter((t) => t.status === "RESOLVED_WIN" || t.status === "RESOLVED_LOSS"),
		[softArbData?.trades],
	);
	const softArbShadowTrades = useMemo(
		() => (softArbData?.trades ?? []).filter((t) => t.status === "CLOSED_CONVERGED"),
		[softArbData?.trades],
	);

	const summary = useMemo(() => {
		let totalTrades = 0;
		let projectedOpenPnl = 0;
		let realizedPnl = 0;

		for (const t of softArbData?.trades ?? []) {
			totalTrades++;
			if (t.status === "OPEN") {
				projectedOpenPnl += t.unrealized_pnl ?? 0;
			} else if (t.status === "RESOLVED_WIN" || t.status === "RESOLVED_LOSS" || t.status === "CLOSED_CONVERGED") {
				realizedPnl += t.realized_pnl ?? 0;
			}
		}

		return {
			totalTrades,
			projectedOpenPnl: Math.round(projectedOpenPnl * 100) / 100,
			realizedPnl: Math.round(realizedPnl * 100) / 100,
			totalPaperPnl: Math.round((projectedOpenPnl + realizedPnl) * 100) / 100,
		};
	}, [softArbData?.trades]);

	const summaryCards = useMemo(() => {
		return [
			{
				label: "Total Signals",
				value: summary.totalTrades,
				icon: <IconArrowsExchange size={20} />,
			},
			{
				label: "Open Paper P&L",
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
				icon: <IconChartBar size={20} />,
				isPnl: true,
			},
		];
	}, [summary]);

	const outcomeSummaryCards = useMemo(() => {
		const outcomeSummary = softArbData?.outcomeSummary;
		if (!outcomeSummary) return [];
		return [
			{
				label: "Resolved Trades",
				value: outcomeSummary.resolvedTrades,
				icon: <IconChartBar size={20} />,
			},
			{
				label: "Win Rate",
				value: outcomeSummary.winRatePct,
				icon: <IconCircleCheck size={20} />,
				isPercent: true,
			},
			{
				label: "Outcome P&L",
				value: outcomeSummary.totalPnl,
				icon: <IconTrendingUp size={20} />,
				isPnl: true,
			},
			{
				label: "Avg Edge",
				value: outcomeSummary.avgAdjustedEdgePct,
				icon: <IconArrowsExchange size={20} />,
				isPercent: true,
			},
		];
	}, [softArbData?.outcomeSummary]);

	const calibrationFamilies = useMemo(
		() => Object.entries(softArbData?.calibration?.families ?? {}),
		[softArbData?.calibration?.families],
	);

	return (
		<div className="h-screen bg-[#f8f9fa] overflow-y-auto">
			<Header />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500 text-white">
							<IconScan size={20} />
						</div>
						<h2 className="text-lg font-bold text-foreground tracking-tight">
							Soft Arbitrage
						</h2>
					</div>
					<button
						type="button"
						onClick={refreshSoftArb}
						className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<IconLoader2 size={14} className={!softArbData ? "animate-spin" : ""} />
						Refresh
					</button>
				</div>

				<section className="rounded-xl border-l-4 border-l-emerald-400 bg-emerald-50/40 p-4">
					<button
						type="button"
						onClick={() => setSoftArbPaperOpen((v) => !v)}
						className="flex items-center gap-2 mb-1 text-left w-full"
					>
						<IconChevronDown
							size={15}
							className={`text-emerald-500 transition-transform duration-200 ${softArbPaperOpen ? "" : "-rotate-90"}`}
						/>
						<IconTrendingUp size={16} className="text-emerald-600" />
						<h3 className="text-sm font-bold text-emerald-900 tracking-wide uppercase">
							Soft Arb — Paper Trades
						</h3>
						<span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-emerald-100 text-emerald-700">
							FORECAST EDGE
						</span>
						{softArbData && softArbData.trades.length > 0 && (
							<span className="text-muted-foreground text-xs font-normal normal-case ml-2">
								({softArbData.trades.length} trade{softArbData.trades.length !== 1 ? "s" : ""})
							</span>
						)}
					</button>
					
					{softArbPaperOpen && (
						<div className="mt-4 space-y-6">
							{!softArbData ? (
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
									{[...Array(4)].map((_, i) => (
										<div key={`skeleton-${i}`} className="h-20 bg-white border border-border rounded-xl animate-pulse" />
									))}
								</div>
							) : softArbData.trades.length === 0 ? (
								<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
									<IconTrendingUp size={32} strokeWidth={1.2} className="mx-auto mb-2 opacity-40" />
									<p className="font-medium">No soft arb paper trades yet</p>
								</div>
							) : (
								<>
									{/* Summary cards */}
									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
										{summaryCards.map((card) => (
											<SummaryCard key={card.label} {...card} />
										))}
									</div>

									<section className="rounded-xl border border-emerald-100 bg-white/80 p-4">
										<div className="flex items-center gap-2 mb-4">
											<IconChartBar size={16} className="text-emerald-700" />
											<h4 className="text-[11px] font-bold text-emerald-800 tracking-widest uppercase">
												Outcome Feedback Loop
											</h4>
											<span className="text-[10px] text-muted-foreground">
												{softArbData.outcomes.length} logged result{softArbData.outcomes.length !== 1 ? "s" : ""}
											</span>
										</div>

										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
											{outcomeSummaryCards.map((card) => (
												<SummaryCard key={card.label} {...card} />
											))}
										</div>

										{calibrationFamilies.length > 0 && (
											<div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
												{calibrationFamilies.map(([familyKey, family]) => (
													<div key={familyKey} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
														<div className="flex items-center justify-between gap-3 mb-3">
															<div>
																<div className="text-[11px] font-bold tracking-widest uppercase text-emerald-900">
																	{family.label} Calibration
																</div>
																<div className="text-xs text-muted-foreground">
																	{family.progress.unique_resolved}/{family.progress.required} unique resolved events
																</div>
															</div>
															<span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
																family.status === "ready"
																	? "bg-emerald-100 text-emerald-700"
																	: "bg-amber-100 text-amber-700"
															}`}>
																{family.status}
															</span>
														</div>

														<div className="grid grid-cols-2 gap-3 text-sm">
															<div className="rounded-lg bg-white border border-border px-3 py-2">
																<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Baseline</div>
																<div className="font-semibold text-foreground">
																	{formatPct(family.baseline.edge_threshold_pct)} edge
																</div>
																<div className="text-xs text-muted-foreground">
																	{family.baseline.kelly_multiplier.toFixed(2)}x Kelly
																</div>
															</div>
															<div className="rounded-lg bg-white border border-border px-3 py-2">
																<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended</div>
																<div className="font-semibold text-foreground">
																	{formatPct(family.recommended.edge_threshold_pct)} edge
																</div>
																<div className="text-xs text-muted-foreground">
																	{family.recommended.kelly_multiplier.toFixed(2)}x Kelly
																</div>
															</div>
															<div className="rounded-lg bg-white border border-border px-3 py-2">
																<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Win Rate</div>
																<div className="font-semibold text-foreground">{formatPct(family.summary.win_rate_pct)}</div>
																<div className="text-xs text-muted-foreground">
																	Outperformance {formatPct(family.summary.market_outperformance_pp)}
																</div>
															</div>
															<div className="rounded-lg bg-white border border-border px-3 py-2">
																<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Selected Bucket</div>
																<div className="font-semibold text-foreground">{formatPct(family.selected_bucket.threshold_pct)} edge</div>
																<div className="text-xs text-muted-foreground">
																	{family.selected_bucket.eligible_unique_samples} unique samples
																</div>
															</div>
														</div>

														<div className="mt-3 flex items-center justify-between gap-3 text-xs">
															<span className="text-muted-foreground">Resolved P&L</span>
															<PnlBadge value={family.summary.total_pnl_usd} />
														</div>
														<p className="mt-3 text-xs text-muted-foreground">
															{family.recommendation_reason}
														</p>
													</div>
												))}
											</div>
										)}

										{softArbData.outcomes.length > 0 ? (
											<div className="border border-border rounded-xl overflow-hidden">
												<table className="w-full text-sm">
													<thead>
														<tr className="border-b border-border bg-muted/30 text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
															<th className="text-left px-4 py-2">Logged</th>
															<th className="text-left px-3 py-2">Event / Market</th>
															<th className="text-left px-3 py-2">Family</th>
															<th className="text-left px-3 py-2">Signal</th>
															<th className="text-right px-3 py-2">Edge</th>
															<th className="text-right px-3 py-2">Result</th>
															<th className="text-right px-4 py-2">P&L</th>
														</tr>
													</thead>
													<tbody>
														{softArbData.outcomes.map((o, idx) => (
															<tr key={`${o.trade_id}-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
																<td className="px-4 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
																	{o.timestamp ? timeAgo(o.timestamp) : "---"}
																</td>
																<td className="px-3 py-2">
																	<div className="font-medium text-foreground/80 truncate max-w-[220px]" title={o.pair}>
																		{o.pair}
																	</div>
																</td>
																<td className="px-3 py-2 text-xs">
																	<span className={`inline-flex rounded-full px-2 py-1 font-semibold ${
																		o.signal_family === "metaculus"
																			? "bg-sky-100 text-sky-700"
																			: "bg-orange-100 text-orange-700"
																	}`}>
																		{familyLabel(o.signal_family)}
																	</span>
																</td>
																<td className="px-3 py-2 text-xs font-medium">
																	{o.signal_source}
																</td>
																<td className="px-3 py-2 text-right tabular-nums">
																	{formatPct(o.adjusted_edge_pct)}
																</td>
																<td className="px-3 py-2 text-right">
																	{o.actual_outcome === "WIN" ? (
																		<span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
																			<IconCircleCheck size={12} /> WIN
																		</span>
																	) : (
																		<span className="inline-flex items-center gap-1 text-red-500 font-bold text-xs">
																			<IconCircleX size={12} /> LOSS
																		</span>
																	)}
																</td>
																<td className="text-right px-4 py-2 tabular-nums">
																	<PnlBadge value={o.pnl_usd} />
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										) : (
											<div className="text-sm text-muted-foreground">
												No resolved outcomes logged yet.
											</div>
										)}
									</section>

									{/* Open Soft Arb Trades */}
									<section>
										<button
											type="button"
											onClick={() => setSoftArbOpen((v) => !v)}
											className="flex items-center gap-2 mb-3 group"
										>
											<IconChevronRight size={14} className={`text-muted-foreground transition-transform ${softArbOpen ? "rotate-90" : ""}`} />
											<h4 className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase group-hover:text-foreground">
												Active Positions ({softArbOpenTrades.length})
											</h4>
										</button>
										{softArbOpen && (
											<div className="bg-white border border-border rounded-xl overflow-hidden">
												<table className="w-full text-sm">
													<thead>
														<tr className="border-b border-border bg-muted/30 text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
															<th className="text-left px-4 py-2">Opened</th>
															<th className="text-left px-3 py-2">Event / Market</th>
															<th className="text-left px-3 py-2">Outcome</th>
															<th className="text-right px-3 py-2">Entry</th>
															<th className="text-right px-3 py-2">Current</th>
															<th className="text-right px-3 py-2">Edge</th>
															<th className="text-right px-3 py-2">P&L</th>
															<th className="text-right px-4 py-2">Status</th>

														</tr>
													</thead>
													<tbody>
														{softArbOpenTrades.map((t, idx) => (
															<tr key={`${t.trade_id}-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
																<td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
																	{timeAgo(t.opened_at)}
																</td>
																<td className="px-3 py-2.5">
																	<div className="font-medium text-foreground truncate max-w-[200px]" title={t.pair}>
																		{t.pair}
																	</div>
																	<div className="mt-1">
																		<span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
																			t.signal_family === "metaculus"
																				? "bg-sky-100 text-sky-700"
																				: "bg-orange-100 text-orange-700"
																		}`}>
																			{familyLabel(t.signal_family)}
																		</span>
																	</div>
																</td>
																<td className="px-3 py-2.5 font-semibold text-emerald-700">
																	{t.direction}
																</td>
																<td className="px-3 py-2.5 text-right tabular-nums">
																{t.entry_price.toFixed(2)}
																</td>
																<td className="px-3 py-2.5 text-right tabular-nums">
																{t.current_price != null ? t.current_price.toFixed(3) : "---"}
																</td>
																<td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-600">
																{formatPct(t.adjusted_edge_pct)}
																</td>
																<td className="px-3 py-2.5 text-right tabular-nums">
																<PnlBadge value={t.unrealized_pnl} />
																</td>

																<td className="px-4 py-2.5 text-right flex flex-col items-end gap-1">
																	<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold">
																		<IconScan size={10} className="animate-pulse" /> LIVE
																	</span>
																	{t.ready_to_close && (
																		<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black animate-bounce shadow-sm">
																			CONVERGED
																		</span>
																	)}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										)}
									</section>

									{/* Shadow Performance Tracking for Closed Trades */}
									{softArbShadowTrades.length > 0 && (
											<section className="mt-8 border-t-2 border-dashed border-emerald-100 pt-6">
													<div className="flex items-center gap-2 mb-3 ml-1">
															<h4 className="text-[11px] font-bold text-emerald-800 tracking-widest uppercase">
																	Shadow Tracking: Convergence Exits ({softArbShadowTrades.length})
															</h4>
															<span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
																	Post-Exit Alpha Monitor
															</span>
													</div>
													<div className="bg-white/60 border border-emerald-100 rounded-xl overflow-hidden shadow-sm">
															<table className="w-full text-sm">
															<thead>
															<tr className="border-b border-emerald-50 bg-emerald-50/30 text-[10px] font-semibold text-emerald-700 tracking-wide uppercase">
															<th className="text-left px-4 py-2">Exit Date</th>
															<th className="text-left px-3 py-2">Event</th>
															<th className="text-right px-3 py-2">Entry</th>
															<th className="text-right px-3 py-2">Exit</th>
															<th className="text-right px-3 py-2">Shadow Price</th>
															<th className="text-right px-3 py-2">Realized P&L</th>
															<th className="text-right px-4 py-2">Shadow P&L</th>
															</tr>
															</thead>
															<tbody>
															{softArbShadowTrades.map((t, idx) => (
															<tr key={`${t.trade_id}-${idx}`} className="border-b border-emerald-50 last:border-0 hover:bg-emerald-50/40">
															<td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">
															{t.opened_at ? timeAgo(t.opened_at) : "---"}
															</td>
															<td className="px-3 py-2 text-xs">
															<div className="font-medium text-foreground truncate max-w-[150px]">
															{t.pair}
															</div>
															</td>
															<td className="px-3 py-2 text-right tabular-nums text-xs">
															{t.entry_price.toFixed(2)}
															</td>
															<td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-bold">
															{t.exit_price?.toFixed(3)}
															</td>
															<td className="px-3 py-2 text-right tabular-nums text-xs">
															{t.current_price?.toFixed(3)}
															</td>
															<td className="px-3 py-2 text-right">
															<PnlBadge value={t.realized_pnl} />
															</td>
															<td className="px-4 py-2 text-right">
															<PnlBadge value={t.shadow_pnl} />
															</td>
															</tr>
															))}
															</tbody>
															</table>
													</div>
													<p className="text-[10px] text-emerald-600/70 mt-2 ml-1 italic">
															* Shadow P&L tracks what would have happened if we held until today. Used for exit strategy calibration.
													</p>
											</section>
									)}

									{/* Resolved Soft Arb Trades */}

									{softArbResolvedTrades.length > 0 && (
										<section>
											<h4 className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase mb-3 ml-1">
												History ({softArbResolvedTrades.length})
											</h4>
											<div className="bg-white border border-border rounded-xl overflow-hidden">
												<table className="w-full text-sm">
													<thead>
														<tr className="border-b border-border bg-muted/30 text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
															<th className="text-left px-4 py-2">Resolved</th>
															<th className="text-left px-3 py-2">Event / Market</th>
															<th className="text-left px-3 py-2">Outcome</th>
															<th className="text-right px-3 py-2">Edge</th>
															<th className="text-right px-3 py-2">Result</th>
															<th className="text-right px-4 py-2">P&L</th>
														</tr>
													</thead>
													<tbody>
														{softArbResolvedTrades.map((t, idx) => (
															<tr key={`${t.trade_id}-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
																<td className="px-4 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
																	{t.opened_at ? timeAgo(t.opened_at) : "---"}
																</td>
																<td className="px-3 py-2">
																	<div className="font-medium text-foreground/80 truncate max-w-[180px]">
																		{t.pair}
																	</div>
																	<div className="mt-1">
																		<span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
																			t.signal_family === "metaculus"
																				? "bg-sky-100 text-sky-700"
																				: "bg-orange-100 text-orange-700"
																		}`}>
																			{familyLabel(t.signal_family)}
																		</span>
																	</div>
																</td>
																<td className="px-3 py-2 font-medium">
																	{t.direction}
																</td>
																<td className="px-3 py-2 text-right tabular-nums">
																	{formatPct(t.adjusted_edge_pct)}
																</td>
																<td className="px-3 py-2 text-right">
																	{t.status === "RESOLVED_WIN" ? (
																		<span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
																			<IconCircleCheck size={12} /> WIN
																		</span>
																	) : (
																		<span className="inline-flex items-center gap-1 text-red-500 font-bold text-xs">
																			<IconCircleX size={12} /> LOSS
																		</span>
																	)}
																</td>
																<td className="text-right px-4 py-2 tabular-nums">
																	<PnlBadge value={t.realized_pnl} />
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</section>
									)}
								</>
							)}
						</div>
					)}
				</section>
			</main>
		</div>
	);
}
