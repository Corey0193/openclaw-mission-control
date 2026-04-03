import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";

interface Todo {
	blockId: string;
	checked: boolean;
	priority: "P1" | "P2" | "P3";
	description: string;
	due?: string;
	delegatedTo?: string;
	delegatedAt?: string;
	status?: string;
	section: "active" | "waiting" | "upcoming" | "someday" | "completed";
}

const TASKS_PATH = path.join(
	os.homedir(),
	"Documents/Second Brain/90-System/tasks.md",
);

const ARB_PIPELINE_DIR = path.join(
	os.homedir(),
	".openclaw/workspace-hustle/arb-pipeline",
);

const SOFT_ARB_TRADES_PATH = path.join(
        ARB_PIPELINE_DIR,
        "soft-arb-paper-trades.jsonl",
);
const SOFT_ARB_LIVE_TRADES_PATH = path.join(
        ARB_PIPELINE_DIR,
        "soft-arb-live-trades.jsonl",
);
const SOFT_ARB_LIVE_TRADES_LEGACY_PATH = path.join(
        os.homedir(),
        ".openclaw/workspace-hustle/live-trades.jsonl",
);

const SOFT_ARB_MTM_PATH = path.join(ARB_PIPELINE_DIR, "soft-arb-mtm.json");
const SOFT_ARB_OUTCOMES_PATH = path.join(
	ARB_PIPELINE_DIR,
	"outcome-tracking.jsonl",
);
const SOFT_ARB_CALIBRATION_PATH = path.join(
	ARB_PIPELINE_DIR,
	"soft-arb-calibration.json",
);
const SOFT_ARB_SHIELD_STATE_PATH = path.join(
	ARB_PIPELINE_DIR,
	"oracle-shield-state.json",
);

interface PipelineRun {
	runId: string;
	dossier: Record<string, unknown> | null;
	verdict: Record<string, unknown> | null;
	decision: Record<string, unknown> | null;
	status:
		| "completed"
		| "dossier_only"
		| "verdict_pending"
		| "abandoned"
		| "no_files";
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

function readJsonlSafe(filePath: string): Record<string, unknown>[] {
        if (!fs.existsSync(filePath)) return [];

        const rows: Record<string, unknown>[] = [];
        const content = fs.readFileSync(filePath, "utf-8");
        let buffer = "";

        for (const line of content.split("\n")) {
                buffer += line + "\n";
                try {
                        const parsed = JSON.parse(buffer);
                        rows.append?.(parsed as any) || rows.push(parsed);
                        buffer = "";
                } catch {
                        // Continue buffering
                }
        }

        if (buffer.trim()) {
                try {
                        const parsed = JSON.parse(buffer);
                        rows.append?.(parsed as any) || rows.push(parsed);
                } catch {
                        // Truly malformed
                }
        }

        return rows;
}

function hasValue(value: unknown): boolean {
	return value != null && !(typeof value === "string" && value.trim() === "");
}

function mergeLedgerRows(
	previous: Record<string, unknown>,
	next: Record<string, unknown>,
): Record<string, unknown> {
	const merged = { ...previous };
	for (const [key, value] of Object.entries(next)) {
		if (!hasValue(value)) continue;
		merged[key] = value;
	}
	return merged;
}

function firstNonEmptyString(...values: unknown[]): string {
	for (const value of values) {
		if (typeof value === "string") {
			const trimmed = value.trim();
			if (trimmed) return trimmed;
		}
	}
	return "";
}

function getDossierDisplayName(dossier: Record<string, unknown> | null): string {
	if (!dossier) return "";

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
		if (typeof candidate !== "string") continue;
		const normalized = candidate.trim();
		if (
			normalized &&
			normalized !== "—" &&
			normalized.toLowerCase() !== "unknown event"
		) {
			return normalized;
		}
	}

	return "";
}

function loadOpportunityDossiers(): Map<string, Record<string, unknown>> {
	const dossiers = new Map<string, Record<string, unknown>>();
	const dirs = [ARB_PIPELINE_DIR, path.join(ARB_PIPELINE_DIR, "archive")];
	for (const dir of dirs) {
		if (!fs.existsSync(dir)) continue;
		for (const file of fs.readdirSync(dir)) {
			if (!file.endsWith(".dossier.json")) continue;
			const dossier = readJsonSafe(path.join(dir, file));
			if (!dossier) continue;
			const opportunityId = firstNonEmptyString(
				dossier.opportunity_id,
				file.replace(/\.dossier\.json$/, ""),
			);
			if (!opportunityId) continue;
			dossiers.set(opportunityId, dossier);
		}
	}
	return dossiers;
}

function buildMergedLedgerRows(
	rows: Record<string, unknown>[],
	mode: "paper" | "live",
): Record<string, Record<string, unknown>> {
	const deduped = new Map<string, Record<string, unknown>>();
	for (const row of rows) {
		const tradeId = firstNonEmptyString(row.trade_id);
		const orderId = firstNonEmptyString(row.order_id, row.polymarket_order_id);
		const dedupeKey =
			mode === "live"
				? firstNonEmptyString(orderId, tradeId)
				: tradeId;
		if (!dedupeKey) continue;
		const current = deduped.get(dedupeKey);
		deduped.set(
			dedupeKey,
			current ? mergeLedgerRows(current, row) : { ...row },
		);
	}
	return deduped;
}

