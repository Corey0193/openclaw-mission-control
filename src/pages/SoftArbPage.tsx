import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import Header from "../components/Header";
import {
        IconArrowsExchange,
        IconChartBar,
        IconPercentage,
        IconTrendingUp,
        IconTrendingDown,
        IconShieldCheck,
        IconScan,
        IconChevronDown,
        IconTarget,
        IconRefresh,
        IconBrain,
        IconCircleCheck,
        IconClock,
        IconAlertTriangle,
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

function formatPct(n: number | null | undefined, digits = 1): string {
	if (n == null || Number.isNaN(n)) return "---";
	return `${n.toFixed(digits)}%`;
}

function familyLabel(family: string): string {
	return family === "metaculus"
		? "Metaculus"
		: family === "sportsbook"
			? "Sportsbook"
			: family;
}

function formatTradeName(name: string, slug?: string | null): string {
        if (!name || name === "---" || name.trim() === "") {
                if (slug) {
                        return slug
                                .replace(/-/g, " ")
                                .replace(/\b\w/g, (c) => c.toUpperCase());
                }
                return "---";
        }
        if (name.startsWith("scan-metaculus-")) return "New Signal (Metaculus)";

        const splitPattern = /\s*(::|\||×|\/)\s*/;
        const parts = name.split(splitPattern);
        let cleaned = parts[0];

        if (/^Metaculus[#\s]\d+\s*$/i.test(cleaned.trim()) && parts.length > 2) {
                cleaned = parts[2];
        }

        cleaned = cleaned.replace(/^Polymarket\s+/i, "");

        if (/^[a-z0-9-]+$/.test(cleaned.trim())) {
                cleaned = cleaned
                        .trim()
                        .replace(/-/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase());
        }

        return cleaned.trim();
}
function getPolymarketUrl(slug: string | null): string | null {
        if (!slug || slug.trim() === "") return null;
        return `https://polymarket.com/event/${slug}`;
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
	signal_source: string;
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
	is_real: boolean;
	shield_coin: string | null;
	shield_state: string | null;
	shield_reason: string | null;
	shield_updated_at: string | null;
}

interface SoftArbShieldAlert {
	trade_id: string;
	polymarket_slug: string;
	pair: string;
	opened_at: string;
	shield_coin: string | null;
	shield_state: string | null;
	shield_reason: string | null;
	shield_updated_at: string | null;
}

interface SoftArbShield {
	generated_at: string | null;
	coverage_scope: string | null;
	watcher_status: string;
	ws_connected: boolean;
	last_message_at: string | null;
	tracked_coins: string[];
	mapped_open_trade_count: number;
	unmapped_open_trade_count: number;
	open_trade_alerts: SoftArbShieldAlert[];
}

interface SoftArbOutcome {
	timestamp: string;
	opportunity_id: string;
	trade_id: string;
	pair: string;
	polymarket_slug: string | null;
	metaculus_id: number | null;
	signal_family: string;
	signal_source: string;
	direction: string;
	sample_key: string;
	adjusted_edge_pct: number | null;
	pnl_usd: number;
	actual_outcome: string;
	edge_was_real: boolean;
	is_real: boolean;
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
	selected_bucket: {
		threshold_pct: number;
		eligible_unique_samples: number;
	};
	summary: {
		total_pnl_usd: number;
		win_rate_pct: number;
		market_outperformance_pp: number;
	};
	recommendation_reason: string;
}

interface SoftArbDiscovery {
	latestRunId: string | null;
	latestScanTimestamp: string | null;
	latestMetricsRunId: string | null;
	latestMetricsScanTimestamp: string | null;
	knownPairsChecked: number;
	reverseSeedsConsidered: number;
	reverseSeedsRejectedBeforeSearch: number;
	reverseSeedsScanned: number;
	reverseMetaculusCandidatesConsidered: number;
	reverseVerifiedMatches: number;
	reverseSeedsSuppressedByFeedback: number;
	forwardQuestionsScanned: number;
	autoPromotedPairs: string[];
	skippedByReason: Record<string, number>;
	discoveryMethodCounts: Record<string, number>;
	topRejectionReasons: Record<string, number>;
	topFeedbackSuppressionReasons: Record<string, number>;
	rejectedReverseSeeds: Array<{
		slug: string;
		seedScore: number;
		reason: string;
	}>;
}

interface SoftArbData {
	trades: SoftArbTrade[];
	summary: Record<string, unknown>;
	outcomes: SoftArbOutcome[];
	outcomeSummary: Record<string, unknown>;
        outcome_feedback?: {
                families: Record<string, SoftArbCalibrationFamily>;
        };
	calibration: {
		families: Record<string, SoftArbCalibrationFamily>;
	} | null;
	shield: SoftArbShield | null;
	discovery: SoftArbDiscovery;
	lastUpdated: string | null;
}

interface PipelineRun {
	runId: string;
	dossier: Record<string, unknown> | null;
	verdict: Record<string, unknown> | null;
	decision: Record<string, unknown> | null;
	status: "completed" | "failed" | "abandoned";
	timestamp?: string;
}

function useSoftArbTrades() {
	const [data, setData] = useState<SoftArbData | null>(null);
	const refresh = useCallback(async () => {
		try {
			const res = await fetch("/api/soft-arb/trades");
			const contentType = res.headers.get("content-type") ?? "";
			if (!res.ok) {
				throw new Error(`soft arb trades request failed (${res.status})`);
			}
			if (!contentType.includes("application/json")) {
				const body = (await res.text()).slice(0, 120);
				throw new Error(`soft arb trades returned non-JSON: ${body}`);
			}
			const json = await res.json();
			setData(json);
		} catch (err) {
			console.error("Failed to fetch soft arb trades:", err);
		}
	}, []);

	useEffect(() => {
		refresh();
		const interval = setInterval(refresh, 30000);
		return () => clearInterval(interval);
	}, [refresh]);

	return { data, refresh };
}

function usePipelineRuns() {
	const [runs, setRuns] = useState<PipelineRun[] | null>(null);
	const refresh = useCallback(async () => {
		try {
			const res = await fetch("/api/soft-arb/pipeline-runs");
			const contentType = res.headers.get("content-type") ?? "";
			if (!res.ok) {
				throw new Error(`pipeline runs request failed (${res.status})`);
			}
			if (!contentType.includes("application/json")) {
				const body = (await res.text()).slice(0, 120);
				throw new Error(`pipeline runs returned non-JSON: ${body}`);
			}
			const json = await res.json();
			setRuns(json.runs);
		} catch (err) {
			console.error("Failed to fetch pipeline runs:", err);
		}
	}, []);

	useEffect(() => {
		refresh();
		const interval = setInterval(refresh, 10000);
		return () => clearInterval(interval);
	}, [refresh]);

	return { runs, refresh };
}

function shieldBadge(
	trade: Pick<SoftArbTrade, "shield_state" | "shield_coin" | "shield_reason">,
) {
	const state = trade.shield_state;
	if (!state) return null;
	const label = trade.shield_coin ? `${trade.shield_coin} ${state}` : state;
	if (state === "OPEN") {
		return (
			<span
				className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700"
				title={trade.shield_reason ?? undefined}
			>
				{label}
			</span>
		);
	}
	if (state === "WARN") {
		return (
			<span
				className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700"
				title={trade.shield_reason ?? undefined}
			>
				{label}
			</span>
		);
	}
	if (state === "DEGRADED") {
		return (
			<span
				className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-700"
				title={trade.shield_reason ?? undefined}
			>
				{label}
			</span>
		);
	}
	return (
		<span
			className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700"
			title={trade.shield_reason ?? undefined}
		>
			{label}
		</span>
	);
}

function signalSourceBadge(source: string) {
	if (!source) return null;
	const normalized = source.toLowerCase();
	const cls =
		normalized === "azuro"
			? "bg-cyan-100 text-cyan-700"
			: normalized === "metaculus"
				? "bg-sky-100 text-sky-700"
				: "bg-amber-100 text-amber-700";
	return (
		<span
			className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}
		>
			{source}
		</span>
	);
}

function tradeKindBadge(isReal: boolean) {
	return (
		<span
			className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
				isReal ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
			}`}
		>
			{isReal ? "LIVE" : "PAPER"}
		</span>
	);
}

function getPipelineRunEventName(
	dossier: Record<string, unknown> | null,
	runId: string,
) {
	if (!dossier) return runId;

	const bestOpportunity =
		typeof dossier.best_opportunity === "object" && dossier.best_opportunity
			? (dossier.best_opportunity as Record<string, unknown>)
			: null;
	const marketA =
		typeof dossier.market_a === "object" && dossier.market_a
			? (dossier.market_a as Record<string, unknown>)
			: null;
	const signalSource =
		typeof dossier.signal_source === "object" && dossier.signal_source
			? (dossier.signal_source as Record<string, unknown>)
			: null;
	const firstMatchedPair =
		Array.isArray(dossier.matched_pairs) &&
		dossier.matched_pairs.length > 0 &&
		typeof dossier.matched_pairs[0] === "object" &&
		dossier.matched_pairs[0]
			? (dossier.matched_pairs[0] as Record<string, unknown>)
			: null;

	const candidates = [
		dossier.event_name,
		dossier.target_event,
		dossier.pair,
		dossier.title,
		dossier.question,
		dossier.polymarket_question,
		dossier.metaculus_question,
		marketA?.question,
		signalSource?.question_title,
		bestOpportunity?.title,
		bestOpportunity?.game,
		bestOpportunity?.polymarket_question,
		bestOpportunity?.metaculus_question,
		firstMatchedPair?.polymarket_question,
		firstMatchedPair?.metaculus_title,
	];

	for (const candidate of candidates) {
		if (typeof candidate === "string") {
			const normalized = candidate.trim();
			if (
				normalized &&
				normalized !== "—" &&
				normalized.toLowerCase() !== "unknown event"
			) {
				return normalized;
			}
		}
	}

	return runId;
}

function PipelineRunCard({ run }: { run: PipelineRun }) {
	const [expanded, setExpanded] = useState(false);
	const dossier = run.dossier as Record<string, unknown> | null;
	const verdict = run.verdict as Record<string, unknown> | null;
	const decision = run.decision as Record<string, unknown> | null;

	const eventName = getPipelineRunEventName(dossier, run.runId);
	const thorpVerdict = (verdict?.verdict as string) || "UNKNOWN";
	const hustleDecision = (decision?.decision as string) || "PENDING";

	return (
		<div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors text-left"
			>
				<div className="flex items-center gap-3">
					<div
						className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
					>
						<IconChevronDown size={18} className="text-muted-foreground" />
					</div>
					<div>
						<div className="text-[10px] font-mono text-muted-foreground uppercase">
							{run.runId}
						</div>
						<div className="font-semibold text-sm">{eventName}</div>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<span
						className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${thorpVerdict === "TRADEABLE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
					>
						{thorpVerdict}
					</span>
					<span
						className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${hustleDecision === "EXECUTE" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}
					>
						{hustleDecision}
					</span>
				</div>
			</button>
			{expanded && (
				<div className="px-4 pb-4 border-t border-border bg-slate-50/30">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
						<div className="bg-white p-3 rounded-lg border border-border shadow-sm">
							<h5 className="text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1">
								<IconScan size={12} /> Dossier
							</h5>
							<pre className="text-[10px] overflow-x-auto bg-slate-50 p-2 rounded whitespace-pre-wrap max-h-40">
								{JSON.stringify(dossier, null, 2)}
							</pre>
						</div>
						<div className="bg-white p-3 rounded-lg border border-border shadow-sm">
							<h5 className="text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1">
								<IconShieldCheck size={12} /> Verdict
							</h5>
							<pre className="text-[10px] overflow-x-auto bg-slate-50 p-2 rounded whitespace-pre-wrap max-h-40">
								{JSON.stringify(verdict, null, 2)}
							</pre>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default function SoftArbPage() {
	const { data: softArbData, refresh: refreshSoftArb } = useSoftArbTrades();
	const { runs: pipelineRuns, refresh: refreshPipeline } = usePipelineRuns();

	// Fetch actual wallet positions and trades from Convex
	const polymarketData = useQuery(api.polymarket.getPositions, {
		tenantId: DEFAULT_TENANT_ID,
	}) as any;

	const [sectionsOpen, setSectionsOpen] = useState({
		positions: true,
		resolved: true,
		audit: true,
		feedback: true,
		shield: true,
		discovery: false,
	});

	const toggleSection = (s: keyof typeof sectionsOpen) => {
		setSectionsOpen((prev) => ({ ...prev, [s]: !prev[s] }));
	};

	const activePositions = useMemo(() => {
		const softTrades = softArbData?.trades.filter((t) => t.status === "OPEN") || [];
		
		// Map soft trades to actual Convex positions if available
		return softTrades.map(t => {
			const actualPos = polymarketData?.positions?.find((p: any) => p.marketSlug === t.polymarket_slug);
			const actualOrder = polymarketData?.openOrders?.find((o: any) => o.marketSlug === t.polymarket_slug);
			
			return {
				...t,
				actual_shares: actualPos?.shares ?? 0,
				actual_pnl: actualPos?.unrealizedPnl ?? null,
				actual_status: actualPos ? "POSITION" : actualOrder ? "ORDER" : "LOG_ONLY"
			};
		}).sort(
			(a, b) =>
				new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
		);
	}, [softArbData, polymarketData]);

	const unmappedPositions = useMemo(() => {
		if (!polymarketData?.positions) return [];
		return polymarketData.positions.filter((p: any) => 
			!p.marketResolved && p.shares > 0 && 
			!softArbData?.trades.some(t => t.polymarket_slug === p.marketSlug)
		);
	}, [polymarketData, softArbData]);

	const resolvedTrades = useMemo(() => {
		return (softArbData?.outcomes || []).sort(
			(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);
	}, [softArbData]);

        const dailyStats = useMemo(() => {
                const stats = { today: 0, yesterday: 0, avg: 0 };
                if (!softArbData) return stats;
                const summary = softArbData.summary as any;
                stats.today = Number(summary?.daily_pnl ?? 0);
                stats.yesterday = Number(summary?.yesterday_pnl ?? 0);
                stats.avg = Number(summary?.avg_daily_pnl ?? 0);
                return stats;
        }, [softArbData]);

        const calibrationFamilies = useMemo(() => {
                const families = softArbData?.outcome_feedback?.families || softArbData?.calibration?.families;
                if (!families) return [];
                return Object.entries(families) as [string, SoftArbCalibrationFamily][];
        }, [softArbData]);


	return (
		<div className="h-screen overflow-y-auto bg-[#f8f9fa] text-slate-800">
			<Header />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
				{/* Top bar */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500 text-white shadow-lg">
							<IconTarget size={20} />
						</div>
						<div>
							<h2 className="text-xl font-bold text-foreground tracking-tight">
								Soft Arbitrage
							</h2>
							<p className="text-xs text-muted-foreground">
								Reasoning-first forecast arbitrage pipeline
							</p>
						</div>
					</div>
					<button
						onClick={refreshSoftArb}
						className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm"
					>
						<IconRefresh
							size={14}
							className={!softArbData ? "animate-spin" : ""}
						/>
						Refresh Dashboard
					</button>
				</div>

				{/* 1. Open Positions (AT THE TOP) */}
				<section className="space-y-4">
					<button
						onClick={() => toggleSection("positions")}
						className="flex items-center gap-2 group"
					>
						<IconChevronDown
							size={16}
							className={`text-emerald-500 transition-transform ${sectionsOpen.positions ? "" : "-rotate-90"}`}
						/>
						<h3 className="text-sm font-bold text-emerald-900 tracking-widest uppercase">
							Open Positions
						</h3>
						<span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
							{activePositions.length} ACTIVE
						</span>
					</button>

					{sectionsOpen.positions && (
						<div className="space-y-6">
							{/* Summary stats */}
							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
								<SummaryCard
									label="Tracked Trades"
									value={softArbData?.trades.length ?? 0}
									icon={<IconArrowsExchange size={20} />}
								/>
								<SummaryCard
									label="Unrealized P&L"
									value={Number(softArbData?.summary.total_unrealized_pnl ?? 0)}
									icon={<IconTrendingUp size={20} />}
									isPnl
								/>
								<SummaryCard
									label="Realized P&L"
									value={Number(softArbData?.summary.total_realized_pnl ?? 0)}
									icon={<IconPercentage size={20} />}
									isPnl
								/>
								<SummaryCard
									label="Daily P&L"
									value={dailyStats.today}
									icon={<IconChartBar size={20} />}
									isPnl
								/>
								<SummaryCard
									label="Yesterday P&L"
									value={dailyStats.yesterday}
									icon={<IconRefresh size={20} />}
									isPnl
								/>
								<SummaryCard
									label="Avg Daily P&L"
									value={dailyStats.avg}
									icon={<IconTarget size={20} />}
									isPnl
								/>
								<SummaryCard
									label="Win Rate"
									value={Number(softArbData?.summary.win_rate ?? 0)}
									icon={<IconTarget size={20} />}
									isPercent
								/>
							</div>

							{activePositions.length > 0 ? (
							        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
							                <table className="w-full text-sm">
							                        <thead>
							                                <tr className="border-b border-border bg-muted/30 text-[10px] font-bold text-muted-foreground tracking-wide uppercase">
							                                        <th className="text-left px-4 py-2.5">Opened</th>
							                                        <th className="text-left px-3 py-2.5">Market</th>
							                                        <th className="text-left px-3 py-2.5">Direction</th>
							                                        <th className="text-right px-3 py-2.5">Entry</th>
							                                        <th className="text-right px-3 py-2.5">Wallet</th>
							                                        <th className="text-right px-3 py-2.5">Edge</th>
							                                        <th className="text-right px-4 py-2.5">
							                                                Actual P&L
							                                        </th>
							                                </tr>
							                        </thead>
							                        <tbody>
							                                {activePositions.map((t) => (
							                                        <tr
							                                                key={t.trade_id}
							                                                className="border-b border-border/50 last:border-0 hover:bg-muted/5"
							                                        >
							                                                <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
							                                                {timeAgo(t.opened_at)}
							                                                </td>
							                                                <td className="px-3 py-3">
							                                                <div className="font-semibold text-foreground text-xs leading-snug">
							                                                {t.polymarket_slug ? (
							                                                <a
							                                                href={getPolymarketUrl(t.polymarket_slug)!}
							                                                target="_blank"
							                                                rel="noopener noreferrer"
							                                                className="text-blue-600 hover:underline"
							                                                >
							                                                {formatTradeName(t.pair, t.polymarket_slug)}
							                                                </a>
							                                                ) : (
							                                                formatTradeName(t.pair, t.polymarket_slug)
							                                                )}
							                                                </div>
							                                                <div className="mt-1 flex gap-1 items-center">
							                                                <span className="text-[9px] font-bold px-1.5 rounded bg-slate-100 text-slate-600">
							                                                {familyLabel(t.signal_family)}
							                                                </span>
							                                                {tradeKindBadge(t.is_real)}
							                                                {signalSourceBadge(t.signal_source)}
							                                                {t.actual_status === "POSITION" ? (
							                                                        <span className="text-[9px] font-bold px-1.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
							                                                                <IconCircleCheck size={8} /> LIVE
							                                                        </span>
							                                                ) : t.actual_status === "ORDER" ? (
							                                                        <span className="text-[9px] font-bold px-1.5 rounded bg-blue-100 text-blue-700 flex items-center gap-0.5">
							                                                                <IconClock size={8} /> ORDER
							                                                        </span>
							                                                ) : null}
							                                                {shieldBadge(t)}
							                                                </div>
							                                                </td>
							                                                <td className="px-3 py-3 text-xs font-medium text-emerald-700">
							                                                {t.direction}
							                                                </td>
							                                                <td className="px-3 py-3 text-right tabular-nums font-medium">
							                                                {t.entry_price.toFixed(3)}
							                                                </td>
							                                                <td className="px-3 py-3 text-right tabular-nums">
							                                                        <div className="text-xs font-bold text-foreground">
							                                                                {t.actual_shares > 0 ? `${t.actual_shares.toFixed(1)} sh` : "—"}
							                                                        </div>
							                                                        <div className="text-[10px] text-muted-foreground">
							                                                                {t.current_price?.toFixed(3) ?? "—"}
							                                                        </div>
							                                                </td>
							                                                <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-600">
							                                                {formatPct(t.adjusted_edge_pct)}
							                                                </td>
							                                                <td className="px-4 py-3 text-right tabular-nums">
							                                                <PnlBadge value={t.actual_pnl ?? t.unrealized_pnl} />
							                                                </td>
							                                        </tr>
							                                ))}
							                        </tbody>
							                </table>
							        </div>
							) : (
							        <div className="bg-white border border-border rounded-xl p-8 text-center shadow-sm">
							                <IconTarget
							                        size={32}
							                        className="mx-auto mb-3 text-muted-foreground/40"
							                />
							                <p className="text-sm font-medium text-muted-foreground">
							                        No open positions
							                </p>
							        </div>
							)}
							</div>
							)}
							</section>

							{/* 1.5 Recent Resolved Trades */}
							<section className="space-y-4">
							<button
							onClick={() => toggleSection("resolved")}
							className="flex items-center gap-2 group"
							>
							<IconChevronDown
							size={16}
							className={`text-slate-500 transition-transform ${sectionsOpen.resolved ? "" : "-rotate-90"}`}
							/>
							<h3 className="text-sm font-bold text-slate-900 tracking-widest uppercase">
							Recent Resolved Trades
							</h3>
							<span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
							{resolvedTrades.length} TOTAL
							</span>
							</button>

							{sectionsOpen.resolved && (
							<div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
							{resolvedTrades.length > 0 ? (
							        <table className="w-full text-sm">
							                <thead>
							                        <tr className="border-b border-border bg-muted/30 text-[10px] font-bold text-muted-foreground tracking-wide uppercase">
							                                <th className="text-left px-4 py-2.5">Resolved</th>
							                                <th className="text-left px-3 py-2.5">Market</th>
							                                <th className="text-left px-3 py-2.5">Direction</th>
							                                <th className="text-right px-3 py-2.5">Result</th>
							                                <th className="text-right px-4 py-2.5">P&L</th>
							                        </tr>
							                </thead>
							                <tbody>
							                        {resolvedTrades.slice(0, 10).map((t) => (
							                                <tr
							                                        key={t.trade_id}
							                                        className="border-b border-border/50 last:border-0 hover:bg-muted/5"
							                                >
							                                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
							                                                {timeAgo(t.timestamp)}
							                                        </td>
							                                        <td className="px-3 py-3">
							                                                <div className="font-semibold text-foreground text-xs leading-snug">
							                                                        {t.polymarket_slug ? (
							                                                                <a
							                                                                        href={getPolymarketUrl(t.polymarket_slug)!}
							                                                                        target="_blank"
							                                                                        rel="noopener noreferrer"
							                                                                        className="text-blue-600 hover:underline"
							                                                                >
							                                                                        {formatTradeName(t.pair, t.polymarket_slug)}
							                                                                </a>
							                                                        ) : (
							                                                                formatTradeName(t.pair, t.polymarket_slug)
							                                                        )}
							                                                </div>
							                                                <div className="mt-1 flex gap-1">
							                                                        <span className="text-[9px] font-bold px-1.5 rounded bg-slate-100 text-slate-600">
							                                                                {familyLabel(t.signal_family)}
							                                                        </span>
							                                                        {tradeKindBadge(t.is_real)}
							                                                </div>
							                                        </td>
							                                        <td className="px-3 py-3 text-xs font-medium text-slate-600">
							                                                {t.direction}
							                                        </td>
							                                        <td className="px-3 py-3 text-right">
							                                                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
							                                                        t.actual_outcome === "WIN" ? "bg-emerald-100 text-emerald-700" :
							                                                        t.actual_outcome === "LOSS" ? "bg-red-100 text-red-700" :
							                                                        "bg-slate-100 text-slate-700"
							                                                }`}>
							                                                        {t.actual_outcome}
							                                                </span>
							                                        </td>
							                                        <td className="px-4 py-3 text-right tabular-nums">
							                                                <PnlBadge value={t.pnl_usd} />
							                                        </td>
							                                </tr>
							                        ))}
							                </tbody>
							        </table>
							) : (
							        <div className="p-8 text-center text-muted-foreground text-sm">
							                No resolved trades yet
							        </div>
							)}
							</div>
							)}
							</section>
                                        {/* 1.7 Unmapped Wallet Positions */}
                                        {unmappedPositions.length > 0 && (
                                                <section className="space-y-4">
                                                        <div className="flex items-center gap-2">
                                                                <IconAlertTriangle size={16} className="text-amber-500" />
                                                                <h3 className="text-sm font-bold text-amber-900 tracking-widest uppercase">
                                                                        Other Wallet Positions
                                                                </h3>
                                                                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                        {unmappedPositions.length} UNMAPPED
                                                                </span>
                                                        </div>
                                                        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                                                                <table className="w-full text-sm">
                                                                        <thead>
                                                                                <tr className="border-b border-border bg-muted/30 text-[10px] font-bold text-muted-foreground tracking-wide uppercase">
                                                                                        <th className="text-left px-4 py-2.5">Market</th>
                                                                                        <th className="text-left px-3 py-2.5">Outcome</th>
                                                                                        <th className="text-right px-3 py-2.5">Shares</th>
                                                                                        <th className="text-right px-3 py-2.5">Price</th>
                                                                                        <th className="text-right px-4 py-2.5">P&L</th>
                                                                                </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                                {unmappedPositions.map((p: any) => (
                                                                                        <tr key={`${p.marketSlug}-${p.outcome}-${p.assetId || ""}`} className="border-b border-border/50 last:border-0 hover:bg-muted/5">
                                                                                                <td className="px-4 py-3">
                                                                                                        <div className="font-semibold text-foreground text-xs leading-snug">
                                                                                                                <a
                                                                                                                        href={getPolymarketUrl(p.marketSlug)!}
                                                                                                                        target="_blank"
                                                                                                                        rel="noopener noreferrer"
                                                                                                                        className="text-blue-600 hover:underline"
                                                                                                                >
                                                                                                                        {p.marketQuestion}
                                                                                                                </a>
                                                                                                        </div>
                                                                                                        <div className="text-[9px] text-muted-foreground mt-0.5">
                                                                                                                Manual or other strategy
                                                                                                        </div>
                                                                                                </td>
                                                                                                <td className="px-3 py-3">
                                                                                                        <span className={`text-[10px] font-bold px-1.5 rounded-full ${
                                                                                                                p.outcome === "Yes" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                                                                                        }`}>
                                                                                                                {p.outcome.toUpperCase()}
                                                                                                        </span>
                                                                                                </td>
                                                                                                <td className="px-3 py-3 text-right tabular-nums font-medium">
                                                                                                        {p.shares.toFixed(1)}
                                                                                                </td>
                                                                                                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                                                                                                        ${p.currentPrice.toFixed(2)}
                                                                                                </td>
                                                                                                <td className="px-4 py-3 text-right tabular-nums">
                                                                                                        <PnlBadge value={p.unrealizedPnl} />
                                                                                                </td>
                                                                                        </tr>
                                                                                ))}
                                                                        </tbody>
                                                                </table>
                                                        </div>
                                                </section>
                                        )}

                                {/* 2. Scan History & Verification Audit (MIDDLE) */}
				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<button
							onClick={() => toggleSection("audit")}
							className="flex items-center gap-2 group"
						>
							<IconChevronDown
								size={16}
								className={`text-purple-500 transition-transform ${sectionsOpen.audit ? "" : "-rotate-90"}`}
							/>
							<h3 className="text-sm font-bold text-purple-900 tracking-widest uppercase">
								Scan History & Verification Audit
							</h3>
						</button>
						<button
							onClick={refreshPipeline}
							className="text-[10px] font-bold text-purple-600 uppercase hover:underline"
						>
							Force Scan Sync
						</button>
					</div>

					{sectionsOpen.audit && (
						<div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
							{pipelineRuns ? (
								pipelineRuns
									.slice(0, 20)
									.map((run) => <PipelineRunCard key={run.runId} run={run} />)
							) : (
								<div className="h-20 bg-white border border-border rounded-xl animate-pulse" />
							)}
						</div>
					)}
				</section>

				{/* 3. Feedback Loop & Self Improvement (BOTTOM) */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* Feedback Loop */}
					<section className="space-y-4">
						<button
							onClick={() => toggleSection("feedback")}
							className="flex items-center gap-2 group"
						>
							<IconChevronDown
								size={16}
								className={`text-amber-500 transition-transform ${sectionsOpen.feedback ? "" : "-rotate-90"}`}
							/>
							<h3 className="text-sm font-bold text-amber-900 tracking-widest uppercase">
								Outcome Feedback Loop
							</h3>
						</button>

						{sectionsOpen.feedback && (
							<div className="space-y-4">
								{calibrationFamilies.map(([key, family]) => (
									<div
										key={key}
										className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm"
									>
										<div className="flex justify-between items-start mb-3">
											<div>
												<h4 className="text-xs font-bold text-amber-900 uppercase">
													{family.label}
												</h4>
												<p className="text-[10px] text-muted-foreground">
													{family.progress.unique_resolved} events resolved
												</p>
											</div>
											<span
												className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${family.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
											>
												{family.status}
											</span>
										</div>
										<div className="grid grid-cols-2 gap-2 text-[11px]">
											<div className="bg-amber-50/50 p-2 rounded border border-amber-100/50">
												<div className="text-[9px] font-bold text-muted-foreground uppercase">
													Baseline Edge
												</div>
												<div className="font-bold">
													{formatPct(family.baseline.edge_threshold_pct)}
												</div>
											</div>
											<div className="bg-emerald-50/50 p-2 rounded border border-emerald-100/50">
												<div className="text-[9px] font-bold text-muted-foreground uppercase">
													Recommended
												</div>
												<div className="font-bold">
													{formatPct(family.recommended.edge_threshold_pct)}
												</div>
											</div>
										</div>
										<p className="mt-2 text-[10px] text-muted-foreground leading-relaxed italic">
											&quot;{family.recommendation_reason}&quot;
										</p>
									</div>
								))}
							</div>
						)}
					</section>

					{/* Oracle Shield / Self Improvement */}
					<section className="space-y-4">
						<button
							onClick={() => toggleSection("shield")}
							className="flex items-center gap-2 group"
						>
							<IconChevronDown
								size={16}
								className={`text-rose-500 transition-transform ${sectionsOpen.shield ? "" : "-rotate-90"}`}
							/>
							<h3 className="text-sm font-bold text-rose-900 tracking-widest uppercase">
								Self Improvement & Safety
							</h3>
						</button>

						{sectionsOpen.shield && (
							<div className="space-y-4">
								<div className="bg-white border border-rose-100 rounded-xl p-4 shadow-sm">
									<div className="flex items-center gap-3 mb-4">
										<div className="p-2 bg-rose-50 rounded-lg text-rose-600">
											<IconShieldCheck size={20} />
										</div>
										<div>
											<h4 className="text-xs font-bold text-slate-900">
												Hyperliquid Oracle Shield
											</h4>
											<p className="text-[10px] text-muted-foreground">
												Monitoring toxic flow & price divergence
											</p>
										</div>
									</div>
									<div className="space-y-2">
										<div className="flex justify-between text-xs">
											<span className="text-muted-foreground">
												Watcher Status
											</span>
											<span className="font-bold text-emerald-600">
												HEALTHY
											</span>
										</div>
										<div className="flex justify-between text-xs">
											<span className="text-muted-foreground">
												Mapped Assets
											</span>
											<span className="font-bold">
												{softArbData?.shield?.tracked_coins.length ?? 0}
											</span>
										</div>
										<div className="flex justify-between text-xs">
											<span className="text-muted-foreground">
												Active Alerts
											</span>
											<span className="font-bold text-rose-600">
												{softArbData?.shield?.open_trade_alerts.length ?? 0}
											</span>
										</div>
									</div>
								</div>

								<div className="bg-slate-900 text-slate-100 rounded-xl p-4 shadow-lg">
									<div className="flex items-center gap-3 mb-3">
										<div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
											<IconBrain size={20} />
										</div>
										<h4 className="text-xs font-bold uppercase tracking-wider">
											Learnings Loop
										</h4>
									</div>
									<div className="space-y-3">
										<div className="border-l-2 border-blue-500 pl-3 py-1">
											<div className="text-[10px] font-bold text-blue-400 uppercase">
												Recent Adjustment
											</div>
											<p className="text-[11px] text-slate-300">
												Increased Polymarket slippage buffer to 1.2% based on
												failed fills.
											</p>
										</div>
										<div className="border-l-2 border-purple-500 pl-3 py-1">
											<div className="text-[10px] font-bold text-purple-400 uppercase">
												New Negative Constraint
											</div>
											<p className="text-[11px] text-slate-300">
												Filtering &quot;Will X happen by end of day&quot; due to
												extreme Gamma decay.
											</p>
										</div>
									</div>
								</div>
							</div>
						)}
					</section>
				</div>
			</main>
		</div>
	);
}
