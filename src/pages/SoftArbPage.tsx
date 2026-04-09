import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortfolio } from "../lib/usePortfolio";
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
	IconAlertTriangle,
	IconWallet,
	IconCurrencyDollar,
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
			return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

function normalizeDirection(
	direction: string | null | undefined,
): "YES" | "NO" | null {
	const normalized = String(direction ?? "").toUpperCase();
	if (normalized.includes("NO")) return "NO";
	if (normalized.includes("YES")) return "YES";
	return null;
}

function isExpiredTrade(resolvesBy: string | null | undefined): boolean {
	if (!resolvesBy) return false;
	const ts = Date.parse(resolvesBy);
	return Number.isFinite(ts) && ts <= Date.now();
}

function isVisiblePositionStatus(status: string | null | undefined): boolean {
	const normalized = String(status ?? "").toUpperCase();
	return (
		normalized === "OPEN" ||
		normalized === "POSTED" ||
		normalized === "PARTIAL_FILL" ||
		normalized === "FILLED" ||
		normalized === "PAYOUT_CLAIMABLE"
	);
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
	isCurrency,
}: {
	label: string;
	value: number | null;
	icon: React.ReactNode;
	isPnl?: boolean;
	isPercent?: boolean;
	isCurrency?: boolean;
}) {
	return (
		<div className="flex items-center gap-2.5 bg-white border border-border rounded-xl px-3 py-3 shadow-sm min-w-0">
			<div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground">
				{icon}
			</div>
			<div className="min-w-0 flex-1">
				<div className="text-[9px] font-semibold text-muted-foreground tracking-wide uppercase truncate">
					{label}
				</div>
				<div className="text-sm font-bold text-foreground truncate">
					{value == null ? (
						"---"
					) : isPnl ? (
						<PnlBadge value={value} />
					) : isPercent ? (
						`${value.toFixed(1)}%`
					) : isCurrency ? (
						formatUsd(value)
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
	rowKey: string;
	pair: string;
	signal_family: string;
	signal_source: string;
	direction: string;
	entry_price: number | null;
	position_size_usd: number;
	shares: number;
	gross_payout: number | null;
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
	target_outcome?: string | null;
	order_id?: string | null;
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
	event_slug: string | null;
	metaculus_id: number | null;
	signal_family: string;
	signal_source: string;
	direction: string;
	target_outcome?: string | null;
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
	wallet: {
		magic_usdc: number;
		phantom_usdc: number;
		phantom_pol: number;
		pol_usd_price: number;
		phantom_pol_usd_value: number;
		magic_available_to_trade: number;
		phantom_available_to_fund: number;
		deployable_bankroll_usd: number;
		total_usdc: number;
		total_wallet_value_usd: number;
		updated_at: string;
	} | null;
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
			if (json && Array.isArray(json.trades)) {
				// Filter out 'ghost' trades that have no identifying info
				json.trades = json.trades.filter(
					(t: SoftArbTrade) =>
						(t.pair && t.pair !== "---") ||
						t.polymarket_slug ||
						t.event_slug ||
						(t.position_size_usd > 0 && t.shares > 0),
				);
			}
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
	const { data: portfolio, refresh: refreshPortfolio } = usePortfolio();
	const { runs: pipelineRuns, refresh: refreshPipeline } = usePipelineRuns();

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
		if (portfolio) {
			return portfolio.positions
				.filter((p) => p.category === "tracked" && !p.onChain.resolved)
				.map((p) => ({
					trade_id: p.pipeline?.tradeId ?? p.slug,
					rowKey: p.pipeline?.tradeId ?? p.slug,
					pair: p.title,
					polymarket_slug: p.slug,
					event_slug: p.slug,
					signal_family: p.pipeline?.signalFamily ?? "",
					signal_source: "",
					direction: p.pipeline?.direction ?? "BUY_YES",
					entry_price: p.pipeline?.entryPrice ?? p.onChain.avgPrice,
					position_size_usd:
						p.pipeline?.positionSizeUsd ?? p.onChain.initialValue,
					shares: p.onChain.shares,
					gross_payout: null as number | null,
					metaculus_id: 0,
					edge_pct: null,
					adjusted_edge_pct: p.pipeline?.edgePct ?? 0,
					opened_at: p.pipeline?.entryTimestamp ?? "",
					resolves_by: p.onChain.endDate ?? "",
					status: "FILLED",
					current_price: p.onChain.currentPrice,
					unrealized_pnl: p.onChain.unrealizedPnl,
					realized_pnl: null as number | null,
					shadow_pnl: null as number | null,
					ready_to_close: false,
					fair_value: null as number | null,
					exit_price: null as number | null,
					resolved_outcome: null as string | null,
					target_outcome: null as string | null,
					is_real: true,
					order_id: p.pipeline?.orderId ?? null,
					shield_coin: null as string | null,
					shield_state: null as string | null,
					shield_reason: null as string | null,
					shield_updated_at: null as string | null,
					actual_shares: p.onChain.shares,
					actual_pnl: p.onChain.unrealizedPnl,
					display_pnl: p.onChain.unrealizedPnl,
					expired: false,
					tradeUrlSlug: p.slug,
					actual_status: "POSITION" as const,
					onChain: p.onChain,
					pipeline: p.pipeline,
				}))
				.sort(
					(a, b) =>
						new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
				);
		}

		return (softArbData?.trades ?? [])
			.filter((t) => isVisiblePositionStatus(t.status))
			.map((t) => ({
				...t,
				actual_shares: t.shares,
				actual_pnl: t.unrealized_pnl,
				display_pnl: t.unrealized_pnl,
				expired: false,
				tradeUrlSlug: t.event_slug ?? t.polymarket_slug,
				actual_status: "LOG_ONLY" as const,
				onChain: null,
				pipeline: null,
			}));
	}, [portfolio, softArbData]);

	const staleOpenTrades = useMemo(() => {
		if (portfolio) {
			// When portfolio is available, stale trades are those in the log that are
			// expired and not tracked as on-chain positions
			const trackedSlugs = new Set(
				portfolio.positions
					.filter((p) => p.category === "tracked")
					.map((p) => p.slug),
			);
			return (softArbData?.trades ?? [])
				.filter(
					(t) =>
						isVisiblePositionStatus(t.status) &&
						isExpiredTrade(t.resolves_by) &&
						String(t.status).toUpperCase() !== "PAYOUT_CLAIMABLE" &&
						!trackedSlugs.has(t.polymarket_slug) &&
						!trackedSlugs.has(t.event_slug ?? ""),
				)
				.map((t) => {
					const entryPrice = t.entry_price ?? 0;
					const derivedPnl =
						t.unrealized_pnl ??
						(t.current_price != null
							? Number(((t.current_price - entryPrice) * t.shares).toFixed(2))
							: null);
					return {
						...t,
						expired: true,
						tradeUrlSlug: t.event_slug ?? t.polymarket_slug,
						display_pnl: derivedPnl,
						actual_status: "STALE" as const,
					};
				})
				.sort(
					(a, b) =>
						new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
				);
		}
		return (softArbData?.trades ?? [])
			.filter(
				(t) =>
					isVisiblePositionStatus(t.status) &&
					isExpiredTrade(t.resolves_by) &&
					String(t.status).toUpperCase() !== "PAYOUT_CLAIMABLE",
			)
			.map((t) => {
				const entryPrice = t.entry_price ?? 0;
				const derivedPnl =
					t.unrealized_pnl ??
					(t.current_price != null
						? Number(((t.current_price - entryPrice) * t.shares).toFixed(2))
						: null);
				return {
					...t,
					expired: true,
					tradeUrlSlug: t.event_slug ?? t.polymarket_slug,
					display_pnl: derivedPnl,
					actual_status: "STALE" as const,
				};
			})
			.sort(
				(a, b) =>
					new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
			);
	}, [portfolio, softArbData]);

	const unmappedPositions = useMemo(() => {
		if (!portfolio) return [];
		return portfolio.positions.filter((p) => p.category !== "tracked");
	}, [portfolio]);

	const resolvedTrades = useMemo(() => {
		const onChainBySlug = new Map<
			string,
			{ pnl: number; resolved: boolean; curPrice: number }
		>();
		if (portfolio) {
			for (const p of portfolio.positions) {
				onChainBySlug.set(p.slug, {
					pnl: p.onChain.unrealizedPnl,
					resolved: p.onChain.resolved,
					curPrice: p.onChain.currentPrice,
				});
			}
		}

		return (softArbData?.outcomes || [])
			.map((t) => {
				const slug = t.event_slug ?? t.polymarket_slug ?? "";
				const onChain = onChainBySlug.get(slug) ?? null;
				let mismatch: string | null = null;

				if (onChain && onChain.resolved) {
					const softArbWin = t.actual_outcome === "WIN";
					const onChainWin = onChain.curPrice > 0;
					if (softArbWin !== onChainWin) {
						mismatch = `On-chain: ${onChainWin ? "WIN" : "LOSS"} (${onChain.pnl >= 0 ? "+" : ""}$${onChain.pnl.toFixed(2)}), Soft Arb: ${t.actual_outcome} (${t.pnl_usd >= 0 ? "+" : ""}$${t.pnl_usd.toFixed(2)})`;
					}
				}

				return { ...t, onChainMismatch: mismatch };
			})
			.sort(
				(a, b) =>
					new Date(b.timestamp).getTime() -
					new Date(a.timestamp).getTime(),
			);
	}, [softArbData, portfolio]);

	const dailyStats = useMemo(() => {
		const stats = { today: 0, yesterday: 0, avg: 0 };
		if (!softArbData) return stats;
		const summary = softArbData.summary as any;
		stats.today = Number(summary?.daily_pnl ?? 0);
		stats.yesterday = Number(summary?.yesterday_pnl ?? 0);
		stats.avg = Number(summary?.avg_daily_pnl ?? 0);
		return stats;
	}, [softArbData]);

	const walletStats = useMemo(() => {
		const summary = (softArbData?.summary ?? {}) as any;
		const positionEquity = (softArbData?.trades ?? []).reduce((sum, trade) => {
			if (!isVisiblePositionStatus(trade.status)) return sum;
			const status = String(trade.status ?? "").toUpperCase();
			if (status === "PAYOUT_CLAIMABLE") {
				return sum + Number(trade.gross_payout ?? 0);
			}
			const currentPrice =
				trade.current_price != null
					? Number(trade.current_price)
					: trade.entry_price != null
						? Number(trade.entry_price)
						: 0;
			return sum + currentPrice * Number(trade.shares ?? 0);
		}, 0);
		return {
			totalWalletValue:
				softArbData?.wallet?.total_wallet_value_usd != null
					? Number(softArbData.wallet.total_wallet_value_usd)
					: summary.wallet_total_value_usd != null
						? Number(summary.wallet_total_value_usd)
						: null,
			portfolioValue:
				softArbData?.wallet?.total_wallet_value_usd != null
					? Number(softArbData.wallet.total_wallet_value_usd) + positionEquity
					: summary.wallet_total_value_usd != null
						? Number(summary.wallet_total_value_usd) + positionEquity
						: null,
			availableCapital:
				softArbData?.wallet?.deployable_bankroll_usd != null
					? Number(softArbData.wallet.deployable_bankroll_usd)
					: summary.available_capital_usd != null
						? Number(summary.available_capital_usd)
						: null,
			fullWalletValue:
				softArbData?.wallet?.total_wallet_value_usd != null
					? softArbData.wallet.total_wallet_value_usd
					: null,
		};
	}, [softArbData]);

	const calibrationFamilies = useMemo(() => {
		const families =
			softArbData?.outcome_feedback?.families ||
			softArbData?.calibration?.families;
		if (!families) return [];
		return Object.entries(families) as [string, SoftArbCalibrationFamily][];
	}, [softArbData]);

	const handleRefresh = useCallback(async () => {
		await Promise.all([refreshSoftArb(), refreshPortfolio()]);
	}, [refreshSoftArb, refreshPortfolio]);

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
						onClick={handleRefresh}
						className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm"
					>
						<IconRefresh
							size={14}
							className={!softArbData ? "animate-spin" : ""}
						/>
						Refresh Dashboard
					</button>
					{softArbData?.summary && (
						<span
							className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
								String(
									softArbData.summary.report_status ?? "",
								).toUpperCase() === "DEGRADED"
									? "bg-amber-100 text-amber-800 border-amber-200"
									: "bg-emerald-100 text-emerald-800 border-emerald-200"
							}`}
						>
							Truth{" "}
							{String(softArbData.summary.report_status ?? "OK").toUpperCase()}
							{Number(softArbData.summary.market_fetch_failures ?? 0) > 0
								? ` · ${Number(
										softArbData.summary.market_fetch_failures ?? 0,
									)} fetch failures`
								: ""}
						</span>
					)}
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
							Open and Claimable Positions
						</h3>
						<span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
							{activePositions.length} ACTIVE
						</span>
					</button>

					{sectionsOpen.positions && (
						<div className="space-y-6">
							{/* Summary stats */}
							<div
								className="grid gap-3"
								style={{
									gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
								}}
							>
								<SummaryCard
									label="Tracked Trades"
									value={softArbData?.trades.length ?? 0}
									icon={<IconArrowsExchange size={20} />}
								/>
								<SummaryCard
									label="Soft Arb Wallet"
									value={walletStats.totalWalletValue}
									icon={<IconWallet size={20} />}
									isCurrency
								/>
								<SummaryCard
									label="Soft Arb Capital"
									value={walletStats.availableCapital}
									icon={<IconCurrencyDollar size={20} />}
									isCurrency
								/>
								<SummaryCard
									label="Soft Arb Portfolio"
									value={walletStats.portfolioValue}
									icon={<IconChartBar size={20} />}
									isCurrency
								/>
								<SummaryCard
									label="Full Wallet Value"
									value={walletStats.fullWalletValue}
									icon={<IconWallet size={20} />}
									isCurrency
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

							{softArbData?.wallet && (
								<div className="text-xs text-muted-foreground">
									Wallet snapshot {timeAgo(softArbData.wallet.updated_at)} ·
									Magic {formatUsd(softArbData.wallet.magic_usdc)} · Phantom
									USDC {formatUsd(softArbData.wallet.phantom_usdc)} · Phantom
									POL {softArbData.wallet.phantom_pol?.toFixed(4) ?? "0"} (
									{formatUsd(softArbData.wallet.phantom_pol_usd_value)})
								</div>
							)}
							<div className="text-xs text-muted-foreground">
								This section only covers Hustle-tracked soft-arb positions. Use
								/arb/polymarket for the full wallet view, including positions
								like Oscar Piatri.
							</div>

							{(portfolio?.alerts ?? []).filter(
								(a) => a.type === "orphaned_trade",
							).length > 0 && (
								<div className="mb-4 rounded border border-red-700 bg-red-950 p-3">
									<p className="mb-1 text-sm font-semibold text-red-400">
										Orphaned Trades — Pipeline recorded but no on-chain position
										found
									</p>
									{portfolio!.alerts
										.filter((a) => a.type === "orphaned_trade")
										.map((a) => (
											<p
												key={a.tradeId ?? a.slug}
												className="text-xs text-red-300"
											>
												{a.message}
											</p>
										))}
								</div>
							)}

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
												<th className="text-right px-4 py-2.5">Actual P&L</th>
											</tr>
										</thead>{" "}
										<tbody>
											{activePositions.map((t) => (
												<tr
													key={t.rowKey || t.trade_id}
													className="border-b border-border/50 last:border-0 hover:bg-muted/5"
												>
													<td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
														{timeAgo(t.opened_at)}
													</td>
													<td className="px-3 py-3">
														<div className="font-semibold text-foreground text-xs leading-snug">
															{t.tradeUrlSlug ? (
																<a
																	href={getPolymarketUrl(t.tradeUrlSlug)!}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-blue-600 hover:underline"
																>
																	{formatTradeName(t.pair, t.tradeUrlSlug)}
																</a>
															) : (
																formatTradeName(t.pair, t.tradeUrlSlug)
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
															) : t.status === "PAYOUT_CLAIMABLE" ? (
																<span className="text-[9px] font-bold px-1.5 rounded bg-violet-100 text-violet-700 flex items-center gap-0.5">
																	<IconCircleCheck size={8} /> CLAIMABLE
																</span>
															) : t.actual_status === "LOG_ONLY" ? (
																<span className="text-[9px] font-bold px-1.5 rounded bg-slate-100 text-slate-700">
																	LOG ONLY
																</span>
															) : null}
															{shieldBadge(t)}
														</div>
													</td>
													<td className="px-3 py-3 text-xs font-medium text-emerald-700">
														<div className="font-bold whitespace-nowrap">
															{normalizeDirection(t.direction)}
														</div>
														{t.target_outcome && (
															<div className="text-[10px] text-slate-500 font-normal truncate max-w-[120px]">
																{t.target_outcome}
															</div>
														)}
													</td>{" "}
													<td className="px-3 py-3 text-right tabular-nums font-medium">
														{t.entry_price?.toFixed(3) ?? "—"}
													</td>
													<td className="px-3 py-3 text-right tabular-nums">
														<div className="text-xs font-bold text-foreground">
															{t.actual_shares > 0
																? `${t.actual_shares.toFixed(1)} sh`
																: "—"}
														</div>
														<div className="text-[10px] text-muted-foreground">
															{t.current_price?.toFixed(3) ?? "—"}
														</div>
													</td>
													<td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-600">
														{formatPct(t.adjusted_edge_pct)}
													</td>
													<td className="px-4 py-3 text-right tabular-nums">
														<PnlBadge value={t.display_pnl} />
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
							{staleOpenTrades.length > 0 && (
								<div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm overflow-hidden">
									<div className="px-4 py-3 border-b border-amber-200 bg-amber-100/60">
										<div className="text-[10px] font-bold tracking-wide uppercase text-amber-800">
											Stale Open Trades
										</div>
										<p className="text-xs text-amber-900 mt-1">
											These ledger rows still say open, but the market expiry
											has passed and there is no live wallet position or order
											attached.
										</p>
									</div>
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-amber-200 bg-white/70 text-[10px] font-bold text-amber-900 tracking-wide uppercase">
												<th className="text-left px-4 py-2.5">Opened</th>
												<th className="text-left px-3 py-2.5">Market</th>
												<th className="text-right px-3 py-2.5">Expired</th>
												<th className="text-right px-4 py-2.5">Last P&L</th>
											</tr>
										</thead>
										<tbody>
											{staleOpenTrades.map((t) => (
												<tr
													key={t.rowKey || t.trade_id}
													className="border-b border-amber-200/60 last:border-0"
												>
													<td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
														{timeAgo(t.opened_at)}
													</td>
													<td className="px-3 py-3">
														<div className="font-semibold text-foreground text-xs leading-snug">
															{t.tradeUrlSlug ? (
																<a
																	href={getPolymarketUrl(t.tradeUrlSlug)!}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-blue-600 hover:underline"
																>
																	{formatTradeName(t.pair, t.tradeUrlSlug)}
																</a>
															) : (
																formatTradeName(t.pair, t.tradeUrlSlug)
															)}
														</div>
														<div className="mt-1 flex gap-1 items-center">
															<span className="text-[9px] font-bold px-1.5 rounded bg-amber-100 text-amber-800">
																RECONCILE
															</span>
															{signalSourceBadge(t.signal_source)}
														</div>
													</td>
													<td className="px-3 py-3 text-right text-xs tabular-nums text-muted-foreground">
														{timeAgo(t.resolves_by)}
													</td>
													<td className="px-4 py-3 text-right tabular-nums">
														<PnlBadge value={t.display_pnl} />
													</td>
												</tr>
											))}
										</tbody>
									</table>
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
						{resolvedTrades.filter((t) => t.onChainMismatch).length > 0 && (
							<span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
								{resolvedTrades.filter((t) => t.onChainMismatch).length} MISMATCH
							</span>
						)}
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
												key={`${t.trade_id}-${t.timestamp}-${t.sample_key || ""}`}
												className="border-b border-border/50 last:border-0 hover:bg-muted/5"
											>
												{" "}
												<td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
													{timeAgo(t.timestamp)}
												</td>
												<td className="px-3 py-3">
													<div className="font-semibold text-foreground text-xs leading-snug">
														{t.polymarket_slug ? (
															<a
																href={
																	getPolymarketUrl(
																		t.event_slug ?? t.polymarket_slug,
																	)!
																}
																target="_blank"
																rel="noopener noreferrer"
																className="text-blue-600 hover:underline"
															>
																{formatTradeName(
																	t.pair,
																	t.event_slug ?? t.polymarket_slug,
																)}
															</a>
														) : (
															formatTradeName(
																t.pair,
																t.event_slug ?? t.polymarket_slug,
															)
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
													<div className="font-bold whitespace-nowrap">
														{normalizeDirection(t.direction)}
													</div>
													{t.target_outcome && (
														<div className="text-[10px] text-slate-400 font-normal truncate max-w-[120px]">
															{t.target_outcome}
														</div>
													)}
												</td>{" "}
												<td className="px-3 py-3 text-right">
													<span
														className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
															t.actual_outcome === "WIN"
																? "bg-emerald-100 text-emerald-700"
																: t.actual_outcome === "LOSS"
																	? "bg-red-100 text-red-700"
																	: "bg-slate-100 text-slate-700"
														}`}
													>
														{t.actual_outcome}
													</span>
												</td>
												<td className="px-4 py-3 text-right tabular-nums">
													<PnlBadge value={t.pnl_usd} />
													{t.onChainMismatch && (
														<div
															className="mt-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"
															title={t.onChainMismatch}
														>
															ON-CHAIN MISMATCH
														</div>
													)}
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
									{unmappedPositions.map((p, index) => (
										<tr
											key={`${p.slug}-${p.outcome}-${index}`}
											className="border-b border-border/50 last:border-0 hover:bg-muted/5"
										>
											<td className="px-4 py-3">
												<div className="font-semibold text-foreground text-xs leading-snug">
													<a
														href={getPolymarketUrl(p.slug)!}
														target="_blank"
														rel="noopener noreferrer"
														className="text-blue-600 hover:underline"
													>
														{p.title}
													</a>
												</div>
												<div className="text-[9px] text-muted-foreground mt-0.5">
													{p.category === "manual"
														? "Manual or other strategy"
														: "Legacy position"}
												</div>
											</td>
											<td className="px-3 py-3">
												<span
													className={`text-[10px] font-bold px-1.5 rounded-full ${
														p.outcome.toLowerCase() === "yes"
															? "bg-emerald-100 text-emerald-700"
															: "bg-red-100 text-red-700"
													}`}
												>
													{p.outcome.toUpperCase()}
												</span>
											</td>
											<td className="px-3 py-3 text-right tabular-nums font-medium">
												{p.onChain.shares?.toFixed(1) ?? "—"}
											</td>
											<td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
												${p.onChain.currentPrice?.toFixed(2) ?? "—"}
											</td>
											<td className="px-4 py-3 text-right tabular-nums">
												<PnlBadge value={p.onChain.unrealizedPnl} />
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