function normalizeRun(run: PipelineRun): PipelineRun {
	if (!run.dossier) return run;
	// Only normalize Metaculus dossiers (sports pass through unchanged)
	const d = run.dossier as Record<string, unknown>;
	if (d.market_b || d.market_type) return run;

	const isMetaculus =
		!!d.signal_source ||
		String(
			d.dossier_format_version ??
				d.format_version ??
				d.version ??
				d._version ??
				"",
		).includes("metaculus") ||
		run.runId.startsWith("scan-metaculus-");
	if (!isMetaculus) return run;

	const scriptPath = path.join(
		os.homedir(),
		".openclaw/scripts/normalize_dossier.py",
	);
	if (!fs.existsSync(scriptPath)) return run;

	try {
		const input = JSON.stringify(d);
		const output = execSync(`python3 "${scriptPath}"`, {
			input,
			encoding: "utf-8",
			timeout: 5000,
		});
		const normalized = JSON.parse(output);
		return { ...run, dossier: normalized };
	} catch (err) {
		console.warn(
			`normalizeRun failed for ${run.runId}:`,
			err instanceof Error ? err.message : String(err),
		);
		return run; // Fallback: return unnormalized
	}
}

function getPipelineRuns(): PipelineRun[] {
	if (!fs.existsSync(ARB_PIPELINE_DIR)) return [];

	const dirs = [ARB_PIPELINE_DIR];
	const archiveDir = path.join(ARB_PIPELINE_DIR, "archive");
	if (fs.existsSync(archiveDir)) dirs.push(archiveDir);

	const idSet = new Set<string>();
	const fileMap = new Map<string, string>();
	const archivedIds = new Set<string>();

	for (const dir of dirs) {
		const isArchive = dir === archiveDir;
		const files = fs.readdirSync(dir);
		for (const f of files) {
			const m = f.match(
				/^(scan-(?:[A-Za-z0-9_-]+-)?\d{4}-\d{2}-\d{2}(?:-(?:\d{4}|[A-Za-z][A-Za-z0-9_-]*))?)\.(dossier|verdict|decision)\.json$/,
			);
			if (m) {
				idSet.add(m[1]);
				fileMap.set(`${m[1]}.${m[2]}`, path.join(dir, f));
				if (isArchive) archivedIds.add(m[1]);
			}
		}
	}

	const runs: PipelineRun[] = [];
	for (const id of [...idSet].sort().reverse()) {
		const dossier = readJsonSafe(fileMap.get(`${id}.dossier`) ?? "");
		const verdict = readJsonSafe(fileMap.get(`${id}.verdict`) ?? "");
		const decision = readJsonSafe(fileMap.get(`${id}.decision`) ?? "");
		let status: PipelineRun["status"] = "no_files";
		if (dossier && verdict && decision) status = "completed";
		else if (dossier && verdict) status = "completed";
		else if (dossier && archivedIds.has(id)) status = "abandoned";
		else if (dossier) status = "dossier_only";
		runs.push(normalizeRun({ runId: id, dossier, verdict, decision, status }));
	}
	return runs;
}

function arbPipelinePlugin() {
	return {
		name: "arb-pipeline",
		configureServer(server: import("vite").ViteDevServer) {
			server.middlewares.use(
				(
					req: import("http").IncomingMessage,
					res: import("http").ServerResponse,
					next: () => void,
				) => {
					const url = (req.url ?? "/").split("?")[0];
					if (
						req.method === "GET" &&
						(url === "/api/pipeline-runs" ||
							url === "/api/soft-arb/pipeline-runs")
					) {
						try {
							const runs = getPipelineRuns();
							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify({ runs }));
						} catch {
							res.statusCode = 500;
							res.end("Internal server error");
						}
						return;
					}
					next();
				},
			);
		},
	};
}

