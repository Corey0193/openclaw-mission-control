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
};

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
				{sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
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
				{subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
			</div>
			<div className="px-5 py-4">{children}</div>
		</section>
	);
}

export default function CopyTradeV2Page() {
	const status = useConvexHttpQuery<V2Status>(
		"copyTradeV2:getStatus",
		{ tenantId: DEFAULT_TENANT_ID },
		{ pollMs: 15_000 },
	);
	const positions = useConvexHttpQuery<V2Position[]>(
		"copyTradeV2:listPositions",
		{ tenantId: DEFAULT_TENANT_ID },
		{ pollMs: 15_000 },
	);
	const [bridgeStatus, setBridgeStatus] = useState<ControlStatus | null>(null);
	const [commandState, setCommandState] = useState<CommandState | null>(null);

	const openPositions = useMemo(
		() => (positions ?? []).filter((position) => position.exitPrice == null),
		[positions],
	);
	const closedPositions = useMemo(
		() => (positions ?? []).filter((position) => position.exitPrice != null),
		[positions],
	);
	const leaderRows = status?.leaderQuality ?? [];
	const skipReasons = status?.skipReasons ?? [];
	const totalPnl = status?.totalPaperPnl ?? 0;
	const bankroll = status?.bankroll ?? 0;
	const activeLeaders = status?.activeLeaderCount ?? bridgeStatus?.activeLeaders ?? 0;
	const monitoredLeaders =
		status?.monitoredLeaderCount ?? bridgeStatus?.roster?.length ?? 0;

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			try {
				const response = await fetch(`${CONTROL_BASE_URL}/status`);
				if (!response.ok) return;
				const payload = (await response.json()) as ControlStatus;
				if (!cancelled) setBridgeStatus(payload);
			} catch {
				if (!cancelled) setBridgeStatus(null);
			}
		};
		void run();
		const id = window.setInterval(run, 15_000);
		return () => {
			cancelled = true;
			window.clearInterval(id);
		};
	}, []);

	const runCommand = async (path: string, label: string) => {
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
			};
			setCommandState({
				label,
				ok: response.ok && payload.ok !== false,
				at: Date.now(),
				stdout: payload.stdout,
				stderr: payload.stderr,
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
				stderr: error instanceof Error ? error.message : "Unknown control error",
			});
		}
	};

	const configSnapshot = [
		["CTS Threshold", "80"],
		["Bankroll", "$500"],
		["Max Position", "$25"],
		["Max Leaders", "30"],
		["TP / SL", "10% / 10%"],
		["Exit Mode", "MIRROR_TP_SL"],
		["Latency", "30s"],
		["Fees", "2.0%"],
		["Slippage", "1.5x"],
		["Time Limit", "48h"],
	] as const;

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
								status?.running
									? "border-emerald-200 bg-emerald-50 text-emerald-700"
									: "border-border bg-muted text-muted-foreground"
							}`}
						>
							<span
								className={`h-2 w-2 rounded-full ${status?.running ? "animate-pulse bg-emerald-500" : "bg-gray-400"}`}
							/>
							{status?.running ? `RUNNING · PID ${status.pid ?? "?"}` : "STOPPED"}
							<span className="mx-1 opacity-30">|</span>
							<span>{status?.mode ?? "PAPER"}</span>
						</div>
						<div className="text-[10px] text-muted-foreground">
							Convex heartbeat: {status ? fmtTs(status.lastHeartbeatAt) : "—"}
						</div>
						<div className="text-[10px] text-muted-foreground">
							Bridge: {bridgeStatus?.running ? "online" : "offline"} · Service{" "}
							{bridgeStatus?.enabled ? "enabled" : "disabled"}
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
								onClick={() => void runCommand("/start", "start")}
								className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
							>
								<IconPlayerPlay size={16} />
								Start
							</button>
							<button
								type="button"
								onClick={() => void runCommand("/stop", "stop")}
								className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-600"
							>
								<IconPlayerPause size={16} />
								Stop
							</button>
							<button
								type="button"
								onClick={() => void runCommand("/restart", "restart")}
								className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
							>
								<IconRotateClockwise size={16} />
								Restart
							</button>
							<button
								type="button"
								onClick={() => void runCommand("/refresh-roster", "refresh roster")}
								className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-muted"
							>
								<IconRefresh size={16} />
								Refresh Roster
							</button>
						</div>
						<div className="mt-4 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm">
							<div className="font-semibold text-foreground">
								Last command: {commandState?.label ?? "—"}
							</div>
							<div className="mt-1 text-[11px] text-muted-foreground">
								{commandState
									? `${commandState.ok ? "OK" : "ERR"} · ${fmtTs(commandState.at)}${commandState.stdout ? ` · ${commandState.stdout}` : ""}${commandState.stderr ? ` · ${commandState.stderr}` : ""}`
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
										? fmtTs(Date.parse(String(bridgeStatus.lastRefresh.generated_at)))
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
						title="Config Snapshot"
						subtitle="The V2 runtime is pinned to this formula until you deliberately revise it."
					>
						<div className="grid gap-2 sm:grid-cols-2">
							{configSnapshot.map(([label, value]) => (
								<div
									key={label}
									className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
								>
									<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
										{label}
									</div>
									<div className="text-sm font-semibold text-foreground">
										{value}
									</div>
								</div>
							))}
						</div>
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

					<SectionCard title="Recent Skip Reasons" subtitle="Last processed daemon cycle.">
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
										{["Leader", "Market", "Entry", "Price", "Unreal PnL", "Exit Plan", "Held"].map(
											(header) => (
												<th
													key={header}
													className="whitespace-nowrap px-4 py-2 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500"
												>
													{header}
												</th>
											),
										)}
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{openPositions.map((position) => {
										const currentPrice = position.currentPrice ?? position.peakPrice;
										const marketName = position.marketTitle ?? shortMarket(position.marketId);
										const unrealized = position.shares * currentPrice - position.entryUsd;
										const marketUrl = position.marketSlug
											? `https://polymarket.com/market/${position.marketSlug}`
											: null;
										return (
											<tr key={position.positionId} className="hover:bg-slate-50/60">
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
												<td className="px-4 py-2.5 tabular-nums">{fmtUsd(position.entryUsd)}</td>
												<td className="px-4 py-2.5 tabular-nums">{currentPrice.toFixed(3)}</td>
												<td
													className={`px-4 py-2.5 tabular-nums font-bold ${
														unrealized >= 0 ? "text-emerald-600" : "text-red-500"
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
																	Math.round((position.timeLimitAt * 1000 - Date.now()) / 3600000),
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
										{["Leader", "Market", "Entry", "Exit", "PnL", "Reason", "Hold"].map(
											(header) => (
												<th
													key={header}
													className="whitespace-nowrap px-4 py-2 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500"
												>
													{header}
												</th>
											),
										)}
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{closedPositions.map((position) => {
										const marketName = position.marketTitle ?? shortMarket(position.marketId);
										const pnl = position.pnl ?? 0;
										const marketUrl = position.marketSlug
											? `https://polymarket.com/market/${position.marketSlug}`
											: null;
										return (
											<tr key={position.positionId} className="hover:bg-slate-50/60">
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
												<td className="px-4 py-2.5 tabular-nums">{fmtUsd(position.entryUsd)}</td>
												<td className="px-4 py-2.5 tabular-nums">{fmtUsd(position.exitPrice)}</td>
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
													{holdTime(position.entryTimestamp, position.exitTimestamp)}
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
					<SectionCard title="Bridge Snapshot" subtitle="Raw control bridge state.">
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
									{bridgeStatus.pid ?? "—"} · Checked {bridgeStatus.checkedAt ?? "—"}
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
										{String(bridgeStatus.lastRefresh.target_active ?? "—")} · actual active{" "}
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
								<IconClock size={16} className="mt-0.5 shrink-0 text-emerald-600" />
								<span>
									Convex status and positions are polled every 15 seconds from the
									V2 namespace.
								</span>
							</li>
							<li className="flex items-start gap-2">
								<IconRefresh size={16} className="mt-0.5 shrink-0 text-emerald-600" />
								<span>
									The local control bridge can start, stop, restart, or refresh the
									daily roster without touching V1.
								</span>
							</li>
							<li className="flex items-start gap-2">
								<IconTargetArrow size={16} className="mt-0.5 shrink-0 text-emerald-600" />
								<span>
									V2 uses the MIRROR_TP_SL exit chain and a separate runtime DB so
									its paper ledger stays isolated.
								</span>
							</li>
						</ul>
					</SectionCard>
				</div>
			</main>
		</div>
	);
}
