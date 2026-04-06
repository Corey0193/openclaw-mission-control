import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { useConvexHttpQuery } from "../lib/useConvexHttpQuery";
import {
	IconActivity,
	IconArrowUpRight,
	IconClock,
	IconCurrencyDollar,
	IconPlayerPlay,
	IconPlayerPause,
	IconRefresh,
	IconRotateClockwise,
	IconShieldCheck,
	IconTargetArrow,
	IconTrash,
} from "@tabler/icons-react";

const CONTROL_BASE_URL =
	import.meta.env.VITE_COPY_TRADE_V2_CONTROL_URL?.trim() ||
	"http://127.0.0.1:18793";

type V2Status = {
	running: boolean;
	pid?: number;
	mode: string;
	bankroll: number;
	openPositions: number;
	totalPaperPnl: number;
	activeLeaderCount?: number;
	monitoredLeaderCount?: number;
	skipReasons?: Array<{ reason: string; count: number }>;
	leaderQuality?: Array<{
		address: string;
		label?: string;
		leaderState: string;
		cts: number;
		copyableScore: number;
		recentBuyCount: number;
		recentBuyPassCount: number;
		recentBuyPassRate: number;
		recentBuyMedianUsd: number;
		recentBuyAvgUsd: number;
		lastRank?: number;
		lastHealthReason?: string;
		openPositions: number;
	}>;
	status: string;
	lastHeartbeatAt: number;
};

type V2Position = {
	positionId: string;
	leaderAddress: string;
	marketId: string;
	marketSlug?: string;
	tokenId: string;
	outcomeIndex: number;
	shares: number;
	entryPrice: number;
	leaderEntryPrice: number;
	entryUsd: number;
	entryTimestamp: number;
	peakPrice: number;
	currentPrice?: number;
	stopLossPrice?: number;
	takeProfitPrice?: number;
	exitStrategy?: string;
	timeLimitAt?: number;
	exitPrice?: number;
	exitTimestamp?: number;
	exitReason?: string;
	pnl?: number;
	mode: string;
	leaderLabel?: string;
	marketTitle?: string;
};

type ControlStatus = {
	service: string;
	running: boolean;
	enabled: boolean;
	pid?: number | null;
	openPositions?: number;
	activeLeaders?: number;
	exitOnlyLeaders?: number;
	roster?: Array<{
		address: string;
		label?: string;
		leader_state: string;
		copyable_score: number;
	}>;
	lastRefresh?: any;
	checkedAt?: string;
	runtimeDb?: string;
};

type CommandState = {
	label: string;
	ok: boolean;
	at: number;
	stdout?: string;
	stderr?: string;
	message?: string;
};

type V2EditableConfig = {
	cts_threshold: number;
	max_leaders: number;
	min_leader_trade_size: number;
	position_pct: number;
	max_position_usd: number;
	max_concurrent_positions: number;
	per_leader_allocation_pct: number;
	stop_loss_pct: number;
	take_profit_pct: number;
	time_limit_hours: number;
	initial_bankroll_usd: number;
};

type V2ConfigDraft = Record<keyof V2EditableConfig, string>;

type V2ConfigResponse = {
	ok?: boolean;
	message?: string;
	editableConfig?: V2EditableConfig;
	lockedConfig?: Record<string, unknown>;
	runtime?: ControlStatus;
	bankrollSync?: {
		updated?: boolean;
		reason?: string;
		openPositions?: number;
	};
};

const EDITABLE_CONFIG_FIELDS: Array<{
	key: keyof V2EditableConfig;
	label: string;
	type: "number";
	step: string;
	kind: "plain" | "usd" | "percent" | "hours";
	help: string;
}> = [
	{
		key: "cts_threshold",
		label: "CTS Threshold",
		type: "number",
		step: "1",
		kind: "plain",
		help: "Minimum CTS required for the daily roster.",
	},
	{
		key: "max_leaders",
		label: "Max Leaders",
		type: "number",
		step: "1",
		kind: "plain",
		help: "How many ranked leaders stay entry-active.",
	},
	{
		key: "initial_bankroll_usd",
		label: "Bankroll",
		type: "number",
		step: "1",
		kind: "usd",
		help: "Base bankroll used for the paper strategy.",
	},
	{
		key: "max_position_usd",
		label: "Max Position",
		type: "number",
		step: "1",
		kind: "usd",
		help: "Hard cap per copied entry.",
	},
	{
		key: "position_pct",
		label: "Position Size %",
		type: "number",
		step: "0.1",
		kind: "percent",
		help: "Percent of the leader trade size to mirror.",
	},
	{
		key: "per_leader_allocation_pct",
		label: "Per Leader Cap %",
		type: "number",
		step: "0.1",
		kind: "percent",
		help: "Max bankroll allocation to any one leader.",
	},
	{
		key: "min_leader_trade_size",
		label: "Min Leader Trade",
		type: "number",
		step: "1",
		kind: "usd",
		help: "Ignore leader buys smaller than this USD size.",
	},
	{
		key: "max_concurrent_positions",
		label: "Max Concurrent",
		type: "number",
		step: "1",
		kind: "plain",
		help: "Maximum open positions allowed at once.",
	},
	{
		key: "stop_loss_pct",
		label: "Stop Loss %",
		type: "number",
		step: "0.1",
		kind: "percent",
		help: "Stop-loss threshold applied to new entries.",
	},
	{
		key: "take_profit_pct",
		label: "Take Profit %",
		type: "number",
		step: "0.1",
		kind: "percent",
		help: "Take-profit threshold applied to new entries.",
	},
	{
		key: "time_limit_hours",
		label: "Time Limit",
		type: "number",
		step: "1",
		kind: "hours",
		help: "Maximum hold time before forced exit.",
	},
];

