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

const SOFT_ARB_TRADES_PATH = path.join(ARB_PIPELINE_DIR, "soft-arb-paper-trades.jsonl");
const SOFT_ARB_MTM_PATH = path.join(ARB_PIPELINE_DIR, "soft-arb-mtm.json");
const SOFT_ARB_OUTCOMES_PATH = path.join(ARB_PIPELINE_DIR, "outcome-tracking.jsonl");

interface PipelineRun {
	runId: string;
	dossier: Record<string, unknown> | null;
	verdict: Record<string, unknown> | null;
	decision: Record<string, unknown> | null;
	status: "completed" | "dossier_only" | "verdict_pending" | "abandoned" | "no_files";
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
	for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			rows.push(JSON.parse(trimmed));
		} catch {
			// skip malformed lines
		}
	}
	return rows;
}

function normalizeRun(run: PipelineRun): PipelineRun {
	if (!run.dossier) return run;
	// Only normalize Metaculus dossiers (sports pass through unchanged)
	const d = run.dossier as Record<string, unknown>;
	if (d.market_b || d.market_type) return run;

	const isMetaculus = !!(d.signal_source) || String(d.dossier_format_version ?? d.format_version ?? d.version ?? d._version ?? "").includes("metaculus") || run.runId.startsWith("scan-metaculus-");
	if (!isMetaculus) return run;

	const scriptPath = path.join(os.homedir(), ".openclaw/scripts/normalize_dossier.py");
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
		console.warn(`normalizeRun failed for ${run.runId}:`, err instanceof Error ? err.message : String(err));
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
			const m = f.match(/^(scan-(?:metaculus-)?\d{4}-\d{2}-\d{2}(?:-\d{4})?)\.(dossier|verdict|decision)\.json$/);
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
					if (req.method === "GET" && url === "/api/pipeline-runs") {
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
	pair: string;
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
	resolved_outcome: string | null;
	event_slug: string | null;
}

interface SoftArbOutcome {
	timestamp: string;
	opportunity_id: string;
	trade_id: string;
	pair: string;
	polymarket_slug: string;
	signal_source: string;
	direction: string;
	raw_edge_pct: number | null;
	adjusted_edge_pct: number | null;
	entry_price: number | null;
	polymarket_price: number | null;
	signal_prob_yes: number | null;
	signal_prob_no: number | null;
	actual_outcome: string;
	pnl_usd: number;
	edge_was_real: boolean;
	notes: string;
}

function getSoftArbTrades(): {
	trades: SoftArbTrade[];
	summary: Record<string, unknown>;
	outcomes: SoftArbOutcome[];
	outcomeSummary: Record<string, unknown>;
	lastUpdated: string | null;
} {
	const rawTrades = readJsonlSafe(SOFT_ARB_TRADES_PATH);
	const rawOutcomes = readJsonlSafe(SOFT_ARB_OUTCOMES_PATH);

	// Read MTM sidecar if it exists
	let mtm: { trades: Record<string, Record<string, unknown>>; summary: Record<string, unknown>; last_updated: string } | null = null;
	if (fs.existsSync(SOFT_ARB_MTM_PATH)) {
		try {
			mtm = JSON.parse(fs.readFileSync(SOFT_ARB_MTM_PATH, "utf-8"));
		} catch {
			// ignore malformed sidecar
		}
	}

	// Merge trades with MTM overlay
	const trades: SoftArbTrade[] = rawTrades.map((t) => {
		const tradeId = String(t.trade_id ?? "");
		const mtmData = mtm?.trades?.[tradeId];
		return {
			trade_id: tradeId,
			pair: String(t.pair ?? ""),
			direction: String(t.direction ?? ""),
			entry_price: Number(t.entry_price ?? 0),
			position_size_usd: Number(t.position_size_usd ?? 0),
			shares: Number(t.shares ?? 0),
			adjusted_edge_pct: Number(t.adjusted_edge_pct ?? 0),
			opened_at: String(t.opened_at ?? ""),
			resolves_by: String(t.resolves_by ?? ""),
			polymarket_slug: String(t.polymarket_slug ?? ""),
			metaculus_id: Number(t.metaculus_id ?? 0),
			status: String(mtmData?.status ?? t.status ?? "OPEN"),
			current_price: mtmData?.current_price != null ? Number(mtmData.current_price) : null,
			unrealized_pnl: mtmData?.unrealized_pnl != null ? Number(mtmData.unrealized_pnl) : null,
			realized_pnl: mtmData?.realized_pnl != null ? Number(mtmData.realized_pnl) : null,
			resolved_outcome: mtmData?.resolved_outcome != null ? String(mtmData.resolved_outcome) : null,
		event_slug: mtmData?.event_slug != null ? String(mtmData.event_slug) : null,
		};
	});

	const outcomes: SoftArbOutcome[] = rawOutcomes
		.map((row) => ({
			timestamp: String(row.timestamp ?? ""),
			opportunity_id: String(row.opportunity_id ?? ""),
			trade_id: String(row.trade_id ?? ""),
			pair: String(row.pair ?? ""),
			polymarket_slug: String(row.polymarket_slug ?? ""),
			signal_source: String(row.signal_source ?? ""),
			direction: String(row.direction ?? ""),
			raw_edge_pct: row.raw_edge_pct != null ? Number(row.raw_edge_pct) : null,
			adjusted_edge_pct: row.adjusted_edge_pct != null ? Number(row.adjusted_edge_pct) : null,
			entry_price: row.entry_price != null ? Number(row.entry_price) : null,
			polymarket_price: row.polymarket_price != null ? Number(row.polymarket_price) : null,
			signal_prob_yes: row.signal_prob_yes != null ? Number(row.signal_prob_yes) : null,
			signal_prob_no: row.signal_prob_no != null ? Number(row.signal_prob_no) : null,
			actual_outcome: String(row.actual_outcome ?? ""),
			pnl_usd: Number(row.pnl_usd ?? 0),
			edge_was_real: Boolean(row.edge_was_real),
			notes: String(row.notes ?? ""),
		}))
		.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

	// Summary: use MTM summary if available, else compute basic stats
	const summary = mtm?.summary ?? {
		total_trades: trades.length,
		open_trades: trades.length,
		resolved_trades: 0,
		total_invested: trades.reduce((s, t) => s + t.position_size_usd, 0),
		total_unrealized_pnl: null,
		total_realized_pnl: 0,
		wins: 0,
		losses: 0,
	};

	const outcomeSummary = outcomes.reduce(
		(acc, outcome) => {
			acc.resolvedTrades += 1;
			acc.totalPnl += outcome.pnl_usd;
			if (outcome.actual_outcome === "WIN") acc.wins += 1;
			if (outcome.actual_outcome === "LOSS") acc.losses += 1;
			if (outcome.adjusted_edge_pct != null) acc.totalAdjustedEdgePct += outcome.adjusted_edge_pct;
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
		trades,
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
					if (req.method === "GET" && url === "/api/soft-arb-trades") {
						try {
							const data = getSoftArbTrades();
							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify(data));
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
							if (
								(err as NodeJS.ErrnoException).code === "ENOENT"
							) {
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
					const completeMatch = url.match(
						/^\/api\/todos\/([^/]+)\/complete$/,
					);
					if (method === "POST" && completeMatch) {
						const blockId = completeMatch[1];
						try {
							const content = fs.readFileSync(
								TASKS_PATH,
								"utf-8",
							);
							const lines = content.split("\n");
							const idx = lines.findIndex((l) =>
								l.includes(`^${blockId}`),
							);
							if (idx === -1) {
								res.statusCode = 404;
								res.end("Block ID not found");
								return;
							}
							let line = lines[idx];
							line = line.replace("- [ ]", "- [x]");
							if (!line.includes("completed:")) {
								const today = new Date()
									.toISOString()
									.slice(0, 10);
								line = line.replace(
									/([ \t]*\^task-\S+)$/,
									` | completed:${today}$1`,
								);
							}
							lines[idx] = line;
							fs.writeFileSync(
								TASKS_PATH,
								lines.join("\n"),
								"utf-8",
							);
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
							const content = fs.readFileSync(
								TASKS_PATH,
								"utf-8",
							);
							const lines = content.split("\n");
							const idx = lines.findIndex((l) =>
								l.includes(`^${blockId}`),
							);
							if (idx === -1) {
								res.statusCode = 404;
								res.end("Block ID not found");
								return;
							}
							lines.splice(idx, 1);
							fs.writeFileSync(
								TASKS_PATH,
								lines.join("\n"),
								"utf-8",
							);
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
