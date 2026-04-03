import { useMemo, useState } from "react";
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
				Run the sync script to push positions and open orders to Mission Control
			</p>
		</div>
	);
}

interface PolymarketPosition {
	market: string;
	marketQuestion: string;
	marketSlug: string;
	outcome: string;
	shares: number;
	entryPrice: number;
	currentPrice: number;
	costBasis: number;
	currentValue: number;
	payout: number;
	unrealizedPnl: number;
	marketClosed: boolean;
	marketResolved: boolean;
	winner?: boolean;
}

interface PolymarketTrade {
	id: string;
	market: string;
	marketQuestion: string;
	side: string;
	outcome: string;
	shares: number;
	price: number;
	cost: number;
	payout: number;
	timestamp: number;
	txHash?: string;
	status: string;
}

interface PolymarketOpenOrder {
	id: string;
	status: string;
	market: string;
	marketQuestion: string;
	marketSlug: string;
	assetId: string;
	outcome: string;
	side: string;
	originalSize: number;
	sizeMatched: number;
	sizeRemaining: number;
	price: number;
	orderType: string;
	createdAt: number;
	expiration?: number;
}

interface PolymarketData {
	walletAddress: string;
	balanceUsdc: number;
	openOrders: PolymarketOpenOrder[];
	positions: PolymarketPosition[];
	trades: PolymarketTrade[];
	totalInvested: number;
	totalCurrentValue: number;
	totalPnl: number;
	lastSyncedAt: number;
}

function formatRemainingSize(n: number): string {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	});
}

function formatOrderAge(ts: number): string {
	const diffMs = Date.now() - ts;
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

function PolymarketOrderBadge({
	status,
}: {
	status: string;
}) {
	const normalized = status.trim().toUpperCase();
	const cls =
		normalized === "LIVE"
			? "bg-blue-100 text-blue-700"
			: normalized === "MATCHED"
				? "bg-emerald-100 text-emerald-700"
				: normalized === "UNMATCHED"
					? "bg-amber-100 text-amber-700"
					: "bg-slate-100 text-slate-600";
	return (
		<span
			className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}
		>
			{normalized || "LIVE"}
		</span>
	);
}

function PolymarketSideBadge({ side }: { side: string }) {
	const normalized = side.trim().toUpperCase();
	const cls =
		normalized === "BUY"
			? "bg-emerald-100 text-emerald-700"
			: normalized === "SELL"
				? "bg-amber-100 text-amber-700"
				: "bg-slate-100 text-slate-600";
	return (
		<span
			className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}
		>
			{normalized || "---"}
		</span>
	);
}

export default function PolymarketPage() {
	const data = useQuery(api.polymarket.getPositions, {
		tenantId: DEFAULT_TENANT_ID,
	}) as PolymarketData | undefined;
	const scheduleRefresh = useMutation(api.polymarket.scheduleRefresh);
	const [isRefreshing, setIsRefreshing] = useState(false);

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
	const openOrders = useMemo(() => data?.openOrders ?? [], [data?.openOrders]);
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

							{/* Open orders */}
							<section>
								<div className="mb-3 flex items-center gap-2">
									<h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
										Open Orders
										{openOrders.length > 0 && (
											<span className="ml-2 text-muted-foreground font-normal normal-case">
												({openOrders.length})
											</span>
										)}
									</h3>
								</div>
								<p className="mb-3 text-xs text-muted-foreground">
									Resting limit orders pulled from the authenticated Polymarket
									sync, separate from filled wallet positions.
								</p>
								{openOrders.length === 0 ? (
									<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
										No open orders found
									</div>
								) : (
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Placed</th>
													<th className="text-left px-3 py-3">Market</th>
													<th className="text-left px-3 py-3">Side</th>
													<th className="text-left px-3 py-3">Outcome</th>
													<th className="text-right px-3 py-3">Price</th>
													<th className="text-right px-3 py-3">Remaining</th>
													<th className="text-right px-3 py-3">Matched</th>
													<th className="text-right px-4 py-3">Status</th>
												</tr>
											</thead>
											<tbody>
												{openOrders.map((order, i) => (
													<tr
														key={order.id}
														className={
															i < openOrders.length - 1
																? "border-b border-border/50"
																: ""
														}
													>
														<td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
															{formatOrderAge(order.createdAt)}
														</td>
														<td className="px-3 py-3 max-w-[260px]">
															{order.marketSlug ? (
																<a
																	href={`https://polymarket.com/event/${order.marketSlug}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-foreground hover:text-[var(--accent-orange)] transition-colors font-medium flex items-center gap-1"
																>
																	<span className="truncate">
																		{order.marketQuestion}
																	</span>
																	<IconExternalLink
																		size={12}
																		className="shrink-0 opacity-40"
																	/>
																</a>
															) : (
																<span className="font-medium text-foreground">
																	{order.marketQuestion}
																</span>
															)}
														</td>
														<td className="px-3 py-3">
															<PolymarketSideBadge side={order.side} />
														</td>
														<td className="px-3 py-3">
															<span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-slate-100 text-slate-600">
																{order.outcome.toUpperCase()}
															</span>
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															${order.price.toFixed(3)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums font-medium">
															{formatRemainingSize(order.sizeRemaining)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															{formatRemainingSize(order.sizeMatched)}
														</td>
														<td className="text-right px-4 py-3">
															<PolymarketOrderBadge status={order.status} />
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</section>

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
