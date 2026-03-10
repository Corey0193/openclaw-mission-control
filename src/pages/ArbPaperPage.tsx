import { useCallback, useEffect, useMemo, useState } from "react";
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
	IconScan,
	IconChevronDown,
	IconChevronRight,
	IconCircleCheck,
	IconCircleX,
	IconAlertCircle,
	IconLoader2,
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
		<div className="flex items-center gap-3 bg-white border border-border rounded-xl px-5 py-4">
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
						`${value}%`
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
			<div className="font-semibold">{formatPnl(Number(payload[0].value ?? 0))}</div>
		</div>
	);
}

function PairTooltip({ active, payload }: ChartTooltipProps) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as { pair: string; profit: number; count: number };
	return (
		<div className="bg-white border border-border rounded-lg px-3 py-2 shadow-sm text-xs">
			<div className="font-medium mb-1 max-w-[200px] truncate">{d.pair}</div>
			<div className="text-muted-foreground">{d.count} trade{d.count !== 1 ? "s" : ""}</div>
			<div className="font-semibold">{formatPnl(d.profit)}</div>
		</div>
	);
}

function ScatterTooltip({ active, payload }: ChartTooltipProps) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as { viableSize: number; netProfit: number; makerExchange: string; pairName: string };
	return (
		<div className="bg-white border border-border rounded-lg px-3 py-2 shadow-sm text-xs">
			<div className="font-medium mb-1 max-w-[200px] truncate">{d.pairName}</div>
			<div className="text-muted-foreground">Maker: {d.makerExchange}</div>
			<div className="text-muted-foreground">Size: {(Number(d.viableSize) || 0).toFixed(1)} shares</div>
			<div className="font-semibold">{formatPnl(d.netProfit)}</div>
		</div>
	);
}

// --- Chart data hooks ---

type PaperTrade = Doc<"arbPaperTrades">;

