import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import Header from "../components/Header";
import {
	IconTrendingUp,
	IconTrendingDown,
	IconCurrencyDollar,
	IconChartLine,
	IconWallet,
	IconAlertCircle,
	IconCircleCheck,
	IconClock,
	IconActivity,
	} from "@tabler/icons-react";
import {
        LineChart,
        Line,
        XAxis,
        YAxis,
        Tooltip,
        ResponsiveContainer,
        ReferenceLine,
} from "recharts";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtPct(n: number): string {
	return (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
}

function fmtTs(ts: number): string {
	return new Date(ts * 1000).toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function holdTime(entryTs: number, exitTs?: number | null): string {
	const end = exitTs ? exitTs * 1000 : Date.now();
	const mins = Math.round((end - entryTs * 1000) / 60000);
	if (mins < 60) return `${mins}m`;
	const hrs = Math.round(mins / 60);
	if (hrs < 48) return `${hrs}h`;
	return `${Math.round(hrs / 24)}d`;
}

function shortAddr(addr: string): string {
	return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function shortMarket(id: string): string {
	return id.slice(0, 8) + "…";
}

function firstNonEmptyString(...values: Array<string | null | undefined>): string | null {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return null;
}

type PolymarketMarketMeta = {
	marketSlug: string | null;
	question: string | null;
	outcomesByTokenId: Record<string, string>;
	pricesByTokenId: Record<string, number>;
};

const polymarketMarketMetaCache = new Map<string, PolymarketMarketMeta | null>();

function buildPolymarketMarketUrl(marketSlug?: string | null): string | null {
	if (!marketSlug) return null;
	return `https://polymarket.com/market/${marketSlug}`;
}

function fallbackOutcomeLabel(outcomeIndex: number): string {
	return outcomeIndex === 0 ? "Yes" : "No";
}

// ── Summary card ─────────────────────────────────────────────────────────────

function StatCard({
	label,
	value,
	sub,
	icon,
	positive,
}: {
	label: string;
	value: string;
	sub?: string;
	icon: React.ReactNode;
	positive?: boolean;
}) {
	const accent =
		positive === true
			? "text-emerald-600"
			: positive === false
			? "text-red-500"
			: "text-foreground";
	return (
		<div className="flex items-center gap-3 bg-white border border-border rounded-xl px-5 py-4 shadow-sm">
			<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
				{icon}
			</div>
			<div className="min-w-0">
				<div className="text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
					{label}
				</div>
				<div className={`text-lg font-bold leading-tight ${accent}`}>{value}</div>
				{sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
			</div>
		</div>
	);
}

// ── Exit reason badge ─────────────────────────────────────────────────────────

function ReasonBadge({ reason }: { reason: string | undefined | null }) {
	if (!reason) return <span className="text-muted-foreground">—</span>;
	const colors: Record<string, string> = {
		TAKE_PROFIT: "bg-emerald-100 text-emerald-700",
		STOP_LOSS: "bg-red-100 text-red-600",
		MIRROR: "bg-violet-100 text-violet-700",
		TIME_LIMIT: "bg-blue-100 text-blue-700",
		TRAILING_STOP: "bg-amber-100 text-amber-700",
		FORCE_CLOSE: "bg-gray-100 text-gray-600",
	};
	const cls = colors[reason] ?? "bg-slate-100 text-slate-600";
	return (
		<span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${cls}`}>
			{reason.replace("_", " ")}
		</span>
	);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CopyTradePage() {
	const status = useQuery(api.copyTrade.getStatus, { tenantId: DEFAULT_TENANT_ID });
	const allPositions = useQuery(api.copyTrade.listPositions, { tenantId: DEFAULT_TENANT_ID });
	const wallets = useQuery(api.wallets.list, { tenantId: DEFAULT_TENANT_ID });
	const [tab, setTab] = useState<"open" | "closed">("open");
	const [nowMs, setNowMs] = useState(() => Date.now());
	const [resolvedMarketMeta, setResolvedMarketMeta] = useState<
		Record<string, PolymarketMarketMeta>
	>({});

	const walletNameByAddress = useMemo(() => {
		const entries = (wallets ?? [])
			.map((wallet) => [wallet.address, firstNonEmptyString(wallet.username)] as const)
			.filter(([, username]) => Boolean(username));
		return Object.fromEntries(entries) as Record<string, string>;
	}, [wallets]);

	const open = useMemo(
		() => (allPositions ?? []).filter((p) => p.exitPrice == null),
		[allPositions],
	);
	const closed = useMemo(
		() => (allPositions ?? []).filter((p) => p.exitPrice != null),
		[allPositions],
	);

	// Stats
	const wins = closed.filter((p) => (p.pnl ?? 0) > 0).length;
	const losses = closed.filter((p) => (p.pnl ?? 0) <= 0).length;
	const winRate = closed.length > 0 ? wins / closed.length : null;
	const avgWin =
		wins > 0
			? closed.filter((p) => (p.pnl ?? 0) > 0).reduce((s, p) => s + (p.pnl ?? 0), 0) / wins
			: null;
	const avgLoss =
		losses > 0
			? closed.filter((p) => (p.pnl ?? 0) <= 0).reduce((s, p) => s + (p.pnl ?? 0), 0) / losses
			: null;

	// Cumulative PnL chart data
	const pnlChartData = useMemo(() => {
		const sorted = [...closed]
			.filter((p) => p.exitTimestamp != null)
			.sort((a, b) => (a.exitTimestamp ?? 0) - (b.exitTimestamp ?? 0));

		return sorted.reduce<
			Array<{
				ts: string;
				cumPnl: number;
				pnl: number;
			}>
		>((points, p) => {
			const priorCumPnl = points.length > 0 ? points[points.length - 1].cumPnl : 0;
			const nextCumPnl = priorCumPnl + (p.pnl ?? 0);
			points.push({
				ts: fmtTs(p.exitTimestamp!),
				cumPnl: parseFloat(nextCumPnl.toFixed(2)),
				pnl: parseFloat((p.pnl ?? 0).toFixed(2)),
			});
			return points;
		}, []);
	}, [closed]);
	const totalPnl = status?.totalPaperPnl ?? 0;
	const bankroll = status?.bankroll ?? 0;
	const loading = allPositions === undefined;

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setNowMs(Date.now());
		}, 60000);
		return () => {
			window.clearInterval(intervalId);
		};
	}, []);

	useEffect(() => {
		if (!allPositions?.length) return;

		const unresolvedIds = Array.from(
			new Set(
				allPositions
					.filter(
						(pos) =>
							!resolvedMarketMeta[pos.marketId] &&
							!polymarketMarketMetaCache.has(pos.marketId),
					)
					.map((pos) => pos.marketId)
			),
		);

		if (unresolvedIds.length === 0) return;

		let cancelled = false;

		void Promise.all(
			unresolvedIds.map(async (marketId) => {
				try {
					const resp = await fetch(`https://clob.polymarket.com/markets/${marketId}`, {
						headers: { Accept: "application/json" },
					});
					if (!resp.ok) {
						polymarketMarketMetaCache.set(marketId, null);
						return [marketId, null] as const;
					}
					const payload = (await resp.json()) as {
						question?: unknown;
						market_slug?: unknown;
						tokens?: Array<{ token_id?: unknown; outcome?: unknown; price?: unknown }>;
					};
					const question =
						typeof payload.question === "string" && payload.question.trim()
							? payload.question.trim()
							: null;
					const marketSlug =
						typeof payload.market_slug === "string" && payload.market_slug.trim()
							? payload.market_slug.trim()
							: null;
					const outcomesByTokenId = Object.fromEntries(
						(payload.tokens ?? []).flatMap((token) => {
							const tokenId =
								typeof token.token_id === "string" && token.token_id.trim()
									? token.token_id.trim()
									: null;
							const outcome =
								typeof token.outcome === "string" && token.outcome.trim()
									? token.outcome.trim()
									: null;
							return tokenId && outcome ? [[tokenId, outcome] as const] : [];
						}),
					);
					const pricesByTokenId = Object.fromEntries(
						(payload.tokens ?? []).flatMap((token) => {
							const tokenId =
								typeof token.token_id === "string" && token.token_id.trim()
									? token.token_id.trim()
									: null;
							const price =
								typeof token.price === "number"
									? token.price
									: typeof token.price === "string" && token.price.trim()
										? Number(token.price)
										: null;
							return tokenId && price != null && Number.isFinite(price)
								? [[tokenId, price] as const]
								: [];
						}),
					);
					const meta = { marketSlug, question, outcomesByTokenId, pricesByTokenId };
					polymarketMarketMetaCache.set(marketId, meta);
					return [marketId, meta] as const;
				} catch {
					polymarketMarketMetaCache.set(marketId, null);
					return [marketId, null] as const;
				}
			}),
		).then((entries) => {
			if (cancelled) return;
			const updates = Object.fromEntries(
				entries.filter(
					(entry): entry is [string, PolymarketMarketMeta] => entry[1] !== null,
				),
			);
			if (Object.keys(updates).length === 0) return;
			setResolvedMarketMeta((current) => ({ ...current, ...updates }));
		});

		return () => {
			cancelled = true;
		};
	}, [allPositions, resolvedMarketMeta]);

	return (
		<div className="h-screen overflow-y-auto bg-[#f8f9fa]">
			<Header />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

				{/* Page title */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-foreground tracking-tight">
							Copy-Trade — Paper Mode
						</h1>
						<p className="text-[11px] text-muted-foreground mt-0.5">
							Live positions synced from daemon every 60 s
						</p>
					</div>
					{status && (
					        <div className="flex flex-col items-end gap-1">
					                <div
					                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider border ${
					                                status.running
					                                        ? "bg-[#f3f0ff] text-[#7048e8] border-violet-200"
					                                        : "bg-muted text-muted-foreground border-border"
					                        }`}
					                >
					                        <span
					                                className={`w-2 h-2 rounded-full ${status.running ? "bg-[#7048e8] animate-pulse" : "bg-gray-400"}`}
					                        />
					                        {status.running ? `RUNNING · PID ${status.pid ?? "?"}` : "STOPPED"}
					                        <span className="mx-1 opacity-20">|</span>
					                        <span className="uppercase">{status.mode}</span>
					                </div>
					                <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5 mr-2">
					                        <IconClock size={10} />
					                        Last heartbeat: {fmtTs(status.lastHeartbeatAt / 1000)}
					                </div>
					        </div>
					)}
					</div>

					{/* Summary cards */}
					<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
					<StatCard
					        label="Bankroll"
					        value={fmtUsd(bankroll)}
					        sub="Paper USD"
					        icon={<IconWallet size={20} />}
					/>
					<StatCard
					        label="Open Positions"
					        value={open.length.toString()}
					        sub={status?.status || "active"}
					        icon={<IconActivity size={20} className="text-violet-500" />}
					/>
					<StatCard
					        label="Total PnL"
					        value={fmtUsd(totalPnl, true)}
					        sub={`incl. unrealized (${closed.length} closed)`}
					        icon={<IconCurrencyDollar size={20} />}
					        positive={totalPnl >= 0}
					/>					<StatCard
					        label="Win Rate"
					        value={winRate != null ? `${(winRate * 100).toFixed(0)}%` : "—"}
					        sub={`${wins}W / ${losses}L`}
					        icon={<IconChartLine size={20} />}
					        positive={winRate != null ? winRate >= 0.5 : undefined}
					/>
					<StatCard
					        label="Avg W / L"
					        value={
					                avgWin != null && avgLoss != null
					                        ? `${fmtUsd(avgWin, true)}`
					                        : "—"
					        }
					        sub={avgLoss != null ? `Avg loss ${fmtUsd(avgLoss, true)}` : undefined}
					        icon={<IconTrendingUp size={20} />}
					        positive={avgWin != null && avgLoss != null ? Math.abs(avgWin) > Math.abs(avgLoss) : undefined}
					/>
					</div>
				{/* PnL chart (only when there are closed trades) */}
				{pnlChartData.length > 1 && (
					<div className="bg-white border border-border rounded-xl p-5 shadow-sm">
						<h2 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase mb-3">
							Cumulative PnL
						</h2>
						<ResponsiveContainer width="100%" height={180} minWidth={0}>
							<LineChart data={pnlChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
								<XAxis
									dataKey="ts"
									tick={{ fontSize: 10, fill: "#868e96" }}
									tickLine={false}
									axisLine={false}
									interval="preserveStartEnd"
								/>
								<YAxis
									tick={{ fontSize: 10, fill: "#868e96" }}
									tickLine={false}
									axisLine={false}
									tickFormatter={(v) => `$${v}`}
									width={48}
								/>
								<Tooltip
								        formatter={(v: any) => [fmtUsd(v, true), "Cum. PnL"]}
								        contentStyle={{ fontSize: 11, borderRadius: 8 }}
								/>								<ReferenceLine y={0} stroke="#dee2e6" strokeDasharray="4 2" />
								<Line
									type="monotone"
									dataKey="cumPnl"
									stroke={totalPnl >= 0 ? "#7048e8" : "#e03131"}
									strokeWidth={2}
									dot={false}
									activeDot={{ r: 4 }}
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				)}

				{/* Positions panel */}
				<div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
					{/* Tab bar */}
					<div className="flex border-b border-border">
						<button
							type="button"
							onClick={() => setTab("open")}
							className={`px-5 py-3 text-[12px] font-bold tracking-wide transition-colors ${
								tab === "open"
									? "text-[#7048e8] border-b-2 border-[#7048e8]"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Open Positions{" "}
							<span className="ml-1.5 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px]">
								{open.length}
							</span>
						</button>
						<button
							type="button"
							onClick={() => setTab("closed")}
							className={`px-5 py-3 text-[12px] font-bold tracking-wide transition-colors ${
								tab === "closed"
									? "text-[#7048e8] border-b-2 border-[#7048e8]"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Closed
							<span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px]">
								{closed.length}
							</span>
						</button>
					</div>

					{loading ? (
						<div className="py-12 text-center text-sm text-muted-foreground">
							Loading positions…
						</div>
					) : tab === "open" ? (
						open.length === 0 ? (
							<div className="py-12 text-center text-sm text-muted-foreground">
								No open positions
							</div>
						) : (
								<div className="overflow-x-auto">
									<table className="w-full text-xs">
										<thead>
											<tr className="bg-slate-50 border-b border-border">
												{["Leader", "Market", "Side", "Entry", "Cost", "Price", "Unreal. PnL", "Exit Targets", "Held", ""].map((h) => (
													<th
														key={h}
														className="px-4 py-2.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap"
													>
														{h}
													</th>
												))}
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100">
											{open.map((pos) => {
												const marketMeta =
													resolvedMarketMeta[pos.marketId] ??
													polymarketMarketMetaCache.get(pos.marketId) ??
													null;
												const currentPrice =
													marketMeta?.pricesByTokenId[pos.tokenId] ??
													pos.currentPrice ??
													pos.peakPrice;
												const leaderName =
													firstNonEmptyString(
														walletNameByAddress[pos.leaderAddress],
														pos.leaderLabel,
													) ?? shortAddr(pos.leaderAddress);
												const marketName =
													firstNonEmptyString(pos.marketTitle, marketMeta?.question) ??
													shortMarket(pos.marketId);
												const unrealPnl = pos.shares * currentPrice - pos.entryUsd;
												const marketUrl = buildPolymarketMarketUrl(
													pos.marketSlug ?? marketMeta?.marketSlug ?? null,
												);
												const outcomeLabel =
													marketMeta?.outcomesByTokenId[pos.tokenId] ??
													fallbackOutcomeLabel(pos.outcomeIndex);
												return (
													<tr key={pos.positionId} className="hover:bg-slate-50/50">
														<td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
															<a
																href={`https://polymarket.com/profile/${pos.leaderAddress}`}
																target="_blank"
																rel="noopener noreferrer"
																className="hover:underline hover:text-[#7048e8] transition-colors"
																title={pos.leaderAddress}
															>
																{leaderName}
															</a>
														</td>
														<td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
															{marketUrl ? (
																<a
																	href={marketUrl}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="hover:underline hover:text-[#7048e8] transition-colors"
																	title={firstNonEmptyString(pos.marketTitle, marketMeta?.question) || pos.marketId}
																>
																	{marketName.length > 25 ? marketName.slice(0, 25) + "…" : marketName}
																</a>
															) : (
																<span title={firstNonEmptyString(pos.marketTitle, marketMeta?.question) || pos.marketId}>
																	{marketName.length > 25 ? marketName.slice(0, 25) + "…" : marketName}
																</span>
															)}
														</td>
														<td className="px-4 py-2.5">
															<span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">
																{outcomeLabel}
															</span>
														</td>
														<td className="px-4 py-2.5 tabular-nums">{pos.entryPrice.toFixed(3)}</td>
														<td className="px-4 py-2.5 tabular-nums">{fmtUsd(pos.entryUsd)}</td>
														<td className="px-4 py-2.5 tabular-nums">{currentPrice.toFixed(3)}</td>
														<td className={`px-4 py-2.5 tabular-nums font-bold ${unrealPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
															{fmtUsd(unrealPnl, true)}
														</td>
														<td className="px-4 py-2.5 tabular-nums">
															<div className="flex flex-col gap-1">
																<div className="flex flex-col gap-0.5">
																	{pos.takeProfitPrice && (
																		<div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
																			<span className="w-4">TP</span> {pos.takeProfitPrice.toFixed(3)}
																		</div>
																	)}
																	{pos.stopLossPrice && (
																		<div className="text-[10px] text-red-500 font-bold flex items-center gap-1">
																			<span className="w-4">SL</span> {pos.stopLossPrice.toFixed(3)}
																		</div>
																	)}
																</div>
																<div className="flex flex-wrap gap-1">
																	{(pos.exitStrategy === "MIRROR" || pos.exitStrategy === "MIRROR_WITH_SL") && (
																		<span className="px-1 py-0.5 bg-violet-50 text-violet-600 rounded text-[9px] font-bold border border-violet-100 uppercase">
																			Mirroring {leaderName}
																		</span>
																	)}
																	{pos.timeLimitAt && (
																		<span
																			className="px-1 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold border border-blue-100 uppercase"
																			title={`Expires at ${new Date(pos.timeLimitAt * 1000).toLocaleString()}`}
																		>
																			Max {Math.round((pos.timeLimitAt - nowMs / 1000) / 3600)}h left
																		</span>
																	)}
																</div>
															</div>
														</td>
														<td className="px-4 py-2.5 text-muted-foreground">{holdTime(pos.entryTimestamp)}</td>
														<td className="px-4 py-2.5">
															<IconClock size={13} className="text-muted-foreground" />
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							)
						) : closed.length === 0 ? (
						<div className="py-12 text-center text-sm text-muted-foreground">
							No closed positions yet
						</div>
					) : (
							<div className="overflow-x-auto">
								<table className="w-full text-xs">
									<thead>
										<tr className="bg-slate-50 border-b border-border">
											{["Leader", "Market", "Entry", "Exit", "Cost", "PnL", "ROI", "Hold", "Reason", ""].map((h) => (
												<th
													key={h}
													className="px-4 py-2.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap"
												>
													{h}
												</th>
											))}
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{closed.map((pos) => {
											const roi = pos.entryUsd > 0 ? (pos.pnl ?? 0) / pos.entryUsd : 0;
											const isWin = (pos.pnl ?? 0) > 0;
											const marketMeta =
												resolvedMarketMeta[pos.marketId] ??
												polymarketMarketMetaCache.get(pos.marketId) ??
												null;
											const leaderName =
												firstNonEmptyString(
													walletNameByAddress[pos.leaderAddress],
													pos.leaderLabel,
												) ?? shortAddr(pos.leaderAddress);
											const marketName =
												firstNonEmptyString(pos.marketTitle, marketMeta?.question) ??
												shortMarket(pos.marketId);
											const marketUrl = buildPolymarketMarketUrl(
												pos.marketSlug ??
													marketMeta?.marketSlug ??
													polymarketSlugCache.get(pos.marketId) ??
													null,
											);
											return (
												<tr key={pos.positionId} className="hover:bg-slate-50/50">
													<td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
														<a
															href={`https://polymarket.com/profile/${pos.leaderAddress}`}
															target="_blank"
															rel="noopener noreferrer"
															className="hover:underline hover:text-[#7048e8] transition-colors"
															title={pos.leaderAddress}
														>
															{leaderName}
														</a>
													</td>
													<td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
														{marketUrl ? (
															<a
																href={marketUrl}
																target="_blank"
																rel="noopener noreferrer"
																className="hover:underline hover:text-[#7048e8] transition-colors"
																title={firstNonEmptyString(pos.marketTitle, marketMeta?.question) || pos.marketId}
															>
																{marketName.length > 25 ? marketName.slice(0, 25) + "…" : marketName}
															</a>
														) : (
															<span title={firstNonEmptyString(pos.marketTitle, marketMeta?.question) || pos.marketId}>
																{marketName.length > 25 ? marketName.slice(0, 25) + "…" : marketName}
															</span>
														)}
													</td>
													<td className="px-4 py-2.5 tabular-nums">{pos.entryPrice.toFixed(3)}</td>
													<td className="px-4 py-2.5 tabular-nums">{(pos.exitPrice ?? 0).toFixed(3)}</td>
													<td className="px-4 py-2.5 tabular-nums text-muted-foreground">{fmtUsd(pos.entryUsd)}</td>
													<td className={`px-4 py-2.5 tabular-nums font-bold ${isWin ? "text-emerald-600" : "text-red-500"}`}>
														{fmtUsd(pos.pnl, true)}
													</td>
													<td className={`px-4 py-2.5 tabular-nums ${isWin ? "text-emerald-600" : "text-red-500"}`}>
														{fmtPct(roi)}
													</td>
													<td className="px-4 py-2.5 text-muted-foreground">
														{holdTime(pos.entryTimestamp, pos.exitTimestamp)}
													</td>
													<td className="px-4 py-2.5">
														<ReasonBadge reason={pos.exitReason} />
													</td>
													<td className="px-4 py-2.5">
														{isWin ? (
															<IconCircleCheck size={13} className="text-emerald-500" />
														) : (
															<IconTrendingDown size={13} className="text-red-400" />
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
				</div>

				{/* Empty state hint */}
				{!loading && allPositions?.length === 0 && (
					<div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
						<IconAlertCircle size={16} />
						No positions synced yet — daemon syncs every 60 s once it finds qualifying leader trades.
					</div>
				)}
			</main>
		</div>
	);
}