function configToDraft(config: V2EditableConfig): V2ConfigDraft {
	return {
		cts_threshold: String(config.cts_threshold),
		max_leaders: String(config.max_leaders),
		min_leader_trade_size: String(config.min_leader_trade_size),
		position_pct: String(config.position_pct * 100),
		max_position_usd: String(config.max_position_usd),
		max_concurrent_positions: String(config.max_concurrent_positions),
		per_leader_allocation_pct: String(config.per_leader_allocation_pct * 100),
		stop_loss_pct: String(config.stop_loss_pct * 100),
		take_profit_pct: String(config.take_profit_pct * 100),
		time_limit_hours: String(config.time_limit_hours),
		initial_bankroll_usd: String(config.initial_bankroll_usd),
	};
}

function draftToPayload(draft: V2ConfigDraft): V2EditableConfig {
	return {
		cts_threshold: Number(draft.cts_threshold),
		max_leaders: Number(draft.max_leaders),
		min_leader_trade_size: Number(draft.min_leader_trade_size),
		position_pct: Number(draft.position_pct) / 100,
		max_position_usd: Number(draft.max_position_usd),
		max_concurrent_positions: Number(draft.max_concurrent_positions),
		per_leader_allocation_pct: Number(draft.per_leader_allocation_pct) / 100,
		stop_loss_pct: Number(draft.stop_loss_pct) / 100,
		take_profit_pct: Number(draft.take_profit_pct) / 100,
		time_limit_hours: Number(draft.time_limit_hours),
		initial_bankroll_usd: Number(draft.initial_bankroll_usd),
	};
}

function fmtLockedPercent(value: unknown): string {
	if (typeof value !== "number") return "—";
	return `${(value * 100).toFixed(1)}%`;
}

function fieldSuffix(kind: "plain" | "usd" | "percent" | "hours"): string {
	if (kind === "usd") return "USD";
	if (kind === "percent") return "%";
	if (kind === "hours") return "hours";
	return "";
}

function fmtUsd(n: number | undefined | null, showSign = false): string {
	if (n == null) return "—";
	const s = Math.abs(n).toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	if (showSign) return (n >= 0 ? "+" : "−") + s.slice(1);
	return n < 0 ? "−" + s.slice(1) : s;
}

function fmtPrice(n: number | undefined | null): string {
	if (n == null) return "—";
	return `$${n.toFixed(3)}`;
}

