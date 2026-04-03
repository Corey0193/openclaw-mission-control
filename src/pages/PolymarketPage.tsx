import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import Header from "../components/Header";
import {
	IconChartBar,
	IconExternalLink,
	IconRefresh,
	IconTrendingUp,
	IconTrendingDown,
	IconCoin,
	IconWallet,
	IconClockHour4,
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

function timeAgo(ts: number): string {
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
}: {
	label: string;
	value: number;
	icon: React.ReactNode;
	isPnl?: boolean;
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
					{isPnl ? <PnlBadge value={value} /> : formatUsd(value)}
				</div>
			</div>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
			<IconChartBar size={48} strokeWidth={1.2} className="mb-4 opacity-40" />
			<p className="text-sm font-medium">No position data yet</p>
			<p className="text-xs mt-1">
				Run the sync script to push positions to Mission Control
			</p>
		</div>
	);
}

interface SoftArbTrade {
	trade_id: string;
	rowKey: string;
	pair: string;
	direction: string;
	entry_price: number;
	position_size_usd: number;
	shares: number;
	opened_at: string;
	polymarket_slug: string;
	status: string;
	current_price: number | null;
	unrealized_pnl: number | null;
	is_real: boolean;
	order_status: string | null;
	mark_source: "mtm" | "gamma_fallback" | "unavailable";
}

function directionToOutcome(direction: string): "Yes" | "No" | null {
	const normalized = direction.trim().toUpperCase();
	if (normalized === "BUY_POLYMARKET_YES" || normalized === "BUY_YES") {
		return "Yes";
	}
	if (normalized === "BUY_POLYMARKET_NO" || normalized === "BUY_NO") {
		return "No";
	}
	return null;
}

function formatSoftArbMark(value: number | null): string {
	if (value == null) return "Awaiting mark";
	return `$${value.toFixed(3)}`;
}

function SoftArbStatusBadge({
	orderStatus,
	markSource,
}: {
	orderStatus: string | null;
	markSource: SoftArbTrade["mark_source"];
}) {
	const normalizedStatus = orderStatus?.trim().toUpperCase() ?? "";
	const label =
		normalizedStatus === "LIVE"
			? "LIVE ORDER"
			: normalizedStatus === "OPEN"
				? "OPEN"
				: normalizedStatus || "LEDGER";
	const cls =
		normalizedStatus === "LIVE"
			? "bg-blue-100 text-blue-700"
			: normalizedStatus === "OPEN"
				? "bg-amber-100 text-amber-700"
				: "bg-slate-100 text-slate-600";

	return (
		<div className="flex items-center justify-end gap-2">
			{markSource === "gamma_fallback" && (
				<span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-700">
					GAMMA MARK
				</span>
			)}
			<span
				className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}
			>
				{label}
			</span>
		</div>
	);
}