function useCumulativePnlData(trades: PaperTrade[]) {
	return useMemo(() => {
		const sorted = [...trades].sort((a, b) => a.epochMs - b.epochMs);
		return sorted.reduce<Array<{ date: string; cumPnl: number }>>((acc, t) => {
			const prev = acc.length > 0 ? acc[acc.length - 1].cumPnl : 0;
			acc.push({
				date: new Date(t.epochMs).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				cumPnl: Math.round((prev + t.netProfit) * 100) / 100,
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
		return [...map.entries()]
			.map(([pair, { profit, count }]) => ({
				pair: pair.length > 30 ? pair.slice(0, 30) + "..." : pair,
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

// --- Pipeline run types and hook ---

interface PipelineRun {
	runId: string;
	dossier: Record<string, unknown> | null;
	verdict: Record<string, unknown> | null;
	decision: Record<string, unknown> | null;
	status: "completed" | "dossier_only" | "verdict_pending" | "no_files";
}

function usePipelineRuns() {
	const [runs, setRuns] = useState<PipelineRun[] | null>(null);
	const refresh = useCallback(() => {
		fetch("/api/pipeline-runs")
			.then((r) => r.json())
			.then((data) => setRuns(data.runs ?? []))
			.catch(() => setRuns([]));
	}, []);
	useEffect(() => {
		refresh();
	}, [refresh]);
	return { runs, refresh };
}

function verdictBadge(verdict: string | undefined) {
	if (!verdict) return null;
	const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
		// Phase 6.6 vocabulary
		TRADEABLE: {
			bg: "bg-emerald-100",
			text: "text-emerald-700",
			icon: <IconCircleCheck size={12} />,
		},
		MARGINAL: {
			bg: "bg-amber-100",
			text: "text-amber-700",
			icon: <IconAlertCircle size={12} />,
		},
		UNTRADEABLE: {
			bg: "bg-red-100",
			text: "text-red-700",
			icon: <IconCircleX size={12} />,
		},
		// Legacy vocabulary (backward compat for archived runs)
		HARD_NO: {
			bg: "bg-red-100",
			text: "text-red-700",
			icon: <IconCircleX size={12} />,
		},
		CONCERNS: {
			bg: "bg-amber-100",
			text: "text-amber-700",
			icon: <IconAlertCircle size={12} />,
		},
		NO_OBJECTION: {
			bg: "bg-emerald-100",
			text: "text-emerald-700",
			icon: <IconCircleCheck size={12} />,
		},
	};
	const style = map[verdict] ?? { bg: "bg-gray-100", text: "text-gray-700", icon: null };
	return (
		<span
			className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${style.bg} ${style.text}`}
		>
			{style.icon}
			{verdict}
		</span>
	);
}

function mismatchBadge(mismatchClass: string | undefined) {
	if (!mismatchClass) return null;
	const map: Record<string, { bg: string; text: string }> = {
		CONTRACT_EQUIVALENT: { bg: "bg-emerald-50", text: "text-emerald-600" },
		SAME_EVENT_SMALL_GAP: { bg: "bg-blue-50", text: "text-blue-600" },
		SAME_EVENT_LARGE_GAP: { bg: "bg-amber-50", text: "text-amber-600" },
		STRUCTURAL_MISMATCH: { bg: "bg-red-50", text: "text-red-600" },
		METADATA_CONFLICT: { bg: "bg-orange-50", text: "text-orange-600" },
		DIFFERENT_EVENT: { bg: "bg-red-100", text: "text-red-700" },
	};
	const style = map[mismatchClass] ?? { bg: "bg-gray-50", text: "text-gray-600" };
	return (
		<span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide ${style.bg} ${style.text}`}>
			{mismatchClass.replace(/_/g, " ")}
		</span>
	);
}

function decisionBadge(decision: string | undefined) {
	if (!decision) return null;
	const map: Record<string, { bg: string; text: string }> = {
		EXECUTE: { bg: "bg-emerald-100", text: "text-emerald-700" },
		PASS: { bg: "bg-gray-100", text: "text-gray-600" },
		ESCALATE_TO_CB: { bg: "bg-amber-100", text: "text-amber-700" },
	};
	const style = map[decision] ?? { bg: "bg-gray-100", text: "text-gray-700" };
	return (
		<span
			className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${style.bg} ${style.text}`}
		>
			{decision}
		</span>
	);
}

function DirectionBadge({ direction }: { direction: string }) {
	if (!direction) return null;
	const isBuyNo = direction === "BUY_NO" || direction === "BUY_POLYMARKET_NO";
	const isBuyYes = direction === "BUY_YES" || direction === "BUY_POLYMARKET_YES";
	if (!isBuyNo && !isBuyYes) {
		return (
			<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-gray-100 text-gray-700" title={direction}>
				{direction.replace(/_/g, " ")}
			</span>
		);
	}
	const label = isBuyNo ? "Bet AGAINST" : "Bet FOR";
	const colors = isBuyNo ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700";
	return (
		<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${colors}`} title={direction.replace(/_/g, " ")}>
			{label} {isBuyNo ? "\u2193" : "\u2191"}
		</span>
	);
}

function EdgeBar({ edge }: { edge: number }) {
	edge = Number(edge) || 0;
	const absEdge = Math.min(Math.abs(edge), 50);
	const width = `${Math.max(absEdge * 2, 4)}%`;
	const color = Math.abs(edge) >= 15 ? "bg-emerald-500" : Math.abs(edge) >= 5 ? "bg-amber-400" : "bg-gray-300";
	return (
		<div className="flex items-center gap-2">
			<div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
				<div className={`h-full rounded-full ${color}`} style={{ width }} />
			</div>
			<span className="text-xs tabular-nums font-medium">
				{edge >= 0 ? "+" : ""}{edge.toFixed(1)}%
			</span>
		</div>
	);
}

function OpportunitySummary({
	dossier,
	verdict,
	decision,
	metaculusItems,
	edgePct,
	direction,
	eventName,
}: {
	dossier: Record<string, unknown> | null;
	verdict: Record<string, unknown> | null;
	decision: Record<string, unknown> | null;
	metaculusItems: Array<{ title: string; mcProb: number; pmPrice: number; edgePct: number; direction: string; matchNotes: string; matchQuality: string; status: string; polymarketUrl: string; polymarketSlug: string }>;
	edgePct: number;
	direction: string;
	eventName: string;
}) {
	const bestItem = metaculusItems.length > 0
		? metaculusItems.reduce((a, b) => Math.abs(b.edgePct) > Math.abs(a.edgePct) ? b : a)
		: undefined;
	if (!bestItem || bestItem.mcProb === 0) return null;

	const mcProb = bestItem.mcProb;
	const pmPrice = bestItem.pmPrice;
	const isBuyNo = bestItem.direction === "BUY_NO" || bestItem.direction === "BUY_POLYMARKET_NO";
	const buyPrice = isBuyNo ? (1 - pmPrice) : pmPrice;
	const returnPer1 = buyPrice > 0 ? (1 / buyPrice) : 0;
	const likelihood = mcProb < 0.3 ? "unlikely" : mcProb > 0.7 ? "likely" : "uncertain";
	const hustleDecision = (decision?.hustle_decision ?? "") as string;
	const hustleReasoning = (decision?.reasoning ?? "") as string;
	const thorpKelly = verdict?.kelly_check as Record<string, unknown> | undefined;
	const thorpMaxRisk = (thorpKelly?.kelly_bet_usd ?? verdict?.max_risk_suggestion_usd ?? null) as string | number | null;
	const pmUrl = bestItem.polymarketSlug ? `https://polymarket.com/market/${bestItem.polymarketSlug}` : "";
	const truncatedTitle = bestItem.title.length > 60 ? bestItem.title.slice(0, 60) + "..." : bestItem.title;

	return (
		<div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-lg px-4 py-3 space-y-2">
			<div className="text-[10px] font-bold tracking-wide text-violet-600 uppercase mb-1">Opportunity Summary</div>
			<div className="text-sm text-gray-800 leading-relaxed">
				<span className="font-medium">The disagreement:</span>{" "}
				Metaculus forecasters say {pmUrl ? (
					<a href={pmUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline decoration-blue-300 hover:decoration-blue-500 hover:text-blue-900 transition-colors" title={bestItem.title}>{truncatedTitle}</a>
				) : (
					<span className="font-semibold">{truncatedTitle}</span>
				)}{" "}
				is {likelihood} ({(mcProb * 100).toFixed(0)}%), but Polymarket prices it at{" "}
				<span className="font-semibold">{(pmPrice * 100).toFixed(1)}%</span>.
			</div>
			<div className="text-sm text-gray-800 leading-relaxed flex items-center gap-1.5 flex-wrap">
				<span className="font-medium">The trade:</span>
				<DirectionBadge direction={bestItem.direction} />
				<span>shares at <span className="font-semibold tabular-nums">${buyPrice.toFixed(2)}</span></span>
				{returnPer1 > 0 && (
					<span>— potential <span className="font-semibold text-emerald-700 tabular-nums">${returnPer1.toFixed(2)}</span> return per $1 bet</span>
				)}
				{thorpMaxRisk !== null && (
					<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-blue-100 text-blue-700">
						Kelly: {typeof thorpMaxRisk === "number" ? `$${thorpMaxRisk}` : thorpMaxRisk}
					</span>
				)}
			</div>
			{hustleDecision && (
				<div className="text-sm text-gray-800 leading-relaxed flex items-center gap-1.5 flex-wrap">
					<span className="font-medium">Final decision:</span>
					{decisionBadge(hustleDecision)}
					{hustleReasoning && (
						<span className="text-gray-500 text-xs">
							— {hustleReasoning.length > 120 ? hustleReasoning.slice(0, 120) + "..." : hustleReasoning}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

function PipelineRunCard({ run }: { run: PipelineRun }) {
	const [expanded, setExpanded] = useState(false);
	const dossier = run.dossier as Record<string, unknown> | null;
	const verdict = run.verdict as Record<string, unknown> | null;
	const decision = run.decision as Record<string, unknown> | null;

	// Detect metaculus vs sports — Raymond produces many schema variants, so cast a wide net
	const isMetaculus = !!(dossier?.opportunities) || !!(dossier?.matches) || !!(dossier?.all_pairs_scanned) || !!(dossier?.matched_pairs) || !!(dossier?.all_scanned) || (dossier?.version === "2.1-metaculus") || String(dossier?.format_version ?? "").includes("metaculus") || String(dossier?.dossier_format_version ?? "").includes("metaculus") || (dossier?.signal_source === "Metaculus") || (dossier?.strategy === "metaculus_vs_polymarket") || String(dossier?.scan_type ?? "").includes("metaculus") || run.runId.startsWith("scan-metaculus-");
	const rawOpportunities = (dossier?.opportunities ?? dossier?.matches ?? dossier?.all_pairs_scanned ?? dossier?.matched_pairs ?? dossier?.all_scanned ?? []) as Array<Record<string, unknown>>;
	const metaculusSummary = (typeof dossier?.summary === "object" ? dossier.summary : undefined) as Record<string, unknown> | undefined;
	const bestOpportunity = dossier?.best_opportunity as Record<string, unknown> | undefined;

	// Fallback slug from best_opportunity
	const bestOppSlug = String(bestOpportunity?.polymarket_market_slug ?? bestOpportunity?.polymarket_slug ?? "");

	// Robust normalizer — handles 7+ dossier schema variants from Raymond
	function normalizeItem(item: Record<string, unknown>) {
		// Nested objects vary by format: metaculus_question vs metaculus, polymarket_market vs polymarket, edge vs edge_analysis
		const mcQ = typeof item.metaculus_question === "object" ? item.metaculus_question as Record<string, unknown> : undefined;
		const mcObj = typeof item.metaculus === "object" ? item.metaculus as Record<string, unknown> : undefined;
		const pmM = typeof item.polymarket_market === "object" ? item.polymarket_market as Record<string, unknown> : undefined;
		const pmObj = typeof item.polymarket === "object" ? item.polymarket as Record<string, unknown> : undefined;
		const edgeObj = typeof item.edge === "object" && item.edge !== null ? item.edge as Record<string, unknown> : undefined;
		const edgeAn = typeof item.edge_analysis === "object" ? item.edge_analysis as Record<string, unknown> : undefined;
		const rec = typeof item.recommendation === "object" ? item.recommendation as Record<string, unknown> : undefined;

		const title = String(
			mcQ?.title ?? mcObj?.question_title ??
			item.metaculus_title ?? item.title ??
			(typeof item.metaculus_question === "string" ? item.metaculus_question : undefined) ??
			pmM?.question ?? pmObj?.question_title ??
			item.polymarket_title ?? item.polymarket_market_question ?? item.polymarket_question ??
			bestOpportunity?.metaculus_question ?? bestOpportunity?.polymarket_question ??
			"—"
		);

		const mcProb = Number(
			edgeObj?.metaculus_prob ?? edgeAn?.metaculus_prob ??
			mcQ?.community_prediction ?? mcObj?.community_prediction ??
			item.metaculus_prob ?? item.metaculus_probability ?? item.metaculus_probability_yes ??
			item.metaculus_prediction ?? item.metaculus_community_prob ?? 0
		) || 0;

		const pmPrice = Number(
			edgeObj?.polymarket_price ?? edgeAn?.polymarket_price ??
			(pmM?.outcome_prices as number[] | undefined)?.[0] ??
			pmM?.yes_price ?? pmObj?.yes_price ??
			item.polymarket_price ?? item.polymarket_yes_price ?? item.polymarket_probability_yes ?? 0
		) || 0;

		// Edge percentage: check explicit pct fields first, then compute from decimal edge
		const pctCandidates = [edgeObj?.edge_pct, edgeAn?.edge_pct, item.edge_percent, item.edge_pct];
		let edgePctVal = pctCandidates.find((v) => v != null);
		// Some formats store edge_pct as a decimal (e.g., -0.45 instead of -45)
		if (edgePctVal != null && Math.abs(Number(edgePctVal)) < 1 && mcProb > 0) {
			edgePctVal = Number(edgePctVal) * 100;
		}
		const edgePct = edgePctVal != null
			? Number(edgePctVal)
			: typeof item.edge === "number" ? Number(item.edge) * 100
			: typeof edgeAn?.edge === "number" ? Number(edgeAn.edge) * 100
			: 0;

		const direction = String(
			edgeObj?.direction ?? edgeAn?.direction ?? item.direction ?? rec?.action ?? ""
		);

		const matchQualityRaw = item.match_quality;
		const matchQuality = String(
			(typeof matchQualityRaw === "string" ? matchQualityRaw : undefined) ??
			(typeof matchQualityRaw === "object" && matchQualityRaw ? (matchQualityRaw as Record<string, unknown>).confidence : undefined) ??
			item.match_confidence ?? ""
		);

		const polymarketSlug = String(
			item.polymarket_slug ?? item.polymarket_market_slug ??
			(pmM?.slug as string | undefined) ?? (pmObj?.slug as string | undefined) ??
			bestOppSlug ?? ""
		);

		return {
			title,
			matchNotes: String(item.match_notes ?? item.notes ?? item.confidence_reason ?? item.reasoning ?? item.rationale ?? ""),
			mcProb,
			pmPrice,
			edgePct,
			direction,
			matchQuality,
			status: String(item.status ?? ""),
			polymarketUrl: String((pmM?.url as string | undefined) ?? (pmObj?.url as string | undefined) ?? ""),
			polymarketSlug,
		};
	}

	const metaculusItems = isMetaculus ? rawOpportunities.map(normalizeItem) : [];

	// Sports fields
	const edgeAnalysis = dossier?.edge_analysis as Record<string, unknown> | undefined;
	const allGames = (dossier?.all_games_scanned ?? []) as Array<Record<string, unknown>>;

	// Unified header fields
	let edgePct: number;
	let direction: string;
	let targetOutcome: string;
	let eventName: string;
	let sourceBadge: string;
	let confidence: string;

	if (isMetaculus) {
		const bestItem = metaculusItems.length > 0
			? metaculusItems.reduce((a, b) => Math.abs(b.edgePct) > Math.abs(a.edgePct) ? b : a)
			: undefined;
		// When no items were normalized but best_opportunity exists, extract header from it directly
		const bestOppEdgeRaw = bestOpportunity?.edge;
		const bestOppEdgePct = typeof bestOppEdgeRaw === "number" ? Number(bestOppEdgeRaw) * 100
			: Number(bestOpportunity?.edge_percent ?? bestOpportunity?.edge_pct ?? 0) || undefined;
		const bestOppTitle = String(bestOpportunity?.title ?? bestOpportunity?.metaculus_question ?? bestOpportunity?.polymarket_question ?? "");
		edgePct = Number(metaculusSummary?.best_edge ?? metaculusSummary?.best_edge_pct ?? bestOppEdgePct ?? bestItem?.edgePct ?? 0) || 0;
		direction = String(metaculusSummary?.best_edge_direction ?? bestOpportunity?.direction ?? bestItem?.direction ?? "");
		targetOutcome = String(metaculusSummary?.best_edge_subject ?? bestOppTitle ?? bestItem?.title ?? "");
		eventName = bestOppTitle || bestItem?.title || "Metaculus Scan";
		sourceBadge = "Metaculus";
		confidence = String(bestOpportunity?.match_quality ?? bestOpportunity?.match_confidence ?? bestItem?.matchQuality ?? "");
	} else {
		const bestOpp = dossier?.best_opportunity as Record<string, unknown> | undefined;
		const bestOppEdge = typeof bestOpp?.edge === "object" && bestOpp?.edge !== null ? bestOpp.edge as Record<string, unknown> : undefined;
		const bestOppAbsEdge = bestOppEdge?.absolute_edge ?? bestOppEdge?.home_edge ?? bestOppEdge?.away_edge;
		edgePct = Number(edgeAnalysis?.edge_pct ?? edgeAnalysis?.edge_after_vig_pct ?? edgeAnalysis?.raw_edge_pct ?? (typeof bestOppAbsEdge === "number" ? bestOppAbsEdge * 100 : 0)) || 0;
		direction = String(edgeAnalysis?.direction ?? (bestOppEdge?.direction as string | undefined) ?? "");
		targetOutcome = String(edgeAnalysis?.target_outcome ?? (bestOppEdge?.team as string | undefined) ?? "");
		eventName = String(dossier?.event_name ?? (bestOpp?.game as string | undefined) ?? "Unknown");
		sourceBadge = String(dossier?.sport_league ?? dossier?.sport ?? (bestOpp?.sport as string | undefined) ?? "");
		confidence = String(dossier?.raymond_confidence ?? (bestOpp?.confidence as string | undefined) ?? "");
	}

	const thorpVerdict = (verdict?.verdict ?? verdict?.final_verdict ?? "") as string;
	const thorpSummary = (verdict?.thorp_note ?? verdict?.summary ?? "") as string;
	const thorpMismatchClass = (verdict?.mismatch_class ?? "") as string;
	const thorpRawEdge = verdict?.raw_edge as number | undefined;
	const thorpAdjustedEdge = verdict?.adjusted_edge as number | undefined;
	const thorpAdjustments = (verdict?.adjustments ?? []) as Array<Record<string, unknown>>;
	// Phase 6.6: objections array with severity field; legacy: separate fatal_objections + concerns
	const thorpObjArr = (verdict?.objections ?? []) as Array<Record<string, unknown>>;
	const thorpFatalObjs = thorpObjArr.length > 0
		? thorpObjArr.filter((o) => o.severity === "FATAL")
		: (verdict?.fatal_objections ?? []) as Array<Record<string, unknown> | string>;
	const thorpConcernsRaw = thorpObjArr.length > 0
		? thorpObjArr.filter((o) => o.severity === "MAJOR" || o.severity === "MINOR")
		: (verdict?.concerns ?? []) as Array<Record<string, unknown> | string>;
	const thorpConcerns = thorpConcernsRaw.map((c) =>
		typeof c === "string" ? c : ((c.argument ?? c.detail ?? c.reason ?? c.code ?? "") as string)
	);
	const thorpChecks = (verdict?.checks_performed ?? verdict?.checks ?? []) as Array<Record<string, unknown>>;
	// Phase 6.6: kelly_check object; legacy: max_risk_suggestion_usd
	const thorpKellyCheck = verdict?.kelly_check as Record<string, unknown> | undefined;
	const thorpMaxRisk = (thorpKellyCheck?.kelly_bet_usd ?? verdict?.max_risk_suggestion_usd ?? null) as string | number | null;

	// Scan stats (computed here to avoid IIFE in JSX)
	const hasScanStats = isMetaculus && !!(metaculusSummary || dossier?.all_games_scanned || dossier?.all_pairs_scanned);
	const scanStatsScanned = metaculusSummary?.scanned_metaculus_questions ?? (dossier?.all_pairs_scanned as unknown[] | undefined)?.length ?? dossier?.all_games_scanned ?? "?";
	const scanStatsCandidates = metaculusItems.filter((m) => m.status !== "skipped_no_prediction_data" && m.status !== "skipped_low_forecaster_count" && m.matchQuality !== "N/A");
	const scanStatsMatched = metaculusSummary?.matched_pairs ?? dossier?.matches_count ?? scanStatsCandidates.length;
	const scanStatsAboveThresh = metaculusSummary?.meets_threshold ?? dossier?.opportunities_found ?? scanStatsCandidates.filter((m) => m.status === "candidate" || m.matchQuality === "HIGH" || m.matchQuality === "MEDIUM").length;

	const hustleDecision = (decision?.hustle_decision ?? "") as string;
	const hustleReasoning = (decision?.reasoning ?? "") as string;
	const hustleMismatchClass = (decision?.mismatch_class ?? "") as string;
	const hustleAdjustedEdge = decision?.adjusted_edge as number | string | undefined;

	const cardBorderClass = hustleDecision === "EXECUTE" ? "border-l-4 border-l-emerald-400"
		: hustleDecision === "PASS" ? "border-l-4 border-l-gray-300"
		: hustleDecision === "ESCALATE_TO_CB" ? "border-l-4 border-l-amber-400"
		: "";

	return (
		<div className={`bg-white border border-border rounded-xl overflow-hidden ${cardBorderClass}`}>
			{/* Header row — always visible */}
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
			>
				<div className="text-muted-foreground">
					{expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="text-xs font-mono text-muted-foreground tabular-nums">
							{run.runId}
						</span>
						{sourceBadge && (
							<span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${isMetaculus ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
								{sourceBadge}
							</span>
						)}
						{isMetaculus && metaculusItems.length > 1 && (
							<span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-gray-100 text-gray-600">
								{metaculusItems.length} pairs
							</span>
						)}
						<span className="text-sm font-semibold text-foreground truncate">
							{eventName}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-3 shrink-0">
					<EdgeBar edge={edgePct} />
					{verdictBadge(thorpVerdict)}
					{decisionBadge(hustleDecision)}
				</div>
			</button>

			{/* Expanded detail */}
			{expanded && (
				<div className="border-t border-border px-4 py-4 space-y-4">
					{/* Plain-English summary banner (Metaculus only) */}
					{isMetaculus && <OpportunitySummary dossier={dossier} verdict={verdict} decision={decision} metaculusItems={metaculusItems} edgePct={edgePct} direction={direction} eventName={eventName} />}

					{/* Three-stage pipeline viz */}
					<div className="flex items-stretch gap-0">
						{/* Raymond */}
						<div className="flex-1 min-w-0 rounded-lg border border-border p-3">
							<div className="flex items-center gap-2 mb-2">
								<span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">1</span>
								<IconScan size={14} className="text-blue-600" />
								<span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
									Raymond — Scanner
								</span>
							</div>
							{dossier ? (
								<div className="space-y-1.5 text-xs">
									<div>
										<span className="text-muted-foreground">Edge: </span>
										<span className="font-semibold">
											{Number(edgePct) >= 0 ? "+" : ""}{(Number(edgePct) || 0).toFixed(1)}%
										</span>
									</div>
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground">Direction: </span>
										<DirectionBadge direction={direction} />
										{targetOutcome && <span className="font-medium text-[11px]">on {targetOutcome}</span>}
									</div>
									<div>
										<span className="text-muted-foreground">{isMetaculus ? "Match: " : "Confidence: "}</span>
										<span className={`font-bold ${confidence === "HIGH" ? "text-emerald-600" : confidence === "MEDIUM" ? "text-amber-600" : "text-red-500"}`}>
											{confidence}
										</span>
									</div>
									{thorpMaxRisk !== null && (
										<div className="mt-1">
											<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-blue-100 text-blue-700">
												Kelly: {typeof thorpMaxRisk === "number" ? `$${thorpMaxRisk}` : String(thorpMaxRisk)}
											</span>
										</div>
									)}
									{hasScanStats && (
										<div className="text-muted-foreground text-[11px] mt-1 leading-relaxed">
											{String(scanStatsScanned)} scanned, {String(scanStatsMatched)} matched, {String(scanStatsAboveThresh)} above threshold
										</div>
									)}
									{dossier.raymond_note && (
										<div className="text-muted-foreground text-[11px] mt-1 leading-relaxed">
											{dossier.raymond_note as string}
										</div>
									)}
								</div>
							) : (
								<div className="text-xs text-muted-foreground">No dossier</div>
							)}
						</div>

						{/* Arrow 1→2 */}
						<div className="flex items-center px-1 text-gray-300">
							<IconChevronRight size={20} />
						</div>

						{/* Thorp */}
						<div className="flex-1 min-w-0 rounded-lg border border-border p-3">
							<div className="flex items-center gap-2 mb-2">
								<span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">2</span>
								<IconShieldCheck size={14} className="text-purple-600" />
								<span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
									Thorp — Verifier
								</span>
							</div>
							{verdict ? (
								<div className="space-y-1.5 text-xs">
									<div className="flex items-center gap-2 flex-wrap">
										{verdictBadge(thorpVerdict)}
										{mismatchBadge(thorpMismatchClass)}
									</div>
									{(thorpRawEdge !== undefined || thorpAdjustedEdge !== undefined) && (
										<div>
											{thorpRawEdge !== undefined && (
												<span className="text-muted-foreground">Raw: <span className="font-semibold text-foreground tabular-nums">{(thorpRawEdge * 100).toFixed(1)}%</span></span>
											)}
											{thorpAdjustedEdge !== undefined && (
												<span className="text-muted-foreground ml-2">Adj: <span className="font-semibold text-foreground tabular-nums">{(thorpAdjustedEdge * 100).toFixed(1)}%</span></span>
											)}
										</div>
									)}
									{thorpAdjustments.length > 0 && (
										<div className="space-y-0.5 mt-1">
											{thorpAdjustments.map((adj, i) => (
												<div key={i} className="text-[10px] text-muted-foreground">
													{adj.type as string}: <span className="tabular-nums">{((adj.value as number) * 100).toFixed(2)}%</span>
													{adj.reason && <span className="ml-1">({adj.reason as string})</span>}
												</div>
											))}
										</div>
									)}
									{thorpSummary && (
										<div className="text-muted-foreground text-[11px] leading-relaxed">
											{thorpSummary}
										</div>
									)}
									{thorpFatalObjs.length > 0 && (
										<div className="space-y-1 mt-1">
											{thorpFatalObjs.map((obj, i) => (
												<div key={i} className="flex items-start gap-1.5 text-red-600">
													<IconCircleX size={12} className="mt-0.5 shrink-0" />
													<span className="text-[11px] leading-relaxed">
														{typeof obj === "string" ? obj : (obj.argument ?? obj.detail ?? obj.reason ?? obj.code ?? "") as string}
													</span>
												</div>
											))}
										</div>
									)}
									{thorpConcerns.length > 0 && (
										<div className="space-y-1 mt-1">
											{thorpConcerns.map((concern, i) => (
												<div key={i} className="flex items-start gap-1.5 text-amber-600">
													<IconAlertTriangle size={12} className="mt-0.5 shrink-0" />
													<span className="text-[11px] leading-relaxed">{concern}</span>
												</div>
											))}
										</div>
									)}
									{thorpChecks.length > 0 && (
										<div className="space-y-1 mt-1">
											{thorpChecks.map((check, i) => (
												<div key={i} className="flex items-start gap-1.5">
													{(check.result as string)?.startsWith("PASS") ? (
														<IconCircleCheck size={12} className="text-emerald-500 mt-0.5 shrink-0" />
													) : (
														<IconCircleX size={12} className="text-red-500 mt-0.5 shrink-0" />
													)}
													<span className="text-[11px] text-muted-foreground">
														{check.name as string}
													</span>
												</div>
											))}
										</div>
									)}
									{thorpMaxRisk !== null && (
										<div className="mt-1">
											<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-blue-100 text-blue-700">
												Kelly: {typeof thorpMaxRisk === "number" ? `$${thorpMaxRisk}` : thorpMaxRisk}
											</span>
										</div>
									)}
								</div>
							) : (
								<div className="text-xs text-muted-foreground">
									{run.status === "dossier_only" ? "Awaiting dispatch" : "Not triggered"}
								</div>
							)}
						</div>

						{/* Arrow 2→3 */}
						<div className="flex items-center px-1 text-gray-300">
							<IconChevronRight size={20} />
						</div>

						{/* Hustle */}
						<div className="flex-1 min-w-0 rounded-lg border border-border p-3">
							<div className="flex items-center gap-2 mb-2">
								<span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold">3</span>
								<IconArrowsExchange size={14} className="text-orange-600" />
								<span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
									Hustle — Decision
								</span>
							</div>
							{decision ? (
								<div className="space-y-1.5 text-xs">
									<div className="flex items-center gap-2 flex-wrap">
										{decisionBadge(hustleDecision)}
										{hustleMismatchClass && mismatchBadge(hustleMismatchClass)}
									</div>
									{hustleAdjustedEdge !== undefined && (
										<div className="text-muted-foreground">
											Adj. edge: <span className="font-semibold text-foreground tabular-nums">{typeof hustleAdjustedEdge === "number" ? `${(hustleAdjustedEdge * 100).toFixed(1)}%` : hustleAdjustedEdge}</span>
										</div>
									)}
									{hustleReasoning && (
										<div className="text-muted-foreground text-[11px] leading-relaxed">
											{hustleReasoning}
										</div>
									)}
								</div>
							) : (
								<div className="text-xs text-muted-foreground">
									Waiting for verdict
								</div>
							)}
						</div>
					</div>

					{/* Metaculus opportunities table */}
					{isMetaculus && metaculusItems.length > 0 && (
						<div>
							<div className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase mb-2">
								Matched Opportunities ({metaculusItems.length})
							</div>
							<div className="bg-gray-50 rounded-lg overflow-x-auto">
								<table className="w-full text-xs">
									<thead>
										<tr className="text-[10px] text-muted-foreground font-semibold tracking-wide uppercase">
											<th className="text-left px-3 py-2">Question</th>
											<th className="text-right px-3 py-2">Metaculus YES</th>
											<th className="text-right px-3 py-2">Polymarket YES</th>
											<th className="text-center px-2 py-2" title="Visual probability comparison">&nbsp;</th>
											<th className="text-right px-3 py-2">Edge</th>
											<th className="text-left px-3 py-2">Trade</th>
											<th className="text-right px-3 py-2">Return / $1</th>
										</tr>
									</thead>
									<tbody>
										{metaculusItems.map((item, i) => {
											const isBuyNo = item.direction === "BUY_NO" || item.direction === "BUY_POLYMARKET_NO";
											const buyPrice = isBuyNo ? (1 - item.pmPrice) : item.pmPrice;
											const returnPer1 = buyPrice > 0 ? (1 / buyPrice) : 0;
											const itemPmUrl = item.polymarketSlug ? `https://polymarket.com/market/${item.polymarketSlug}` : "";
											return (
												<tr key={i} className={i < metaculusItems.length - 1 ? "border-b border-border/30" : ""}>
													<td className="px-3 py-1.5">
														{itemPmUrl ? (
															<a href={itemPmUrl} target="_blank" rel="noopener noreferrer" className="font-medium max-w-[280px] truncate block text-blue-700 underline decoration-blue-200 hover:decoration-blue-500 hover:text-blue-900 transition-colors" title={item.title}>
																{item.title}
															</a>
														) : (
															<div className="font-medium max-w-[280px] truncate" title={item.title}>
																{item.title}
															</div>
														)}
														{item.matchNotes && (
															<div className="text-[10px] text-muted-foreground max-w-[280px] truncate" title={item.matchNotes}>
																{item.matchNotes}
															</div>
														)}
													</td>
													<td className="text-right px-3 py-1.5 tabular-nums font-medium">
														{(item.mcProb * 100).toFixed(0)}%
													</td>
													<td className="text-right px-3 py-1.5 tabular-nums font-medium">
														{(item.pmPrice * 100).toFixed(1)}%
													</td>
													<td className="px-2 py-1.5">
														<div className="w-16 space-y-0.5" title={`Metaculus ${(item.mcProb * 100).toFixed(0)}% vs Polymarket ${(item.pmPrice * 100).toFixed(1)}%`}>
															<div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
																<div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.max(item.mcProb * 100, 2)}%` }} />
															</div>
															<div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
																<div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.max(item.pmPrice * 100, 2)}%` }} />
															</div>
														</div>
													</td>
													<td className="text-right px-3 py-1.5">
														<EdgeBar edge={item.edgePct} />
													</td>
													<td className="px-3 py-1.5 whitespace-nowrap">
														<div className="flex items-center gap-1.5">
															<DirectionBadge direction={item.direction} />
															<span className="text-muted-foreground tabular-nums text-[10px]">@ ${buyPrice.toFixed(2)}</span>
														</div>
													</td>
													<td className="text-right px-3 py-1.5 tabular-nums font-semibold">
														{returnPer1 > 0 ? `$${returnPer1.toFixed(2)}` : "---"}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{/* All games scanned table (sports) */}
					{!isMetaculus && allGames.length > 0 && (
						<div>
							<div className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase mb-2">
								All Games Scanned ({allGames.length})
							</div>
							<div className="bg-gray-50 rounded-lg overflow-x-auto">
								<table className="w-full text-xs">
									<thead>
										<tr className="text-[10px] text-muted-foreground font-semibold tracking-wide uppercase">
											<th className="text-left px-3 py-2">Game</th>
											<th className="text-right px-3 py-2">Edge</th>
											<th className="text-left px-3 py-2">Direction</th>
										</tr>
									</thead>
									<tbody>
										{(allGames as Array<{ game?: string; edge_pct?: number; away_edge?: number; home_edge?: number; direction?: string; status?: string; team?: string }>)
											.map((g) => {
												const edgeVal = g.edge_pct ?? (Math.max(Math.abs(g.away_edge ?? 0), Math.abs(g.home_edge ?? 0)) * 100);
												return { ...g, _edge: edgeVal };
											})
											.sort((a, b) => Math.abs(b._edge) - Math.abs(a._edge))
											.map((g, i) => (
												<tr key={i} className={i < allGames.length - 1 ? "border-b border-border/30" : ""}>
													<td className="px-3 py-1.5">
														<div className="font-medium">{g.game ?? "—"}</div>
														{g.status && g.status !== "matched" && (
															<div className="text-[10px] text-muted-foreground">{g.status.replace(/_/g, " ")}</div>
														)}
													</td>
													<td className="text-right px-3 py-1.5">
														<EdgeBar edge={g._edge} />
													</td>
													<td className="px-3 py-1.5">
														{g.direction ? <DirectionBadge direction={g.direction} /> : <span className="text-muted-foreground">—</span>}
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default function ArbPaperPage() {
	const trades = useQuery(api.arbPaperTrades.listPaperTrades, {
		tenantId: DEFAULT_TENANT_ID,
	});
	const summary = useQuery(api.arbPaperTrades.getPaperTradeSummary, {
		tenantId: DEFAULT_TENANT_ID,
	});

	const { runs: pipelineRuns, refresh: refreshPipeline } = usePipelineRuns();

	const [showLowConf, setShowLowConf] = useState(false);

	const allTrades = trades ?? [];

	const filteredTrades = useMemo(
		() =>
			showLowConf
				? allTrades
				: allTrades.filter((t) => (t.confidence ?? "HIGH") === "HIGH"),
		[allTrades, showLowConf],
	);

	const unresolvedTrades = filteredTrades.filter(
		(t) => t.status === "PAPER_FILL",
	);
	const resolvedTrades = filteredTrades.filter(
		(t) => t.status === "RESOLVED_WIN" || t.status === "RESOLVED_LOSS",
	);

	const cumulativeData = useCumulativePnlData(filteredTrades);
	const pairData = useProfitByPairData(filteredTrades);
	const scatterData = useScatterData(filteredTrades);

	return (
		<div className="h-screen overflow-y-auto bg-[#f8f9fa]">
			<Header />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
				{/* Page title */}
				<div className="flex items-center gap-3">
					<div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-orange)] text-white">
						<IconArrowsExchange size={20} />
					</div>
					<div>
						<h2 className="text-lg font-bold text-foreground tracking-tight">
							Arb Paper Trades
						</h2>
						<p className="text-[11px] text-muted-foreground">
							Simulated cross-exchange arbitrage fills
						</p>
					</div>
				</div>

				{/* Pipeline Runs section — Soft Arb */}
				<section className="rounded-xl border-l-4 border-l-violet-400 bg-violet-50/40 p-4">
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-2">
							<IconScan size={16} className="text-violet-600" />
							<h3 className="text-sm font-bold text-violet-900 tracking-wide uppercase">
								Soft Arb Pipeline
							</h3>
							<span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-violet-100 text-violet-700">
								FORECAST vs MARKET
							</span>
							{pipelineRuns && pipelineRuns.length > 0 && (
								<span className="text-muted-foreground text-xs font-normal normal-case">
									({pipelineRuns.length} scan{pipelineRuns.length !== 1 ? "s" : ""})
								</span>
							)}
						</div>
						<button
							type="button"
							onClick={refreshPipeline}
							className="text-[10px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-gray-50 transition-colors uppercase tracking-wide"
						>
							Refresh
						</button>
					</div>
					{pipelineRuns === null ? (
						<div className="h-20 bg-white border border-border rounded-xl animate-pulse" />
					) : pipelineRuns.length === 0 ? (
						<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
							<IconScan size={32} strokeWidth={1.2} className="mx-auto mb-2 opacity-40" />
							<p className="font-medium">No pipeline runs yet</p>
							<p className="text-xs mt-1">Send &quot;arb scan&quot; to Hustle to trigger a scan</p>
						</div>
					) : (
						<div className="space-y-2">
							{pipelineRuns.map((run) => (
								<PipelineRunCard key={run.runId} run={run} />
							))}
						</div>
					)}
				</section>

				{/* Hard Arb — Paper Trades */}
				{trades === undefined || summary === undefined ? (
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{[...Array(4)].map((_, i) => (
							<div
								key={i}
								className="h-20 bg-white border border-border rounded-xl animate-pulse"
							/>
						))}
					</div>
				) : allTrades.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
						<IconArrowsExchange
							size={48}
							strokeWidth={1.2}
							className="mb-4 opacity-40"
						/>
						<p className="text-sm font-medium">
							No paper trades yet
						</p>
						<p className="text-xs mt-1">
							Run the arb engine with PAPER_MODE=true to start
							recording simulated fills
						</p>
					</div>
				) : (
					<section className="rounded-xl border-l-4 border-l-blue-400 bg-blue-50/40 p-4 space-y-6">
						<div className="flex items-center gap-2 mb-1">
							<IconArrowsExchange size={16} className="text-blue-600" />
							<h3 className="text-sm font-bold text-blue-900 tracking-wide uppercase">
								Hard Arb — Paper Trades
							</h3>
							<span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-blue-100 text-blue-700">
								CROSS-EXCHANGE
							</span>
						</div>
						{/* Confidence filter toggle */}
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => setShowLowConf((v) => !v)}
								className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
									showLowConf
										? "border-amber-300 bg-amber-50 text-amber-700"
										: "border-emerald-300 bg-emerald-50 text-emerald-700"
								}`}
							>
								{showLowConf ? (
									<IconAlertTriangle size={14} />
								) : (
									<IconShieldCheck size={14} />
								)}
								{showLowConf
									? "Showing all trades"
									: "High confidence only"}
							</button>
							{!showLowConf && summary.lowConfTrades > 0 && (
								<span className="text-[11px] text-muted-foreground">
									{summary.lowConfTrades} low-confidence trade{summary.lowConfTrades !== 1 ? "s" : ""} hidden ({formatPnl(summary.lowConfPnl)} excluded)
								</span>
							)}
						</div>

						{/* Summary cards */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<SummaryCard
								label={showLowConf ? "Total Paper Trades" : "High Conf. Trades"}
								value={showLowConf ? summary.totalTrades : summary.highConfTrades}
								icon={<IconArrowsExchange size={20} />}
							/>
							<SummaryCard
								label="Projected P&L"
								value={showLowConf ? summary.projectedPnl : summary.highConfPnl}
								icon={<IconTrendingUp size={20} />}
								isPnl
							/>
							<SummaryCard
								label="Win Rate"
								value={summary.winRate}
								icon={<IconPercentage size={20} />}
								isPercent
							/>
							<SummaryCard
								label="Actual P&L"
								value={summary.actualPnl}
								icon={<IconChartBar size={20} />}
								isPnl
							/>
						</div>

						{/* Strategy Analytics Charts */}
						<section>
							<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
								Strategy Analytics
							</h3>

							<div className="space-y-4">
								{/* Chart A: Cumulative P&L — full width */}
								<div className="bg-white border border-border rounded-xl p-5">
									<div className="text-xs font-semibold text-muted-foreground tracking-wide uppercase mb-4">
										Cumulative P&L Over Time
									</div>
									<ResponsiveContainer width="100%" height={240}>
										<AreaChart data={cumulativeData}>
											<defs>
												<linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
													<stop offset="0%" stopColor="#1dd1a1" stopOpacity={0.3} />
													<stop offset="100%" stopColor="#1dd1a1" stopOpacity={0.02} />
												</linearGradient>
											</defs>
											<CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
											<XAxis
												dataKey="date"
												tick={{ fontSize: 11, fill: "#6b7280" }}
												tickLine={false}
												axisLine={{ stroke: "#e5e7eb" }}
											/>
											<YAxis
												tick={{ fontSize: 11, fill: "#6b7280" }}
												tickLine={false}
												axisLine={false}
												tickFormatter={(v: number) => `$${v}`}
											/>
											<Tooltip content={<PnlTooltip />} />
											<Area
												type="monotone"
												dataKey="cumPnl"
												stroke="#1dd1a1"
												strokeWidth={2}
												fill="url(#pnlGradient)"
											/>
										</AreaChart>
									</ResponsiveContainer>
								</div>

								{/* Charts B & C side by side */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{/* Chart B: Profit by Market Pair */}
									<div className="bg-white border border-border rounded-xl p-5">
										<div className="text-xs font-semibold text-muted-foreground tracking-wide uppercase mb-4">
											Profit by Market Pair
										</div>
										<ResponsiveContainer width="100%" height={280}>
											<BarChart
												data={pairData}
												layout="vertical"
												margin={{ left: 10, right: 20 }}
											>
												<CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
												<XAxis
													type="number"
													tick={{ fontSize: 11, fill: "#6b7280" }}
													tickLine={false}
													axisLine={{ stroke: "#e5e7eb" }}
													tickFormatter={(v: number) => `$${v}`}
												/>
												<YAxis
													type="category"
													dataKey="pair"
													tick={{ fontSize: 10, fill: "#6b7280" }}
													tickLine={false}
													axisLine={false}
													width={120}
												/>
												<Tooltip content={<PairTooltip />} />
												<Bar dataKey="profit" radius={[0, 4, 4, 0]}>
													{pairData.map((entry, idx) => (
														<Cell
															key={idx}
															fill={entry.profit >= 0 ? "#1dd1a1" : "#ee5253"}
														/>
													))}
												</Bar>
											</BarChart>
										</ResponsiveContainer>
									</div>

									{/* Chart C: Size vs Profit Scatter */}
									<div className="bg-white border border-border rounded-xl p-5">
										<div className="text-xs font-semibold text-muted-foreground tracking-wide uppercase mb-3">
											Trade Size vs. Profit
										</div>
										<div className="flex items-center gap-4 mb-3">
											<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
												<span className="inline-block w-2.5 h-2.5 rounded-full bg-[#54a0ff]" />
												Polymarket maker
											</div>
											<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
												<span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ff9f43]" />
												Other maker
											</div>
										</div>
										<ResponsiveContainer width="100%" height={240}>
											<ScatterChart margin={{ bottom: 5 }}>
												<CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
												<XAxis
													dataKey="viableSize"
													type="number"
													name="Size"
													tick={{ fontSize: 11, fill: "#6b7280" }}
													tickLine={false}
													axisLine={{ stroke: "#e5e7eb" }}
													label={{ value: "Size (shares)", position: "insideBottom", offset: -2, fontSize: 10, fill: "#9ca3af" }}
												/>
												<YAxis
													dataKey="netProfit"
													type="number"
													name="Profit"
													tick={{ fontSize: 11, fill: "#6b7280" }}
													tickLine={false}
													axisLine={false}
													tickFormatter={(v: number) => `$${v}`}
												/>
												<Tooltip content={<ScatterTooltip />} />
												<Scatter data={scatterData}>
													{scatterData.map((entry, idx) => (
														<Cell
															key={idx}
															fill={entry.makerExchange === "polymarket" ? "#54a0ff" : "#ff9f43"}
															fillOpacity={0.7}
														/>
													))}
												</Scatter>
											</ScatterChart>
										</ResponsiveContainer>
									</div>
								</div>
							</div>
						</section>

						{/* Unresolved trades */}
						<section>
							<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
								Unresolved
								{unresolvedTrades.length > 0 && (
									<span className="ml-2 text-muted-foreground font-normal normal-case">
										({unresolvedTrades.length})
									</span>
								)}
							</h3>
							{unresolvedTrades.length === 0 ? (
								<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
									No unresolved trades
								</div>
							) : (
								<div className="bg-white border border-border rounded-xl overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
												<th className="text-left px-4 py-3">
													Time
												</th>
												<th className="text-left px-3 py-3">
													Pair
												</th>
												<th className="text-left px-3 py-3">
													Maker
												</th>
												<th className="text-left px-3 py-3">
													Taker
												</th>
												<th className="text-right px-3 py-3">
													Maker Price
												</th>
												<th className="text-right px-3 py-3">
													Taker Price
												</th>
												<th className="text-right px-3 py-3">
													Size
												</th>
												<th className="text-right px-3 py-3">
													Projected
												</th>
												<th className="text-center px-4 py-3">
													Conf.
												</th>
											</tr>
										</thead>
										<tbody>
											{unresolvedTrades.map((t, i) => (
												<tr
													key={t._id}
													className={
														i <
														unresolvedTrades.length -
															1
															? "border-b border-border/50"
															: ""
													}
												>
													<td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
														{timeAgo(t.timestamp)}
													</td>
													<td className="px-3 py-3 font-medium max-w-[200px] truncate">
														{t.pairName}
													</td>
													<td className="px-3 py-3">
														<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-blue-100 text-blue-700">
															{t.makerExchange.toUpperCase()}
														</span>
													</td>
													<td className="px-3 py-3">
														<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-amber-100 text-amber-700">
															{t.takerExchange.toUpperCase()}
														</span>
													</td>
													<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
														$
														{t.makerPrice.toFixed(
															4,
														)}
													</td>
													<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
														$
														{t.takerPrice.toFixed(
															4,
														)}
													</td>
													<td className="text-right px-3 py-3 tabular-nums font-medium">
														{t.viableSize.toFixed(
															1,
														)}
													</td>
													<td className="text-right px-3 py-3 tabular-nums">
														<PnlBadge
															value={t.netProfit}
														/>
													</td>
													<td className="text-center px-4 py-3">
														{(t.confidence ?? "HIGH") === "HIGH" ? (
															<span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-emerald-100 text-emerald-700" title="API healthy, sufficient time to expiry">
																HIGH
															</span>
														) : (
															<span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-amber-100 text-amber-700" title="API unhealthy or near expiry">
																LOW
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

						{/* Resolved trades */}
						{resolvedTrades.length > 0 && (
							<section>
								<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
									Resolved
									<span className="ml-2 text-muted-foreground font-normal normal-case">
										({resolvedTrades.length})
									</span>
								</h3>
								<div className="bg-white border border-border rounded-xl overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
												<th className="text-left px-4 py-3">
													Time
												</th>
												<th className="text-left px-3 py-3">
													Pair
												</th>
												<th className="text-left px-3 py-3">
													Maker
												</th>
												<th className="text-left px-3 py-3">
													Taker
												</th>
												<th className="text-right px-3 py-3">
													Size
												</th>
												<th className="text-right px-3 py-3">
													Projected
												</th>
												<th className="text-right px-3 py-3">
													Result
												</th>
												<th className="text-right px-4 py-3">
													Actual P&L
												</th>
											</tr>
										</thead>
										<tbody>
											{resolvedTrades.map((t, i) => (
												<tr
													key={t._id}
													className={
														i <
														resolvedTrades.length -
															1
															? "border-b border-border/50"
															: ""
													}
												>
													<td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
														{timeAgo(t.timestamp)}
													</td>
													<td className="px-3 py-3 font-medium max-w-[200px] truncate">
														{t.pairName}
													</td>
													<td className="px-3 py-3">
														<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-blue-100 text-blue-700">
															{t.makerExchange.toUpperCase()}
														</span>
													</td>
													<td className="px-3 py-3">
														<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-amber-100 text-amber-700">
															{t.takerExchange.toUpperCase()}
														</span>
													</td>
													<td className="text-right px-3 py-3 tabular-nums font-medium">
														{t.viableSize.toFixed(
															1,
														)}
													</td>
													<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
														{formatPnl(
															t.netProfit,
														)}
													</td>
													<td className="text-right px-3 py-3">
														{t.status ===
															"RESOLVED_WIN" && (
															<span className="text-emerald-600 font-bold">
																WIN
															</span>
														)}
														{t.status ===
															"RESOLVED_LOSS" && (
															<span className="text-red-500 font-bold">
																LOSS
															</span>
														)}
													</td>
													<td className="text-right px-4 py-3 tabular-nums">
														<PnlBadge
															value={
																t.actualPnl ?? 0
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
					</section>
				)}
			</main>
		</div>
	);
}