function fmtTs(ms: number | undefined | null): string {
	if (!ms) return "—";
	return new Date(ms).toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function holdTime(entrySeconds: number, exitSeconds?: number | null): string {
	const start = entrySeconds * 1000;
	const end = exitSeconds ? exitSeconds * 1000 : Date.now();
	const mins = Math.round((end - start) / 60000);
	if (mins < 60) return `${mins}m`;
	const hrs = Math.round(mins / 60);
	if (hrs < 48) return `${hrs}h`;
	return `${Math.round(hrs / 24)}d`;
}

function shortAddr(addr: string): string {
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortMarket(id: string): string {
	return `${id.slice(0, 8)}…`;
}

function MetricCard({
	label,
	value,
	sub,
	icon,
	accent,
}: {
	label: string;
	value: string;
	sub?: string;
	icon: React.ReactNode;
	accent?: "positive" | "negative" | "neutral";
}) {
	const valueClass =
		accent === "positive"
			? "text-emerald-600"
			: accent === "negative"
				? "text-red-500"
				: "text-foreground";
	return (
		<div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-4 shadow-sm">
			<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
				{icon}
			</div>
			<div className="min-w-0">
				<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
					{label}
				</div>
				<div className={`text-lg font-bold leading-tight ${valueClass}`}>
					{value}
				</div>
				{sub && (
					<div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
				)}
			</div>
		</div>
	);
}

function SectionCard({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-2xl border border-border bg-white shadow-sm">
			<div className="border-b border-border px-5 py-4">
				<div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
					{title}
				</div>
				{subtitle && (
					<div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
				)}
			</div>
			<div className="px-5 py-4">{children}</div>
		</section>
	);
}

export default function CopyTradeV2Page() {
	const [bridgeStatus, setBridgeStatus] = useState<ControlStatus | null>(null);
	const [commandState, setCommandState] = useState<CommandState | null>(null);
	const [configState, setConfigState] = useState<CommandState | null>(null);
	const [editableConfig, setEditableConfig] = useState<V2EditableConfig | null>(null);
	const [configDraft, setConfigDraft] = useState<V2ConfigDraft | null>(null);
	const [lockedConfig, setLockedConfig] = useState<Record<string, unknown>>({});
	const [configBusy, setConfigBusy] = useState(false);
	const [refreshNonce, setRefreshNonce] = useState(0);
	const [resetCleared, setResetCleared] = useState(false);
	const status = useConvexHttpQuery<V2Status>(
		"copyTradeV2:getStatus",
		{ tenantId: DEFAULT_TENANT_ID },
		{ pollMs: 15_000, refreshKey: refreshNonce },
	);
	const positions = useConvexHttpQuery<V2Position[]>(
		"copyTradeV2:listPositions",
		{ tenantId: DEFAULT_TENANT_ID },
		{ pollMs: 15_000, refreshKey: refreshNonce },
	);
	const effectiveStatus = resetCleared
		? status
			? {
					...status,
					openPositions: 0,
					totalPaperPnl: 0,
					activeLeaderCount: 0,
					monitoredLeaderCount: 0,
					skipReasons: [],
					leaderQuality: [],
				}
			: null
		: status;
	const effectivePositions = resetCleared ? [] : positions;
	const openPositions = useMemo(
		() =>
			(effectivePositions ?? []).filter(
				(position) => position.exitPrice == null,
			),
		[effectivePositions],
	);
	const closedPositions = useMemo(
		() =>
			(effectivePositions ?? []).filter(
				(position) => position.exitPrice != null,
			),
		[effectivePositions],
	);
	const leaderRows = effectiveStatus?.leaderQuality ?? [];
	const skipReasons = effectiveStatus?.skipReasons ?? [];
	const totalPnl = effectiveStatus?.totalPaperPnl ?? 0;
	const bankroll = effectiveStatus?.bankroll ?? 0;
	const heartbeatAgeMs =
		effectiveStatus?.lastHeartbeatAt != null
			? Date.now() - effectiveStatus.lastHeartbeatAt
			: null;
	const heartbeatFresh = heartbeatAgeMs != null && heartbeatAgeMs < 45_000;
	const daemonRunning =
		bridgeStatus?.running ?? effectiveStatus?.running ?? false;
	const effectivePid = bridgeStatus?.pid ?? effectiveStatus?.pid ?? null;
	const showWaitingForHeartbeat = daemonRunning && !heartbeatFresh;
	const activeLeaders =
		effectiveStatus?.activeLeaderCount ?? bridgeStatus?.activeLeaders ?? 0;
	const monitoredLeaders =
		effectiveStatus?.monitoredLeaderCount ?? bridgeStatus?.roster?.length ?? 0;

	useEffect(() => {
		let cancelled = false;
		const loadBridgeStatus = async () => {
			try {
				const response = await fetch(`${CONTROL_BASE_URL}/status`);
				if (!response.ok) {
					if (!cancelled) setBridgeStatus(null);
					return null;
				}
				const payload = (await response.json()) as ControlStatus;
				if (!cancelled) setBridgeStatus(payload);
				return payload;
			} catch {
				if (!cancelled) setBridgeStatus(null);
				return null;
			}
		};
		void loadBridgeStatus();
		const id = window.setInterval(loadBridgeStatus, 15_000);
		return () => {
			cancelled = true;
			window.clearInterval(id);
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		const loadConfig = async () => {
			try {
				const response = await fetch(`${CONTROL_BASE_URL}/config`);
				if (!response.ok) {
					return;
				}
				const payload = (await response.json()) as V2ConfigResponse;
				if (cancelled || !payload.editableConfig) {
					return;
				}
				setEditableConfig(payload.editableConfig);
				setConfigDraft(configToDraft(payload.editableConfig));
				setLockedConfig(payload.lockedConfig ?? {});
				if (payload.runtime) {
					setBridgeStatus(payload.runtime);
				}
			} catch {
				// Keep current draft if the bridge is transiently unavailable.
			}
		};
		void loadConfig();
		return () => {
			cancelled = true;
		};
	}, [refreshNonce]);

	const controlBusy = commandState?.stdout === "running...";
	const busy = controlBusy || configBusy;
	const configDirty =
		editableConfig != null &&
		configDraft != null &&
		JSON.stringify(configDraft) !== JSON.stringify(configToDraft(editableConfig));

	const runCommand = async (path: string, label: string) => {
		if (path !== "/reset-run") {
			setResetCleared(false);
		}
		setCommandState({ label, ok: false, at: Date.now(), stdout: "running..." });
		try {
			const response = await fetch(`${CONTROL_BASE_URL}${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			const payload = (await response.json()) as {
				ok?: boolean;
				stdout?: string;
				stderr?: string;
				message?: string;
				runtime?: ControlStatus;
			};
			if (payload.runtime) {
				setBridgeStatus(payload.runtime);
			}
			if (response.ok && payload.ok !== false) {
				if (path === "/reset-run") {
					setResetCleared(true);
				}
				setRefreshNonce((value) => value + 1);
			}
			setCommandState({
				label,
				ok: response.ok && payload.ok !== false,
				at: Date.now(),
				stdout: payload.stdout,
				stderr: payload.stderr,
				message: payload.message,
			});
			const statusResp = await fetch(`${CONTROL_BASE_URL}/status`);
			if (statusResp.ok) {
				setBridgeStatus((await statusResp.json()) as ControlStatus);
			}
		} catch (error) {
			setCommandState({
				label,
				ok: false,
				at: Date.now(),
				stderr:
					error instanceof Error ? error.message : "Unknown control error",
			});
		}
	};

	const saveConfig = async () => {
		if (!configDraft) return;
		setConfigBusy(true);
		setConfigState({
			label: "save config",
			ok: false,
			at: Date.now(),
			stdout: "running...",
		});
		try {
			const response = await fetch(`${CONTROL_BASE_URL}/config`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ config: draftToPayload(configDraft) }),
			});
			const payload = (await response.json()) as V2ConfigResponse;
			if (payload.runtime) {
				setBridgeStatus(payload.runtime);
			}
			if (payload.editableConfig) {
				setEditableConfig(payload.editableConfig);
				setConfigDraft(configToDraft(payload.editableConfig));
			}
			if (payload.lockedConfig) {
				setLockedConfig(payload.lockedConfig);
			}
			setConfigState({
				label: "save config",
				ok: response.ok && payload.ok !== false,
				at: Date.now(),
				message: payload.message,
				stderr:
					payload.bankrollSync?.reason === "open_positions_present"
						? `Bankroll was not synced because ${payload.bankrollSync.openPositions ?? "some"} open position(s) remain. Use Reset Run to fully reset cash to the new bankroll.`
						: undefined,
			});
			if (response.ok && payload.ok !== false) {
				setResetCleared(false);
				setRefreshNonce((value) => value + 1);
			}
		} catch (error) {
			setConfigState({
				label: "save config",
				ok: false,
				at: Date.now(),
				stderr:
					error instanceof Error ? error.message : "Unknown config save error",
			});
		} finally {
			setConfigBusy(false);
		}
	};

	return (
		<div className="h-screen overflow-y-auto bg-[linear-gradient(180deg,#f8f9fa_0%,#f3f6fb_100%)]">
			<Header />
			<main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
							<IconTargetArrow size={12} />
							Copy V2
						</div>
						<h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
							Daily CTS rotation with isolated runtime state
						</h1>
						<p className="mt-1 max-w-3xl text-sm text-muted-foreground">
							Copy V2 keeps its own runtime DB, daemon, and control bridge while
							tracking the same daily CTS-snapshot roster that powers the paper
							parity test.
						</p>
					</div>
					<div className="flex flex-col items-start gap-2 lg:items-end">
						<div
							className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wider ${
								daemonRunning
									? "border-emerald-200 bg-emerald-50 text-emerald-700"
									: "border-border bg-muted text-muted-foreground"
							}`}
						>
							<span
								className={`h-2 w-2 rounded-full ${daemonRunning ? "animate-pulse bg-emerald-500" : "bg-gray-400"}`}
							/>
							{daemonRunning
								? `RUNNING · PID ${effectivePid ?? "?"}`
								: "STOPPED"}
							<span className="mx-1 opacity-30">|</span>
							<span>{effectiveStatus?.mode ?? "PAPER"}</span>
						</div>
						<div className="text-[10px] text-muted-foreground">
							{showWaitingForHeartbeat
								? "Daemon is running locally. Waiting for Convex heartbeat."
								: `Convex heartbeat: ${effectiveStatus ? fmtTs(effectiveStatus.lastHeartbeatAt) : "—"}`}
						</div>
						<div className="text-[10px] text-muted-foreground">
							Local daemon: {bridgeStatus?.running ? "running" : "stopped"} ·
							Service {bridgeStatus?.enabled ? "enabled" : "disabled"}
						</div>
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<MetricCard
						label="Bankroll"
						value={fmtUsd(bankroll)}
						sub="Paper runtime bankroll"
						icon={<IconCurrencyDollar size={20} />}
					/>
					<MetricCard
						label="Open Positions"
						value={String(openPositions.length)}
						sub={`${closedPositions.length} closed tracked`}
						icon={<IconActivity size={20} className="text-violet-600" />}
					/>
					<MetricCard
						label="Active Leaders"
						value={String(activeLeaders)}
						sub={`of ${monitoredLeaders} monitored`}
						icon={<IconShieldCheck size={20} className="text-emerald-600" />}
					/>
					<MetricCard
						label="Total PnL"
						value={fmtUsd(totalPnl, true)}
						sub="Realized + unrealized"
						icon={<IconArrowUpRight size={20} />}
						accent={totalPnl >= 0 ? "positive" : "negative"}
					/>
				</div>

				<div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
					<SectionCard
						title="Controls"
						subtitle="Start, stop, restart, and refresh the daily roster from the local control bridge."
					>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								disabled={busy}
								onClick={() => void runCommand("/start", "start")}
								className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<IconPlayerPlay size={16} />
								Start
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => void runCommand("/stop", "stop")}
								className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<IconPlayerPause size={16} />
								Stop
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => void runCommand("/restart", "restart")}
								className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<IconRotateClockwise size={16} />
								Restart
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() =>
									void runCommand("/refresh-roster", "refresh roster")
								}
								className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
							>
								<IconRefresh size={16} />
								Refresh Roster
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => {
									const confirmed = window.confirm(
										"Reset Copy V2 run? This will clear all tracked positions, execution history, and reset bankroll/PnL for a fresh run.",
									);
									if (confirmed) {
										void runCommand("/reset-run", "reset run");
									}
								}}
								className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 shadow-sm transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<IconTrash size={16} />
								Reset Run
							</button>
						</div>
						<div className="mt-3 text-[11px] text-muted-foreground">
							Reset Run deletes open and closed V2 paper positions, clears
							realized and unrealized PnL history, restores the configured
							bankroll, and restarts the daemon if it was already running.
						</div>
						<div className="mt-4 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm">
							<div className="font-semibold text-foreground">
								Last command: {commandState?.label ?? "—"}
							</div>
							<div className="mt-1 text-[11px] text-muted-foreground">
								{commandState
									? `${commandState.ok ? "OK" : "ERR"} · ${fmtTs(commandState.at)}${commandState.message ? ` · ${commandState.message}` : ""}${commandState.stdout ? ` · ${commandState.stdout}` : ""}${commandState.stderr ? ` · ${commandState.stderr}` : ""}`
									: "No control command executed yet."}
							</div>
						</div>
						<div className="mt-4 grid gap-2 sm:grid-cols-2">
							<div className="rounded-xl border border-border bg-white px-4 py-3">
								<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
									Bridge Service
								</div>
								<div className="mt-1 text-sm font-semibold text-foreground">
									{bridgeStatus?.service ?? "copytrade-v2-daemon.service"}
								</div>
								<div className="mt-1 text-xs text-muted-foreground">
									Running: {bridgeStatus?.running ? "yes" : "no"} · Enabled:{" "}
									{bridgeStatus?.enabled ? "yes" : "no"}
								</div>
							</div>
							<div className="rounded-xl border border-border bg-white px-4 py-3">
								<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
									Last Roster Refresh
								</div>
								<div className="mt-1 text-sm font-semibold text-foreground">
									{bridgeStatus?.lastRefresh?.generated_at
										? fmtTs(
												Date.parse(
													String(bridgeStatus.lastRefresh.generated_at),
												),
											)
										: "—"}
								</div>
								<div className="mt-1 text-xs text-muted-foreground">
									{bridgeStatus?.lastRefresh
										? `${bridgeStatus.lastRefresh.final_active?.length ?? 0} active / ${bridgeStatus.lastRefresh.final_exit_only?.length ?? 0} exit-only`
										: "No roster log yet"}
								</div>
							</div>
						</div>
					</SectionCard>

					<SectionCard
						title="Strategy Config"
						subtitle="Editable values write to the live V2 config file, refresh the roster when needed, and restart the daemon if it is running."
					>
						{configDraft == null ? (
							<div className="py-8 text-sm text-muted-foreground">
								Loading config...
							</div>
						) : (
							<>
								<div className="grid gap-3 sm:grid-cols-2">
									{EDITABLE_CONFIG_FIELDS.map((field) => (
										<label
											key={field.key}
											className="rounded-xl border border-slate-100 px-3 py-3"
										>
											<div className="flex items-center justify-between gap-3">
												<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
													{field.label}
												</div>
												<div className="text-[10px] text-muted-foreground">
													{fieldSuffix(field.kind)}
												</div>
											</div>
											<input
												type={field.type}
												step={field.step}
												value={configDraft[field.key]}
												onChange={(event) =>
													setConfigDraft((current) =>
														current
															? {
																	...current,
																	[field.key]: event.target.value,
																}
															: current,
													)
												}
												className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-foreground outline-none transition focus:border-emerald-400"
											/>
											<div className="mt-2 text-[11px] text-muted-foreground">
												{field.help}
											</div>
										</label>
									))}
								</div>
								<div className="mt-4 flex flex-wrap items-center gap-2">
									<button
										type="button"
										disabled={busy || !configDirty}
										onClick={() => void saveConfig()}
										className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
									>
										Save Strategy
									</button>
									<button
										type="button"
										disabled={busy || editableConfig == null}
										onClick={() =>
											editableConfig && setConfigDraft(configToDraft(editableConfig))
										}
										className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
									>
										Discard Changes
									</button>
								</div>
								<div className="mt-3 text-[11px] text-muted-foreground">
									Changing CTS, max leaders, or min leader trade size refreshes the
									ranked roster. Saving while the daemon is running restarts it so
									the backend strategy actually uses the new settings.
								</div>
								<div className="mt-4 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm">
									<div className="font-semibold text-foreground">
										Last config update: {configState?.label ?? "—"}
									</div>
									<div className="mt-1 text-[11px] text-muted-foreground">
										{configState
											? `${configState.ok ? "OK" : "ERR"} · ${fmtTs(configState.at)}${configState.message ? ` · ${configState.message}` : ""}${configState.stderr ? ` · ${configState.stderr}` : ""}`
											: "No config changes saved yet."}
									</div>
								</div>
								<div className="mt-4 grid gap-2 sm:grid-cols-2">
									<div className="rounded-xl border border-slate-100 px-3 py-3">
										<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
											Locked Runtime Inputs
										</div>
										<div className="mt-2 text-sm font-semibold text-foreground">
											Latency {typeof lockedConfig.latency_seconds === "number" ? `${lockedConfig.latency_seconds}s` : "—"} · Fees{" "}
											{fmtLockedPercent(lockedConfig.taker_fee_pct)} · Slippage{" "}
											{typeof lockedConfig.slippage_multiplier === "number"
												? `${lockedConfig.slippage_multiplier}x`
												: "—"}
										</div>
										<div className="mt-1 text-[11px] text-muted-foreground">
											Execution {String(lockedConfig.execution_mode ?? "—")} · Exit mode{" "}
											{String(lockedConfig.exit_strategy ?? "—")}
										</div>
									</div>
									<div className="rounded-xl border border-slate-100 px-3 py-3">
										<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
											Bankroll Sync
										</div>
										<div className="mt-2 text-sm font-semibold text-foreground">
											{configState?.stderr?.includes("Bankroll was not synced")
												? "Deferred until reset"
												: "Immediate when flat"}
										</div>
										<div className="mt-1 text-[11px] text-muted-foreground">
											If open positions exist, changing bankroll updates the config
											file but does not rewrite current cash until the run is
											cleared.
										</div>
									</div>
								</div>
							</>
						)}
					</SectionCard>
				</div>

				<div className="grid gap-4 xl:grid-cols-2">
					<SectionCard
						title="Leader Roster"
						subtitle="CTS-snapshot ranked roster loaded by the daily refresh job."
					>
						{leaderRows.length === 0 ? (
							<div className="py-8 text-sm text-muted-foreground">
								No leader data yet.
							</div>
						) : (
							<div className="space-y-2">
								{leaderRows.map((leader) => (
									<div
										key={leader.address}
										className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2"
									>
										<div className="min-w-0">
											<div className="truncate text-sm font-semibold text-foreground">
												{leader.label ?? shortAddr(leader.address)}
											</div>
											<div className="text-[10px] uppercase tracking-wide text-muted-foreground">
												{leader.leaderState} · {leader.recentBuyCount} buys ·{" "}
												{Math.round(leader.recentBuyPassRate * 100)}% pass
											</div>
										</div>
										<div className="text-right">
											<div className="text-sm font-bold text-foreground">
												{Math.round(leader.copyableScore)}
											</div>
											<div className="text-[10px] text-muted-foreground">
												{leader.lastHealthReason ?? "ranked_active"}
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</SectionCard>

					<SectionCard
						title="Recent Skip Reasons"
						subtitle="Last processed daemon cycle."
					>
						{skipReasons.length === 0 ? (
							<div className="py-8 text-sm text-muted-foreground">
								No recent skips.
							</div>
						) : (
							<div className="space-y-2">
								{skipReasons.map((skip) => (
									<div
										key={skip.reason}
										className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
									>
										<div className="text-sm font-semibold text-foreground">
											{skip.reason}
										</div>
										<div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
											{skip.count}
										</div>
									</div>
								))}
							</div>
						)}
					</SectionCard>
				</div>

				<SectionCard
					title="Open Positions"
					subtitle="Open paper positions from the isolated V2 ledger."
				>
					{openPositions.length === 0 ? (
						<div className="py-8 text-sm text-muted-foreground">
							No open positions.
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-full text-xs">
								<thead>
									<tr className="border-b border-border bg-slate-50">
										{[
											"Leader",
											"Market",
											"Entry",
											"Price",
											"Unreal PnL",
											"Exit Plan",
											"Held",
										].map((header) => (
											<th
												key={header}
												className="whitespace-nowrap px-4 py-2 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500"
											>
												{header}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{openPositions.map((position) => {
										const currentPrice =
											position.currentPrice ?? position.peakPrice;
										const marketName =
											position.marketTitle ?? shortMarket(position.marketId);
										const unrealized =
											position.shares * currentPrice - position.entryUsd;
										const marketUrl = position.marketSlug
											? `https://polymarket.com/market/${position.marketSlug}`
											: null;
										return (
											<tr
												key={position.positionId}
												className="hover:bg-slate-50/60"
											>
												<td className="px-4 py-2.5 text-[11px] font-mono text-slate-500">
													{shortAddr(position.leaderAddress)}
												</td>
												<td className="px-4 py-2.5 text-[11px] text-slate-500">
													{marketUrl ? (
														<a
															href={marketUrl}
															target="_blank"
															rel="noreferrer"
															className="hover:underline hover:text-[#0ca678]"
														>
															{marketName}
														</a>
													) : (
														marketName
													)}
												</td>
												<td className="px-4 py-2.5 tabular-nums">
													{fmtUsd(position.entryUsd)}
												</td>
												<td className="px-4 py-2.5 tabular-nums">
													{currentPrice.toFixed(3)}
												</td>
												<td
													className={`px-4 py-2.5 tabular-nums font-bold ${
														unrealized >= 0
															? "text-emerald-600"
															: "text-red-500"
													}`}
												>
													{fmtUsd(unrealized, true)}
												</td>
												<td className="px-4 py-2.5 text-[11px] text-slate-500">
													<div className="flex flex-wrap gap-1">
														{position.exitStrategy && (
															<span className="rounded bg-violet-50 px-1.5 py-0.5 font-bold uppercase text-violet-700">
																{position.exitStrategy}
															</span>
														)}
														{position.takeProfitPrice != null && (
															<span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold uppercase text-emerald-700">
																TP {position.takeProfitPrice.toFixed(3)}
															</span>
														)}
														{position.stopLossPrice != null && (
															<span className="rounded bg-red-50 px-1.5 py-0.5 font-bold uppercase text-red-600">
																SL {position.stopLossPrice.toFixed(3)}
															</span>
														)}
														{position.timeLimitAt != null && (
															<span className="rounded bg-blue-50 px-1.5 py-0.5 font-bold uppercase text-blue-700">
																{Math.max(
																	0,
																	Math.round(
																		(position.timeLimitAt * 1000 - Date.now()) /
																			3600000,
																	),
																)}
																h left
															</span>
														)}
													</div>
												</td>
												<td className="px-4 py-2.5 text-muted-foreground">
													{holdTime(position.entryTimestamp)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</SectionCard>

				<SectionCard
					title="Closed Positions"
					subtitle="Resolved trades kept for auditability and sanity checks."
				>
					{closedPositions.length === 0 ? (
						<div className="py-8 text-sm text-muted-foreground">
							No closed positions yet.
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-full text-xs">
								<thead>
									<tr className="border-b border-border bg-slate-50">
										{[
											"Leader",
											"Market",
											"Entry",
											"Exit",
											"PnL",
											"Reason",
											"Hold",
										].map((header) => (
											<th
												key={header}
												className="whitespace-nowrap px-4 py-2 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500"
											>
												{header}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{closedPositions.map((position) => {
										const marketName =
											position.marketTitle ?? shortMarket(position.marketId);
										const pnl = position.pnl ?? 0;
										const marketUrl = position.marketSlug
											? `https://polymarket.com/market/${position.marketSlug}`
											: null;
										return (
											<tr
												key={position.positionId}
												className="hover:bg-slate-50/60"
											>
												<td className="px-4 py-2.5 text-[11px] font-mono text-slate-500">
													{shortAddr(position.leaderAddress)}
												</td>
												<td className="px-4 py-2.5 text-[11px] text-slate-500">
													{marketUrl ? (
														<a
															href={marketUrl}
															target="_blank"
															rel="noreferrer"
															className="hover:underline hover:text-[#0ca678]"
														>
															{marketName}
														</a>
													) : (
														marketName
													)}
												</td>
												<td className="px-4 py-2.5 tabular-nums">
													<div className="font-medium text-slate-700">
														{fmtPrice(position.entryPrice)}
													</div>
													<div className="text-[10px] text-muted-foreground">
														Cost {fmtUsd(position.entryUsd)}
													</div>
												</td>
												<td className="px-4 py-2.5 tabular-nums">
													{fmtPrice(position.exitPrice)}
												</td>
												<td
													className={`px-4 py-2.5 tabular-nums font-bold ${
														pnl >= 0 ? "text-emerald-600" : "text-red-500"
													}`}
												>
													{fmtUsd(pnl, true)}
												</td>
												<td className="px-4 py-2.5 text-[11px] text-slate-500">
													{position.exitReason ?? "—"}
												</td>
												<td className="px-4 py-2.5 text-muted-foreground">
													{holdTime(
														position.entryTimestamp,
														position.exitTimestamp,
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</SectionCard>

				<div className="grid gap-4 xl:grid-cols-2">
					<SectionCard
						title="Bridge Snapshot"
						subtitle="Raw control bridge state."
					>
						{bridgeStatus ? (
							<div className="space-y-3 text-sm">
								<div className="grid gap-2 sm:grid-cols-2">
									<div className="rounded-xl border border-border bg-slate-50 px-4 py-3">
										<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
											Open Positions
										</div>
										<div className="mt-1 text-lg font-bold text-foreground">
											{bridgeStatus.openPositions ?? 0}
										</div>
									</div>
									<div className="rounded-xl border border-border bg-slate-50 px-4 py-3">
										<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
											Active Leaders
										</div>
										<div className="mt-1 text-lg font-bold text-foreground">
											{bridgeStatus.activeLeaders ?? 0}
										</div>
									</div>
								</div>
								<div className="text-[11px] text-muted-foreground">
									Runtime DB: {bridgeStatus.runtimeDb ?? "—"} · PID{" "}
									{bridgeStatus.pid ?? "—"} · Checked{" "}
									{bridgeStatus.checkedAt ?? "—"}
								</div>
								<div className="rounded-xl border border-slate-100 bg-white p-3">
									<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
										Top Roster
									</div>
									<div className="mt-2 space-y-2">
										{(bridgeStatus.roster ?? []).slice(0, 6).map((leader) => (
											<div
												key={leader.address}
												className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
											>
												<div className="min-w-0">
													<div className="truncate text-sm font-semibold text-foreground">
														{leader.label ?? shortAddr(leader.address)}
													</div>
													<div className="text-[10px] uppercase tracking-wide text-muted-foreground">
														{leader.leader_state}
													</div>
												</div>
												<div className="text-sm font-bold text-foreground">
													{Math.round(leader.copyable_score)}
												</div>
											</div>
										))}
									</div>
								</div>
								{bridgeStatus.lastRefresh && (
									<div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-muted-foreground">
										Last refresh target:{" "}
										{String(bridgeStatus.lastRefresh.target_active ?? "—")} ·
										actual active{" "}
										{Array.isArray(bridgeStatus.lastRefresh.final_active)
											? bridgeStatus.lastRefresh.final_active.length
											: "—"}
									</div>
								)}
							</div>
						) : (
							<div className="py-6 text-sm text-muted-foreground">
								Bridge status unavailable.
							</div>
						)}
					</SectionCard>

					<SectionCard
						title="Operational Notes"
						subtitle="What this page is actually doing."
					>
						<ul className="space-y-3 text-sm text-muted-foreground">
							<li className="flex items-start gap-2">
								<IconClock
									size={16}
									className="mt-0.5 shrink-0 text-emerald-600"
								/>
								<span>
									Convex status and positions are polled every 15 seconds from
									the V2 namespace.
								</span>
							</li>
							<li className="flex items-start gap-2">
								<IconRefresh
									size={16}
									className="mt-0.5 shrink-0 text-emerald-600"
								/>
								<span>
									The local control bridge can start, stop, restart, or refresh
									the daily roster without touching V1.
								</span>
							</li>
							<li className="flex items-start gap-2">
								<IconTargetArrow
									size={16}
									className="mt-0.5 shrink-0 text-emerald-600"
								/>
								<span>
									V2 uses the MIRROR_TP_SL exit chain and a separate runtime DB
									so its paper ledger stays isolated.
								</span>
							</li>
						</ul>
					</SectionCard>
				</div>
			</main>
		</div>
	);
}