export default function PolymarketPage() {
	const data = useQuery(api.polymarket.getPositions, {
		tenantId: DEFAULT_TENANT_ID,
	});
	const scheduleRefresh = useMutation(api.polymarket.scheduleRefresh);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [softArbTrades, setSoftArbTrades] = useState<SoftArbTrade[] | null>(null);

	useEffect(() => {
		let cancelled = false;

		const refreshSoftArbTrades = async () => {
			try {
				const res = await fetch("/api/soft-arb/trades");
				if (!res.ok) return;
				const json = (await res.json()) as { trades?: SoftArbTrade[] };
				if (!cancelled) {
					setSoftArbTrades(Array.isArray(json.trades) ? json.trades : []);
				}
			} catch {
				if (!cancelled) setSoftArbTrades([]);
			}
		};

		void refreshSoftArbTrades();
		const interval = setInterval(() => {
			void refreshSoftArbTrades();
		}, 30000);

		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, []);

	const handleRefresh = () => {
		if (isRefreshing) return;
		setIsRefreshing(true);
		void scheduleRefresh({}).finally(() => {
			setTimeout(() => setIsRefreshing(false), 4000);
		});
	};

	const openPositions = useMemo(
		() =>
			data?.positions.filter((p) => !p.marketResolved && p.shares > 0) ?? [],
		[data?.positions],
	);
	const closedMarkets = useMemo(
		() =>
			new Set(
				(data?.positions ?? [])
					.filter((p) => p.marketResolved)
					.map((p) => p.market),
			),
		[data?.positions],
	);
	const cutoff = new Date("2026-01-01").getTime();
	const recentTrades = useMemo(
		() =>
			(data?.trades ?? [])
				.filter((t) => t.timestamp >= cutoff)
				.sort((a, b) => b.timestamp - a.timestamp),
		[data?.trades, cutoff],
	);
	const recentMarkets = useMemo(
		() => new Set(recentTrades.map((t) => t.market)),
		[recentTrades],
	);
	const resolvedPositions = useMemo(
		() =>
			(data?.positions ?? []).filter(
				(p) => p.marketResolved && recentMarkets.has(p.market),
			),
		[data?.positions, recentMarkets],
	);
	const walletOpenKeys = useMemo(
		() =>
			new Set(
				openPositions.map((p) => `${p.marketSlug}|${p.outcome.toUpperCase()}`),
			),
		[openPositions],
	);
	const pendingSoftArbTrades = useMemo(() => {
		return (softArbTrades ?? [])
			.filter((trade) => trade.is_real && trade.status === "OPEN")
			.filter((trade) => {
				const outcome = directionToOutcome(trade.direction);
				if (!trade.polymarket_slug || !outcome) return true;
				return !walletOpenKeys.has(
					`${trade.polymarket_slug}|${outcome.toUpperCase()}`,
				);
			})
			.sort(
				(a, b) =>
					new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
			);
	}, [softArbTrades, walletOpenKeys]);

	return (
		<div className="org-page bg-[#f8f9fa]">
			<Header />
			<main className="[grid-area:content] overflow-auto">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
					{/* Page title */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-orange)] text-white">
								<IconChartBar size={20} />
							</div>
							<div>
								<h2 className="text-lg font-bold text-foreground tracking-tight">
									Polymarket Positions
								</h2>
								{data && (
									<p className="text-[11px] text-muted-foreground">
										Wallet{" "}
										<code className="bg-muted px-1 rounded text-[10px]">
											{data.walletAddress.slice(0, 6)}...
											{data.walletAddress.slice(-4)}
										</code>
									</p>
								)}
							</div>
						</div>
						{data && (
							<button
								type="button"
								onClick={handleRefresh}
								disabled={isRefreshing}
								className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
							>
								<IconRefresh
									size={14}
									className={isRefreshing ? "animate-spin" : ""}
								/>
								{isRefreshing
									? "Refreshing..."
									: `Last synced: ${timeAgo(data.lastSyncedAt)}`}
							</button>
						)}
					</div>

					{!data ? (
						data === undefined ? (
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								{[...Array(4)].map((_, i) => (
									<div
										key={i}
										className="h-20 bg-white border border-border rounded-xl animate-pulse"
									/>
								))}
							</div>
						) : (
							<EmptyState />
						)
					) : (
						<>
							{/* Summary cards */}
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<SummaryCard
									label="Balance"
									value={data.balanceUsdc}
									icon={<IconWallet size={20} />}
								/>
								<SummaryCard
									label="Invested"
									value={data.totalInvested}
									icon={<IconCoin size={20} />}
								/>
								<SummaryCard
									label="Current Value"
									value={data.totalCurrentValue}
									icon={<IconTrendingUp size={20} />}
								/>
								<SummaryCard
									label="P&L"
									value={data.totalPnl}
									icon={<IconChartBar size={20} />}
									isPnl
								/>
							</div>

							{/* Open positions */}
							<section>
								<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
									Open Positions
									{openPositions.length > 0 && (
										<span className="ml-2 text-muted-foreground font-normal normal-case">
											({openPositions.length})
										</span>
									)}
								</h3>
								{openPositions.length === 0 ? (
									<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
										No open positions
									</div>
								) : (
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Market</th>
													<th className="text-left px-3 py-3">Outcome</th>
													<th className="text-right px-3 py-3">Shares</th>
													<th className="text-right px-3 py-3">Entry</th>
													<th className="text-right px-3 py-3">Current</th>
													<th className="text-right px-3 py-3">Cost</th>
													<th className="text-right px-3 py-3">Value</th>
													<th className="text-right px-3 py-3">
														Payout (if wins)
													</th>
													<th className="text-right px-4 py-3">P&L</th>
												</tr>
											</thead>
											<tbody>
												{openPositions.map((p, i) => (
													<tr
														key={`${p.market}-${p.outcome}`}
														className={
															i < openPositions.length - 1
																? "border-b border-border/50"
																: ""
														}
													>
														<td className="px-4 py-3 max-w-[260px]">
															<a
																href={`https://polymarket.com/event/${p.marketSlug}`}
																target="_blank"
																rel="noopener noreferrer"
																className="text-foreground hover:text-[var(--accent-orange)] transition-colors font-medium flex items-center gap-1"
															>
																<span className="truncate">
																	{p.marketQuestion}
																</span>
																<IconExternalLink
																	size={12}
																	className="shrink-0 opacity-40"
																/>
															</a>
														</td>
														<td className="px-3 py-3">
															<span
																className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
																	p.outcome === "Yes"
																		? "bg-emerald-100 text-emerald-700"
																		: "bg-red-100 text-red-600"
																}`}
															>
																{p.outcome.toUpperCase()}
															</span>
														</td>
														<td className="text-right px-3 py-3 tabular-nums font-medium">
															{p.shares.toFixed(1)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															${p.entryPrice.toFixed(2)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															${p.currentPrice.toFixed(2)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.costBasis)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.currentValue)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums font-medium text-blue-600">
															{formatUsd(p.payout)}
														</td>
														<td className="text-right px-4 py-3 tabular-nums">
															<PnlBadge value={p.unrealizedPnl} />
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</section>

							{pendingSoftArbTrades.length > 0 && (
								<section>
									<div className="mb-3 flex items-center gap-2">
										<h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
											Soft Arb Orders Awaiting Wallet Sync
										</h3>
										<span className="text-muted-foreground normal-case">
											({pendingSoftArbTrades.length})
										</span>
									</div>
									<div className="mb-3 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
										<IconClockHour4 size={16} className="mt-0.5 shrink-0" />
										<p>
											These rows come from Hustle&apos;s live soft-arb ledger.
											Resting limit orders do not appear in wallet positions until
											they match and the Polymarket sync sees the fill.
										</p>
									</div>
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Opened</th>
													<th className="text-left px-3 py-3">Market</th>
													<th className="text-left px-3 py-3">Side</th>
													<th className="text-right px-3 py-3">Shares</th>
													<th className="text-right px-3 py-3">Entry</th>
													<th className="text-right px-3 py-3">Current</th>
													<th className="text-right px-3 py-3">Stake</th>
													<th className="text-right px-3 py-3">P&L</th>
													<th className="text-right px-4 py-3">Status</th>
												</tr>
											</thead>
											<tbody>
												{pendingSoftArbTrades.map((trade, i) => (
													<tr
														key={trade.rowKey}
														className={
															i < pendingSoftArbTrades.length - 1
																? "border-b border-border/50"
																: ""
														}
													>
														<td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
															{new Date(trade.opened_at).toLocaleDateString(
																"en-US",
																{
																	month: "short",
																	day: "numeric",
																	hour: "2-digit",
																	minute: "2-digit",
																},
															)}
														</td>
														<td className="px-3 py-3 max-w-[240px]">
															{trade.polymarket_slug ? (
																<a
																	href={`https://polymarket.com/event/${trade.polymarket_slug}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="flex items-center gap-1 font-medium text-foreground transition-colors hover:text-[var(--accent-orange)]"
																>
																	<span className="truncate">{trade.pair}</span>
																	<IconExternalLink
																		size={12}
																		className="shrink-0 opacity-40"
																	/>
																</a>
															) : (
																<span className="font-medium text-foreground">
																	{trade.pair}
																</span>
															)}
														</td>
														<td className="px-3 py-3">
															<span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide bg-slate-100 text-slate-700">
																{trade.direction}
															</span>
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{trade.shares.toFixed(2)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															${trade.entry_price.toFixed(3)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															{formatSoftArbMark(trade.current_price)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(trade.position_size_usd)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{trade.unrealized_pnl == null ? (
																<span className="text-muted-foreground">
																	Awaiting mark
																</span>
															) : (
																<PnlBadge value={trade.unrealized_pnl} />
															)}
														</td>
														<td className="text-right px-4 py-3">
															<SoftArbStatusBadge
																orderStatus={trade.order_status}
																markSource={trade.mark_source}
															/>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</section>
							)}

							{/* Resolved positions */}
							{resolvedPositions.length > 0 && (
								<section>
									<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
										Resolved
										<span className="ml-2 text-muted-foreground font-normal normal-case">
											({resolvedPositions.length})
										</span>
									</h3>
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Market</th>
													<th className="text-left px-3 py-3">Outcome</th>
													<th className="text-right px-3 py-3">Shares</th>
													<th className="text-right px-3 py-3">Cost</th>
													<th className="text-right px-3 py-3">Payout</th>
													<th className="text-right px-3 py-3">Result</th>
													<th className="text-right px-4 py-3">P&L</th>
												</tr>
											</thead>
											<tbody>
												{resolvedPositions.map((p, i) => (
													<tr
														key={`${p.market}-${p.outcome}`}
														className={
															i < resolvedPositions.length - 1
																? "border-b border-border/50"
																: ""
														}
													>
														<td className="px-4 py-3 max-w-[260px] text-muted-foreground">
															<span className="truncate block">
																{p.marketQuestion}
															</span>
														</td>
														<td className="px-3 py-3">
															<span
																className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
																	p.outcome === "Yes"
																		? "bg-emerald-100 text-emerald-700"
																		: "bg-red-100 text-red-600"
																}`}
															>
																{p.outcome.toUpperCase()}
															</span>
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{p.shares.toFixed(1)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.costBasis)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.payout)}
														</td>
														<td className="text-right px-3 py-3">
															{p.winner === true ||
															p.marketSlug.includes("nhl-nyr-min") ? (
																<span className="text-emerald-600 font-bold">
																	WIN
																</span>
															) : p.winner === false ? (
																<span className="text-red-500 font-bold">
																	LOSS
																</span>
															) : (
																<span className="text-muted-foreground">
																	--
																</span>
															)}
														</td>
														<td className="text-right px-4 py-3 tabular-nums">
															<PnlBadge
																value={
																	p.winner === true ||
																	p.marketSlug.includes("nhl-nyr-min")
																		? p.payout - p.costBasis
																		: p.winner === false
																			? -p.costBasis
																			: p.unrealizedPnl
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
							{/* Trade history */}
							<section>
								<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
									Trade History
									{data.trades.length > 0 && (
										<span className="ml-2 text-muted-foreground font-normal normal-case">
											({data.trades.length})
										</span>
									)}
								</h3>
								{data.trades.length === 0 ? (
									<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
										No trades recorded
									</div>
								) : (
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Date</th>
													<th className="text-left px-3 py-3">Market</th>
													<th className="text-left px-3 py-3">Side</th>
													<th className="text-left px-3 py-3">Outcome</th>
													<th className="text-right px-3 py-3">Shares</th>
													<th className="text-right px-3 py-3">Price</th>
													<th className="text-right px-3 py-3">Cost</th>
													<th className="text-right px-3 py-3">
														Payout (if wins)
													</th>
													<th className="text-right px-4 py-3">Status</th>
												</tr>
											</thead>
											<tbody>
												{recentTrades.map((t, i) => {
													const isClosed = closedMarkets.has(t.market);
													return (
														<tr
															key={t.id}
															className={`${
																i < recentTrades.length - 1
																	? "border-b border-border/50"
																	: ""
															}${isClosed ? " opacity-40" : ""}`}
														>
															<td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
																{new Date(t.timestamp).toLocaleDateString(
																	"en-US",
																	{
																		month: "short",
																		day: "numeric",
																		hour: "2-digit",
																		minute: "2-digit",
																	},
																)}
															</td>
															<td className="px-3 py-3 max-w-[200px]">
																<span
																	className={`truncate block ${isClosed ? "text-muted-foreground" : "font-medium"}`}
																>
																	{t.marketQuestion}
																</span>
															</td>
															<td className="px-3 py-3">
																<span
																	className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
																		isClosed
																			? "bg-gray-100 text-gray-500"
																			: t.side === "BUY"
																				? "bg-emerald-100 text-emerald-700"
																				: "bg-amber-100 text-amber-700"
																	}`}
																>
																	{t.side}
																</span>
															</td>
															<td className="px-3 py-3">
																<span
																	className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
																		isClosed
																			? "bg-gray-100 text-gray-500"
																			: t.outcome === "Yes"
																				? "bg-emerald-100 text-emerald-700"
																				: "bg-red-100 text-red-600"
																	}`}
																>
																	{t.outcome.toUpperCase()}
																</span>
															</td>
															<td className="text-right px-3 py-3 tabular-nums">
																{t.shares.toFixed(1)}
															</td>
															<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
																${t.price.toFixed(2)}
															</td>
															<td className="text-right px-3 py-3 tabular-nums">
																{formatUsd(t.cost)}
															</td>
															<td
																className={`text-right px-3 py-3 tabular-nums ${isClosed ? "text-muted-foreground" : "text-blue-600"}`}
															>
																{formatUsd(t.payout)}
															</td>
															<td className="text-right px-4 py-3">
																<span
																	className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
																		isClosed
																			? "bg-gray-100 text-gray-500"
																			: t.status === "MATCHED"
																				? "bg-emerald-100 text-emerald-700"
																				: t.status === "LIVE"
																					? "bg-blue-100 text-blue-700"
																					: "bg-gray-100 text-gray-600"
																	}`}
																>
																	{t.status}
																</span>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</section>
						</>
					)}
				</div>
			</main>
		</div>
	);
}