interface SoftArbTrade {
	trade_id: string;
	rowKey: string;
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
	order_id: string | null;
	order_status: string | null;
	mark_source: "mtm" | "gamma_fallback" | "unavailable";
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

interface SoftArbShieldState {
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
	polymarket_slug: string;
	signal_family: string;
	signal_source: string;
	direction: string;
	sample_key: string;
	raw_edge_pct: number | null;
	adjusted_edge_pct: number | null;
	entry_price: number | null;
	market_prob_side_at_entry: number | null;
	polymarket_price: number | null;
	signal_prob_yes: number | null;
	signal_prob_no: number | null;
	signal_prob_side: number | null;
	resolves_by: string;
	position_size_usd: number | null;
	shares: number | null;
	actual_outcome: string;
	pnl_usd: number;
	edge_was_real: boolean;
	is_real: boolean;
	notes: string;
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
	thresholds: Array<{
		threshold_pct: number;
		eligible_unique_samples: number;
		wins: number;
		losses: number;
		win_rate_pct: number;
		total_pnl_usd: number;
		avg_market_prob_side_pct: number;
		avg_signal_prob_side_pct: number;
		avg_adjusted_edge_pct: number;
		market_outperformance_pp: number;
	}>;
	recommendation_reason: string;
}

interface SoftArbCalibration {
	generated_at: string;
	sample_policy: Record<string, unknown>;
	families: Record<string, SoftArbCalibrationFamily>;
}

interface SoftArbDiscoverySummary {
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

type LatestSoftArbDossierCache = {
	fingerprint: string;
	dossier: Record<string, unknown> | null;
};

let latestSoftArbDossierCache: LatestSoftArbDossierCache | null = null;
let latestMetaculusDossierCache: LatestSoftArbDossierCache | null = null;
const SOFT_ARB_GAMMA_CACHE_TTL_MS = 30_000;
const softArbGammaCache = new Map<
	string,
	{
		currentYesPrice: number;
		currentNoPrice: number;
		eventSlug: string | null;
		fetchedAt: number;
	}
>();

function normalizeSoftArbPct(value: unknown): number {
	const n = Number(value ?? 0);
	if (!Number.isFinite(n)) return 0;
	return Math.abs(n) <= 1 ? n * 100 : n;
}

function getSignalFamily(row: Record<string, unknown>): string {
	const explicit = String(row.signal_family ?? "").toLowerCase();
	if (explicit === "metaculus" || explicit === "sportsbook") return explicit;
	if (
		String(row.signal_source ?? "")
			.toLowerCase()
			.includes("metaculus")
	)
		return "metaculus";
	if (row.metaculus_id != null && Number(row.metaculus_id) > 0)
		return "metaculus";
	return "sportsbook";
}

function getSignalSource(row: Record<string, unknown>): string {
	const explicit = String(row.signal_source ?? "").trim();
	if (explicit) return explicit;
	if (String(row.signal_family ?? "").toLowerCase() === "metaculus")
		return "Metaculus";
	if (String(row.azuro_condition_id ?? "").trim()) return "Azuro";
	if (row.metaculus_id != null && Number(row.metaculus_id) > 0)
		return "Metaculus";
	return "Sportsbook";
}

function toFiniteNumber(value: unknown): number {
	const n = Number(value ?? 0);
	return Number.isFinite(n) ? n : 0;
}

function roundTo(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

function resolveSoftArbCurrentPrice(
	direction: string,
	currentYesPrice: number,
	currentNoPrice: number,
): number | null {
	const normalized = String(direction ?? "").toUpperCase();
	if (normalized === "BUY_POLYMARKET_NO" || normalized === "BUY_NO") {
		return currentNoPrice;
	}
	if (normalized === "BUY_POLYMARKET_YES" || normalized === "BUY_YES") {
		return currentYesPrice;
	}
	return null;
}

async function fetchSoftArbGammaQuote(slug: string): Promise<{
	currentYesPrice: number;
	currentNoPrice: number;
	eventSlug: string | null;
} | null> {
	if (!slug.trim()) return null;

	const cached = softArbGammaCache.get(slug);
	if (cached && Date.now() - cached.fetchedAt < SOFT_ARB_GAMMA_CACHE_TTL_MS) {
		return cached;
	}

	try {
		const resp = await fetch(
			`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`,
			{
				headers: {
					Accept: "application/json",
				},
			},
		);
		if (!resp.ok) return null;

		const payload = (await resp.json()) as Array<Record<string, unknown>>;
		const market = Array.isArray(payload) ? payload[0] : null;
		if (!market) return null;

		const rawPrices = market.outcomePrices;
		const prices =
			typeof rawPrices === "string" ? JSON.parse(rawPrices) : rawPrices;
		if (!Array.isArray(prices) || prices.length < 2) return null;

		const currentYesPrice = Number(prices[0]);
		const currentNoPrice = Number(prices[1]);
		if (
			!Number.isFinite(currentYesPrice) ||
			!Number.isFinite(currentNoPrice)
		) {
			return null;
		}

		const events = Array.isArray(market.events)
			? (market.events as Array<Record<string, unknown>>)
			: [];
		const quote = {
			currentYesPrice,
			currentNoPrice,
			eventSlug:
				events[0]?.slug != null ? String(events[0].slug) : null,
			fetchedAt: Date.now(),
		};
		softArbGammaCache.set(slug, quote);
		return quote;
	} catch {
		return null;
	}
}

async function enrichSoftArbTradesWithFallbackMarks(
	trades: SoftArbTrade[],
): Promise<SoftArbTrade[]> {
	const slugsToFetch = Array.from(
		new Set(
			trades
				.filter(
					(trade) =>
						trade.status === "OPEN" &&
						trade.polymarket_slug &&
						(trade.current_price == null || trade.unrealized_pnl == null),
				)
				.map((trade) => trade.polymarket_slug),
		),
	);

	if (slugsToFetch.length === 0) return trades;

	const quoteEntries = await Promise.all(
		slugsToFetch.map(async (slug) => [slug, await fetchSoftArbGammaQuote(slug)] as const),
	);
	const quoteMap = new Map(quoteEntries);

	return trades.map((trade) => {
		if (
			trade.status !== "OPEN" ||
			!trade.polymarket_slug ||
			(trade.current_price != null && trade.unrealized_pnl != null)
		) {
			return trade;
		}

		const quote = quoteMap.get(trade.polymarket_slug);
		if (!quote) {
			return {
				...trade,
				mark_source: trade.current_price != null ? trade.mark_source : "unavailable",
			};
		}

		const currentPrice = resolveSoftArbCurrentPrice(
			trade.direction,
			quote.currentYesPrice,
			quote.currentNoPrice,
		);
		if (currentPrice == null) {
			return trade;
		}

		return {
			...trade,
			current_price: roundTo(currentPrice, 4),
			unrealized_pnl: roundTo((currentPrice - trade.entry_price) * trade.shares, 2),
			event_slug: trade.event_slug ?? quote.eventSlug,
			mark_source: "gamma_fallback",
		};
	});
}

function resolveLatestDossier(
	pattern: RegExp,
	cache: LatestSoftArbDossierCache | null,
): LatestSoftArbDossierCache {
	const dirs = [ARB_PIPELINE_DIR, path.join(ARB_PIPELINE_DIR, "archive")];
	const fingerprintParts = dirs.map((dir) => {
		if (!fs.existsSync(dir)) return `${dir}:missing`;
		const stat = fs.statSync(dir);
		const count = fs
			.readdirSync(dir)
			.filter((name) => pattern.test(name)).length;
		return `${dir}:${stat.mtimeMs}:${count}`;
	});
	const fingerprint = fingerprintParts.join("|");
	if (cache?.fingerprint === fingerprint) {
		return cache;
	}

	const dossierPaths: string[] = [];
	for (const dir of dirs) {
		if (!fs.existsSync(dir)) continue;
		for (const name of fs.readdirSync(dir)) {
			if (pattern.test(name)) {
				dossierPaths.push(path.join(dir, name));
			}
		}
	}
	if (dossierPaths.length === 0) {
		return {
			fingerprint,
			dossier: null,
		};
	}

	let latest: {
		timestamp: number;
		dossier: Record<string, unknown> | null;
	} | null = null;
	for (const dossierPath of dossierPaths) {
		const dossier = readJsonSafe(dossierPath);
		if (!dossier) continue;
		const scanTimestamp = Date.parse(String(dossier.scan_timestamp ?? ""));
		const statTime = fs.statSync(dossierPath).mtimeMs;
		const ts = Number.isFinite(scanTimestamp) ? scanTimestamp : statTime;
		if (!latest || ts > latest.timestamp) latest = { timestamp: ts, dossier };
	}

	return {
		fingerprint,
		dossier: latest?.dossier ?? null,
	};
}

function getLatestSoftArbDossier(): Record<string, unknown> | null {
	latestSoftArbDossierCache = resolveLatestDossier(
		/^scan-.*\.dossier\.json$/,
		latestSoftArbDossierCache,
	);
	return latestSoftArbDossierCache.dossier;
}

function getLatestMetaculusDossier(): Record<string, unknown> | null {
	latestMetaculusDossierCache = resolveLatestDossier(
		/^scan-metaculus-.*\.dossier\.json$/,
		latestMetaculusDossierCache,
	);
	return latestMetaculusDossierCache.dossier;
}

function getSoftArbDiscoverySummary(): SoftArbDiscoverySummary {
	const latestDossier = getLatestSoftArbDossier();
	const discoveryDossier = getLatestMetaculusDossier();
	if (!latestDossier && !discoveryDossier) {
		return {
			latestRunId: null,
			latestScanTimestamp: null,
			latestMetricsRunId: null,
			latestMetricsScanTimestamp: null,
			knownPairsChecked: 0,
			reverseSeedsConsidered: 0,
			reverseSeedsRejectedBeforeSearch: 0,
			reverseSeedsScanned: 0,
			reverseMetaculusCandidatesConsidered: 0,
			reverseVerifiedMatches: 0,
			reverseSeedsSuppressedByFeedback: 0,
			forwardQuestionsScanned: 0,
			autoPromotedPairs: [],
			skippedByReason: {},
			discoveryMethodCounts: {
				known_pair: 0,
				reverse_seed: 0,
				keyword_search: 0,
			},
			topRejectionReasons: {},
			topFeedbackSuppressionReasons: {},
			rejectedReverseSeeds: [],
		};
	}

	const summary = ((discoveryDossier ?? {}).discovery_summary ?? {}) as Record<
		string,
		unknown
	>;
	const matchedPairs = Array.isArray(discoveryDossier?.matched_pairs)
		? (discoveryDossier.matched_pairs as Array<Record<string, unknown>>)
		: [];

	const discoveryMethodCounts = {
		known_pair: 0,
		reverse_seed: 0,
		keyword_search: 0,
	};
	for (const pair of matchedPairs) {
		const method = String(
			pair.discovery_method ??
				(pair.match_quality as Record<string, unknown> | undefined)?.method ??
				"",
		).toLowerCase();
		if (
			method === "known_pair" ||
			method === "reverse_seed" ||
			method === "keyword_search"
		) {
			discoveryMethodCounts[method] += 1;
		}
	}
	if (Object.values(discoveryMethodCounts).every((count) => count === 0)) {
		const topLevelMethod = String(
			(discoveryDossier?.match_quality as Record<string, unknown> | undefined)
				?.method ?? "",
		).toLowerCase();
		if (
			topLevelMethod === "known_pair" ||
			topLevelMethod === "reverse_seed" ||
			topLevelMethod === "keyword_search"
		) {
			discoveryMethodCounts[topLevelMethod] =
				matchedPairs.length > 0 ? matchedPairs.length : 1;
		}
	}

	const skippedByReason: Record<string, number> = {};
	const skippedRaw = summary.skipped_by_reason;
	if (skippedRaw && typeof skippedRaw === "object") {
		for (const [key, value] of Object.entries(
			skippedRaw as Record<string, unknown>,
		)) {
			skippedByReason[key] = toFiniteNumber(value);
		}
	}

	const topRejectionReasons: Record<string, number> = {};
	const topRejectionRaw = summary.top_rejection_reasons;
	if (topRejectionRaw && typeof topRejectionRaw === "object") {
		for (const [key, value] of Object.entries(
			topRejectionRaw as Record<string, unknown>,
		)) {
			topRejectionReasons[key] = toFiniteNumber(value);
		}
	}

	const topFeedbackSuppressionReasons: Record<string, number> = {};
	const topFeedbackRaw = summary.top_feedback_suppression_reasons;
	if (topFeedbackRaw && typeof topFeedbackRaw === "object") {
		for (const [key, value] of Object.entries(
			topFeedbackRaw as Record<string, unknown>,
		)) {
			topFeedbackSuppressionReasons[key] = toFiniteNumber(value);
		}
	}

	const autoPromotedPairs = Array.isArray(summary.auto_promoted_pairs)
		? (summary.auto_promoted_pairs as unknown[]).map((value) => String(value))
		: [];

	const rejectedSeedRows = Array.isArray(summary.rejected_reverse_seeds)
		? (summary.rejected_reverse_seeds as Array<Record<string, unknown>>)
		: Array.isArray(summary.top_rejected_seeds)
			? (summary.top_rejected_seeds as Array<Record<string, unknown>>)
			: [];

	const rejectedReverseSeeds = rejectedSeedRows.map((row) => ({
		slug: String(row.slug ?? ""),
		seedScore: toFiniteNumber(row.seed_score),
		reason: String(row.reason ?? ""),
	}));

	return {
		latestRunId:
			latestDossier?.opportunity_id != null
				? String(latestDossier.opportunity_id)
				: null,
		latestScanTimestamp:
			latestDossier?.scan_timestamp != null
				? String(latestDossier.scan_timestamp)
				: null,
		latestMetricsRunId:
			discoveryDossier?.opportunity_id != null
				? String(discoveryDossier.opportunity_id)
				: null,
		latestMetricsScanTimestamp:
			discoveryDossier?.scan_timestamp != null
				? String(discoveryDossier.scan_timestamp)
				: null,
		knownPairsChecked: toFiniteNumber(summary.known_pairs_checked),
		reverseSeedsConsidered: toFiniteNumber(summary.reverse_seeds_considered),
		reverseSeedsRejectedBeforeSearch: toFiniteNumber(
			summary.reverse_seeds_rejected_before_search,
		),
		reverseSeedsScanned: toFiniteNumber(summary.reverse_seeds_scanned),
		reverseMetaculusCandidatesConsidered: toFiniteNumber(
			summary.reverse_metaculus_candidates_considered,
		),
		reverseVerifiedMatches: toFiniteNumber(summary.reverse_verified_matches),
		reverseSeedsSuppressedByFeedback: toFiniteNumber(
			summary.reverse_seeds_suppressed_by_feedback,
		),
		forwardQuestionsScanned: toFiniteNumber(summary.forward_questions_scanned),
		autoPromotedPairs,
		skippedByReason,
		discoveryMethodCounts,
		topRejectionReasons,
		topFeedbackSuppressionReasons,
		rejectedReverseSeeds,
	};
}

async function getSoftArbTrades(): Promise<{
	trades: SoftArbTrade[];
	summary: Record<string, unknown>;
	outcomes: SoftArbOutcome[];
	outcomeSummary: Record<string, unknown>;
	calibration: SoftArbCalibration | null;
	shield: SoftArbShieldState | null;
	discovery: SoftArbDiscoverySummary;
	lastUpdated: string | null;
}> {
	const paperRaw = readJsonlSafe(SOFT_ARB_TRADES_PATH);
	const liveRaw = [
		...readJsonlSafe(SOFT_ARB_LIVE_TRADES_PATH),
		...readJsonlSafe(SOFT_ARB_LIVE_TRADES_LEGACY_PATH),
	];
	const dossierByOpportunity = loadOpportunityDossiers();
	const paperTrades = buildMergedLedgerRows(paperRaw, "paper");
	const liveTrades = buildMergedLedgerRows(liveRaw, "live");
	const rawTrades = [
		...paperTrades.values(),
		...liveTrades.values(),
	];
	const rawOutcomes = readJsonlSafe(SOFT_ARB_OUTCOMES_PATH);

	const calibration = readJsonSafe(
		SOFT_ARB_CALIBRATION_PATH,
	) as SoftArbCalibration | null;
	const shieldRaw = readJsonSafe(SOFT_ARB_SHIELD_STATE_PATH);
	const shieldTradeState = (shieldRaw?.trade_status ?? {}) as Record<
		string,
		Record<string, unknown>
	>;
	const shieldAlertsRaw = Array.isArray(shieldRaw?.open_trade_alerts)
		? (shieldRaw?.open_trade_alerts as Array<Record<string, unknown>>)
		: [];
	const shield: SoftArbShieldState | null = shieldRaw
		? {
				generated_at:
					shieldRaw.generated_at != null
						? String(shieldRaw.generated_at)
						: null,
				coverage_scope:
					shieldRaw.coverage_scope != null
						? String(shieldRaw.coverage_scope)
						: null,
				watcher_status: String(shieldRaw.watcher_status ?? "down"),
				ws_connected: Boolean(shieldRaw.ws_connected),
				last_message_at:
					shieldRaw.last_message_at != null
						? String(shieldRaw.last_message_at)
						: null,
				tracked_coins: Array.isArray(shieldRaw.tracked_coins)
					? (shieldRaw.tracked_coins as unknown[]).map((value) => String(value))
					: [],
				mapped_open_trade_count: Number(shieldRaw.mapped_open_trade_count ?? 0),
				unmapped_open_trade_count: Number(
					shieldRaw.unmapped_open_trade_count ?? 0,
				),
				open_trade_alerts: shieldAlertsRaw.map((row) => ({
					trade_id: String(row.trade_id ?? ""),
					polymarket_slug: String(row.polymarket_slug ?? ""),
					pair: String(row.pair ?? ""),
					opened_at: String(row.opened_at ?? ""),
					shield_coin: row.shield_coin != null ? String(row.shield_coin) : null,
					shield_state:
						row.shield_state != null ? String(row.shield_state) : null,
					shield_reason:
						row.shield_reason != null ? String(row.shield_reason) : null,
					shield_updated_at:
						row.shield_updated_at != null
							? String(row.shield_updated_at)
							: null,
				})),
			}
		: null;

	// Read MTM sidecar if it exists
	let mtm: {
		trades: Record<string, Record<string, unknown>>;
		summary: Record<string, unknown>;
		last_updated: string;
	} | null = null;
	if (fs.existsSync(SOFT_ARB_MTM_PATH)) {
		try {
			mtm = JSON.parse(fs.readFileSync(SOFT_ARB_MTM_PATH, "utf-8"));
		} catch {
			// ignore malformed sidecar
		}
	}

	// Merge trades with MTM overlay
	const trades: SoftArbTrade[] = rawTrades.map((t) => {
		const rawTradeId = firstNonEmptyString(t.trade_id);
		const orderId = firstNonEmptyString(t.order_id, t.polymarket_order_id);
		const opportunityId = firstNonEmptyString(t.opportunity_id);
		const isReal = !!t.real_trade || rawTradeId.startsWith("live-");
		const tradeId =
			isReal && orderId ? `${rawTradeId}:${orderId}` : rawTradeId;
		const rowKey = `${isReal ? "live" : "paper"}-${rawTradeId}-${opportunityId}`;
		const mtmData = mtm?.trades?.[rowKey] ?? mtm?.trades?.[rawTradeId];
		const shieldData = shieldTradeState[rowKey] ?? shieldTradeState[rawTradeId];
		const dossier = dossierByOpportunity.get(opportunityId) ?? null;
		const dossierDecision =
			dossier && typeof dossier.decision === "object" && dossier.decision
				? (dossier.decision as Record<string, unknown>)
				: null;
		const fallbackPair =
			getDossierDisplayName(dossier) ||
			firstNonEmptyString(dossier?.event_name, dossier?.pair, opportunityId);
		return {
			trade_id: tradeId,
			rowKey,
			pair: firstNonEmptyString(
				t.pair,
				t.event_name,
				t.market_question,
				t.polymarket_question,
				t.target_outcome,
				t.polymarket_slug,
				fallbackPair,
			),
			signal_family: String(mtmData?.signal_family ?? getSignalFamily(t)),
			signal_source: getSignalSource(t),
			direction: String(t.direction ?? ""),
			entry_price: Number(t.entry_price ?? 0),
			position_size_usd: Number(t.position_size_usd ?? t.stake_usd ?? 0),
			shares: Number(t.shares ?? t.shares_est ?? 0),
			adjusted_edge_pct: normalizeSoftArbPct(t.adjusted_edge_pct ?? t.edge_pct),
			opened_at: firstNonEmptyString(
				t.opened_at,
				t.timestamp,
				t.executed_at,
				t.resolves_by,
				dossierDecision?.decided_at,
				dossier?.scan_timestamp,
			),
			resolves_by: firstNonEmptyString(
				t.resolves_by,
				dossier?.event_date_utc,
				dossier?.scan_timestamp,
			),
			polymarket_slug: String(t.polymarket_slug ?? ""),
			metaculus_id: Number(t.metaculus_id ?? 0),
			status: String(mtmData?.status ?? t.status ?? "OPEN"),
			current_price:
				mtmData?.current_price != null ? Number(mtmData.current_price) : null,
			unrealized_pnl:
				mtmData?.unrealized_pnl != null ? Number(mtmData.unrealized_pnl) : null,
			realized_pnl:
				mtmData?.realized_pnl != null ? Number(mtmData.realized_pnl) : null,
			shadow_pnl:
				mtmData?.shadow_pnl != null ? Number(mtmData.shadow_pnl) : null,
			ready_to_close: Boolean(mtmData?.ready_to_close),
			fair_value:
				mtmData?.fair_value != null ? Number(mtmData.fair_value) : null,
			exit_price:
				mtmData?.exit_price != null ? Number(mtmData.exit_price) : null,
			resolved_outcome:
				mtmData?.resolved_outcome != null
					? String(mtmData.resolved_outcome)
					: null,
			event_slug:
				mtmData?.event_slug != null ? String(mtmData.event_slug) : null,
			is_real: isReal,
			order_id: orderId || null,
			order_status:
				t.order_status != null
					? String(t.order_status)
					: t.status != null
						? String(t.status)
						: null,
			mark_source: mtmData ? "mtm" : "unavailable",
			shield_coin:
				shieldData?.shield_coin != null ? String(shieldData.shield_coin) : null,
			shield_state:
				shieldData?.shield_state != null
					? String(shieldData.shield_state)
					: null,
			shield_reason:
				shieldData?.shield_reason != null
					? String(shieldData.shield_reason)
					: null,
			shield_updated_at:
				shieldData?.shield_updated_at != null
					? String(shieldData.shield_updated_at)
					: null,
		};
	});

	const enrichedTrades = await enrichSoftArbTradesWithFallbackMarks(trades);

	const outcomes: SoftArbOutcome[] = rawOutcomes
		.map((row) => ({
			timestamp: String(row.timestamp ?? ""),
			opportunity_id: String(row.opportunity_id ?? ""),
			trade_id: String(row.trade_id ?? ""),
			pair: String(row.pair ?? ""),
			polymarket_slug: String(row.polymarket_slug ?? ""),
			signal_family: getSignalFamily(row),
			signal_source: String(row.signal_source ?? ""),
			direction: String(row.direction ?? ""),
			sample_key: String(row.sample_key ?? ""),
			raw_edge_pct:
				row.raw_edge_pct != null ? normalizeSoftArbPct(row.raw_edge_pct) : null,
			adjusted_edge_pct:
				row.adjusted_edge_pct != null
					? normalizeSoftArbPct(row.adjusted_edge_pct)
					: null,
			entry_price: row.entry_price != null ? Number(row.entry_price) : null,
			market_prob_side_at_entry:
				row.market_prob_side_at_entry != null
					? Number(row.market_prob_side_at_entry)
					: null,
			polymarket_price:
				row.polymarket_price != null ? Number(row.polymarket_price) : null,
			signal_prob_yes:
				row.signal_prob_yes != null ? Number(row.signal_prob_yes) : null,
			signal_prob_no:
				row.signal_prob_no != null ? Number(row.signal_prob_no) : null,
			signal_prob_side:
				row.signal_prob_side != null ? Number(row.signal_prob_side) : null,
			resolves_by: String(row.resolves_by ?? ""),
			position_size_usd:
				row.position_size_usd != null ? Number(row.position_size_usd) : null,
			shares: row.shares != null ? Number(row.shares) : null,
			actual_outcome: String(row.actual_outcome ?? ""),
			pnl_usd: Number(row.pnl_usd ?? 0),
			edge_was_real: Boolean(row.edge_was_real),
			is_real: !!row.real_trade,
			notes: String(row.notes ?? ""),
		}))
		.sort(
			(a, b) =>
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		);

	// Summary: use MTM summary if available, else compute basic stats
	const summary = {
		...(mtm?.summary ?? {}),
		total_trades: enrichedTrades.length,
		open_trades: enrichedTrades.filter((t) => t.status === "OPEN").length,
		resolved_trades: enrichedTrades.filter((t) => t.status.startsWith("RESOLVED") || t.status.startsWith("CLOSED")).length,
		total_invested: Math.round(enrichedTrades.reduce((s, t) => s + t.position_size_usd, 0) * 100) / 100,
		total_unrealized_pnl:
			Math.round(
				enrichedTrades.reduce((s, t) => s + (t.unrealized_pnl ?? 0), 0) * 100,
			) / 100,
		total_realized_pnl:
			Math.round(
				enrichedTrades.reduce((s, t) => s + (t.realized_pnl ?? 0), 0) * 100,
			) / 100,
	};

	const outcomeSummary = outcomes.reduce(
		(acc, outcome) => {
			acc.resolvedTrades += 1;
			acc.totalPnl += outcome.pnl_usd;
			if (outcome.actual_outcome === "WIN") acc.wins += 1;
			if (outcome.actual_outcome === "LOSS") acc.losses += 1;
			if (outcome.adjusted_edge_pct != null)
				acc.totalAdjustedEdgePct += outcome.adjusted_edge_pct;
			return acc;
		},
		{
			resolvedTrades: 0,
			wins: 0,
			losses: 0,
			totalPnl: 0,
			totalAdjustedEdgePct: 0,
		},
	);

	const avgAdjustedEdgePct =
		outcomeSummary.resolvedTrades > 0
			? outcomeSummary.totalAdjustedEdgePct / outcomeSummary.resolvedTrades
			: 0;

	return {
		trades: enrichedTrades,
		summary,
		outcomes,
		outcomeSummary: {
			resolvedTrades: outcomeSummary.resolvedTrades,
			wins: outcomeSummary.wins,
			losses: outcomeSummary.losses,
			winRatePct:
				outcomeSummary.resolvedTrades > 0
					? (outcomeSummary.wins / outcomeSummary.resolvedTrades) * 100
					: 0,
			totalPnl: Math.round(outcomeSummary.totalPnl * 100) / 100,
			avgAdjustedEdgePct: Math.round(avgAdjustedEdgePct * 100) / 100,
		},
		calibration,
		shield,
		discovery: getSoftArbDiscoverySummary(),
		lastUpdated: mtm?.last_updated ?? null,
	};
}

function softArbTradesPlugin() {
	return {
		name: "soft-arb-trades",
		configureServer(server: import("vite").ViteDevServer) {
			server.middlewares.use(
				(
					req: import("http").IncomingMessage,
					res: import("http").ServerResponse,
					next: () => void,
				) => {
					const url = (req.url ?? "/").split("?")[0];
					if (
						req.method === "GET" &&
						(url === "/api/soft-arb-trades" || url === "/api/soft-arb/trades")
					) {
						void (async () => {
							try {
								const data = await getSoftArbTrades();
							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify(data));
							} catch {
								res.statusCode = 500;
								res.end("Internal server error");
							}
						})();
						return;
					}
					next();
				},
			);
		},
	};
}

function parseTodos(content: string): Todo[] {
	const lines = content.split("\n");
	let section: Todo["section"] = "active";
	const todos: Todo[] = [];

	for (const line of lines) {
		if (/^## Active/i.test(line)) {
			section = "active";
			continue;
		}
		if (/^## Waiting/i.test(line)) {
			section = "waiting";
			continue;
		}
		if (/^## Upcoming/i.test(line)) {
			section = "upcoming";
			continue;
		}
		if (/^## Someday/i.test(line)) {
			section = "someday";
			continue;
		}
		if (/^## Completed/i.test(line)) {
			section = "completed";
			continue;
		}

		const todoMatch = line.match(/^- \[([ x])\]/);
		if (!todoMatch) continue;

		const blockIdMatch = line.match(/\^(task-\S+)/);
		if (!blockIdMatch) continue;

		const blockId = blockIdMatch[1];
		const checked = todoMatch[1] === "x";

		const lineContent = line.replace(/^- \[[ x]\]\s*/, "");
		const fields = lineContent.split(/\s*\|\s*/);

		const priorityMatch = fields[0].match(/\b(P[123])\b/);
		const priority = (priorityMatch?.[1] ?? "P3") as "P1" | "P2" | "P3";

		let description: string;
		if (fields.length > 1 && fields[1] && !/^\^task-/.test(fields[1].trim())) {
			description = fields[1].trim();
		} else {
			description = fields[0].replace(/\b(P[123])\b\s*/, "").trim();
		}
		description = description.replace(/\s*\^task-\S+/, "").trim();

		const dueMatch = line.match(/\bdue:(\S+)/);
		const delegatedMatch = line.match(/@(\w+)\s+delegated:(\S+)/);
		const statusMatch = line.match(/\bstatus:(\w+)/);

		todos.push({
			blockId,
			checked,
			priority,
			description,
			...(dueMatch?.[1] && { due: dueMatch[1] }),
			...(delegatedMatch?.[1] && { delegatedTo: delegatedMatch[1] }),
			...(delegatedMatch?.[2] && { delegatedAt: delegatedMatch[2] }),
			...(statusMatch?.[1] && { status: statusMatch[1] }),
			section,
		});
	}

	return todos;
}

function einsteinTodosPlugin() {
	return {
		name: "einstein-todos",
		configureServer(server: import("vite").ViteDevServer) {
			server.middlewares.use(
				(
					req: import("http").IncomingMessage,
					res: import("http").ServerResponse,
					next: () => void,
				) => {
					const url = (req.url ?? "/").split("?")[0];
					const method = req.method ?? "GET";

					// GET /api/todos
					if (method === "GET" && url === "/api/todos") {
						try {
							const content = fs.readFileSync(TASKS_PATH, "utf-8");
							const todos = parseTodos(content);
							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify({ todos }));
						} catch (err: unknown) {
							if ((err as NodeJS.ErrnoException).code === "ENOENT") {
								res.setHeader("Content-Type", "application/json");
								res.end(
									JSON.stringify({
										todos: [],
										error: "tasks.md not found",
									}),
								);
							} else {
								res.statusCode = 500;
								res.end("Internal server error");
							}
						}
						return;
					}

					// POST /api/todos/:blockId/complete
					const completeMatch = url.match(/^\/api\/todos\/([^/]+)\/complete$/);
					if (method === "POST" && completeMatch) {
						const blockId = completeMatch[1];
						try {
							const content = fs.readFileSync(TASKS_PATH, "utf-8");
							const lines = content.split("\n");
							const idx = lines.findIndex((l) => l.includes(`^${blockId}`));
							if (idx === -1) {
								res.statusCode = 404;
								res.end("Block ID not found");
								return;
							}
							let line = lines[idx];
							line = line.replace("- [ ]", "- [x]");
							if (!line.includes("completed:")) {
								const today = new Date().toISOString().slice(0, 10);
								line = line.replace(
									/([ \t]*\^task-\S+)$/,
									` | completed:${today}$1`,
								);
							}
							lines[idx] = line;
							fs.writeFileSync(TASKS_PATH, lines.join("\n"), "utf-8");
							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify({ ok: true }));
						} catch {
							res.statusCode = 500;
							res.end("Write error");
						}
						return;
					}

					// DELETE /api/todos/:blockId
					const deleteMatch = url.match(/^\/api\/todos\/([^/]+)$/);
					if (method === "DELETE" && deleteMatch) {
						const blockId = deleteMatch[1];
						try {
							const content = fs.readFileSync(TASKS_PATH, "utf-8");
							const lines = content.split("\n");
							const idx = lines.findIndex((l) => l.includes(`^${blockId}`));
							if (idx === -1) {
								res.statusCode = 404;
								res.end("Block ID not found");
								return;
							}
							lines.splice(idx, 1);
							fs.writeFileSync(TASKS_PATH, lines.join("\n"), "utf-8");
							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify({ ok: true }));
						} catch {
							res.statusCode = 500;
							res.end("Write error");
						}
						return;
					}

					next();
				},
			);
		},
	};
}

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		einsteinTodosPlugin(),
		arbPipelinePlugin(),
		softArbTradesPlugin(),
		{
			name: "local-file-server",
			configureServer(server) {
				server.middlewares.use("/api/local-file", (req, res) => {
					const url = new URL(req.url || "", "http://localhost");
					const filePath = url.searchParams.get("path");
					if (!filePath || !filePath.startsWith("/")) {
						res.statusCode = 400;
						res.end("Missing or invalid path");
						return;
					}
					const ext = path.extname(filePath).toLowerCase();
					const mimeTypes: Record<string, string> = {
						".png": "image/png",
						".jpg": "image/jpeg",
						".jpeg": "image/jpeg",
						".gif": "image/gif",
						".svg": "image/svg+xml",
						".webp": "image/webp",
						".pdf": "application/pdf",
					};
					const contentType = mimeTypes[ext] || "application/octet-stream";
					try {
						const data = fs.readFileSync(filePath);
						res.setHeader("Content-Type", contentType);
						res.setHeader("Cache-Control", "public, max-age=3600");
						res.end(data);
					} catch {
						res.statusCode = 404;
						res.end("File not found");
					}
				});
			},
		},
	],
	server: {
		proxy: {
			"/hooks": {
				target: "http://127.0.0.1:18789",
				changeOrigin: true,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
