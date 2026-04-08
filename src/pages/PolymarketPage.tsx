import { useMemo, useState } from "react";
import { usePortfolio } from "../lib/usePortfolio";
import type { PortfolioPosition, PortfolioAlert } from "../types/portfolio";
import Header from "../components/Header";
import {
	IconChartBar,
	IconExternalLink,
	IconRefresh,
	IconTrendingUp,
	IconTrendingDown,
	IconCoin,
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

function timeAgo(isoStr: string): string {
	const diffMs = Date.now() - new Date(isoStr).getTime();
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

export default function PolymarketPage() {
	const { data: portfolio, loading, refresh } = usePortfolio();
	const [isRefreshing, setIsRefreshing] = useState(false);

	const handleRefresh = () => {
		if (isRefreshing) return;
		setIsRefreshing(true);
		void refresh().finally(() => {
			setTimeout(() => setIsRefreshing(false), 1500);
		});
	};

	// --- Derived position slices ---
	const trackedPositions = useMemo(
		() => (portfolio?.positions ?? []).filter((p) => p.category === "tracked"),
		[portfolio],
	);

	const manualPositions = useMemo(
		() => (portfolio?.positions ?? []).filter((p) => p.category === "manual"),
		[portfolio],
	);

	const legacyPositions = useMemo(
		() => (portfolio?.positions ?? []).filter((p) => p.category === "legacy"),
		[portfolio],
	);

	const highAlerts = useMemo(
		() => (portfolio?.alerts ?? []).filter((a) => a.type === "orphaned_trade"),
		[portfolio],
	);

	const claimableAlerts = useMemo(
		() =>
			(portfolio?.alerts ?? []).filter((a) => a.type === "unclaimed_payout"),
		[portfolio],
	);

	// Open positions = tracked, not resolved, has shares
	const openPositions = useMemo(
		() =>
			trackedPositions.filter(
				(p) => !p.onChain.resolved && p.onChain.shares > 0,
			),
		[trackedPositions],
	);

	// Resolved positions = all categories, resolved
	const resolvedPositions = useMemo(
		() =>
			(portfolio?.positions ?? []).filter(
				(p) => p.onChain.resolved || p.onChain.redeemable,
			),
		[portfolio],
	);

	// Summary stats
	const totalInvested = useMemo(
		() =>
			Math.round(
				(portfolio?.positions ?? []).reduce(
					(sum, p) => sum + p.onChain.initialValue,
					0,
				) * 100,
			) / 100,
		[portfolio],
	);

	const totalCurrentValue = useMemo(
		() =>
			Math.round(
				(portfolio?.positions ?? []).reduce(
					(sum, p) => sum + p.onChain.currentValue,
					0,
				) * 100,
			) / 100,
		[portfolio],
	);

	const totalPnl = useMemo(
		() =>
			Math.round(
				(portfolio?.positions ?? []).reduce(
					(sum, p) => sum + p.onChain.unrealizedPnl,
					0,
				) * 100,
			) / 100,
		[portfolio],
	);

	const isLoaded = !loading && portfolio !== null;

	return (
		<div className="org-page bg-[#f8f9fa]">
			<Header />

			{/* Source badge */}
			<div className="flex items-center gap-2 px-4 py-1 text-xs">
				<span
					className={`rounded-full px-2 py-0.5 font-mono ${
						portfolio?.source === "polymarket-api"
							? "bg-green-900 text-green-300"
							: "bg-yellow-900 text-yellow-300"
					}`}
				>
					{portfolio?.source === "polymarket-api" ? "Live" : "Cached"}
				</span>
				{portfolio?.fetchedAt && (
					<span className="text-gray-500">
						{new Date(portfolio.fetchedAt).toLocaleTimeString()}
					</span>
				)}
			</div>

			{/* Orphaned trade alerts */}
			{highAlerts.length > 0 && (
				<div className="mx-4 mb-4 rounded border border-red-700 bg-red-950 p-3">
					<p className="mb-1 text-sm font-semibold text-red-400">
						Pipeline Tracking Errors ({highAlerts.length})
					</p>
					{highAlerts.map((a: PortfolioAlert) => (
						<p key={a.tradeId ?? a.slug} className="text-xs text-red-300">
							{a.message}
						</p>
					))}
				</div>
			)}

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
									Polymarket Portfolio
								</h2>
								<p className="text-[11px] text-muted-foreground">
									On-chain truth via unified portfolio API
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{portfolio && (
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
										: `Fetched: ${timeAgo(portfolio.fetchedAt)}`}
								</button>
							)}
						</div>
					</div>

					{!isLoaded ? (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{[...Array(4)].map((_, i) => (
								<div
									key={i}
									className="h-20 bg-white border border-border rounded-xl animate-pulse"
								/>
							))}
						</div>
					) : (
						<>
							{/* Summary cards */}
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<SummaryCard
									label="Tracked Positions"
									value={trackedPositions.length}
									icon={<IconChartBar size={20} />}
								/>
								<SummaryCard
									label="Invested"
									value={totalInvested}
									icon={<IconCoin size={20} />}
								/>
								<SummaryCard
									label="Current Value"
									value={totalCurrentValue}
									icon={<IconTrendingUp size={20} />}
								/>
								<SummaryCard
									label="P&L"
									value={totalPnl}
									icon={<IconChartBar size={20} />}
									isPnl
								/>
							</div>

							{/* Claimable alerts banner */}
							{claimableAlerts.length > 0 && (
								<div className="rounded border border-blue-700 bg-blue-950 p-3">
									<p className="mb-1 text-sm font-semibold text-blue-400">
										Unclaimed Payouts ({claimableAlerts.length})
									</p>
									{claimableAlerts.map((a: PortfolioAlert) => (
										<p
											key={a.tradeId ?? a.slug}
											className="text-xs text-blue-300"
										>
											{a.message}
										</p>
									))}
								</div>
							)}

							{/* Open positions (tracked) */}
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
													<th className="text-right px-3 py-3">Edge %</th>
													<th className="text-right px-4 py-3">P&L</th>
												</tr>
											</thead>
											<tbody>
												{openPositions.map((p: PortfolioPosition, i) => (
													<tr
														key={`${p.slug}-${p.outcome}`}
														className={
															i < openPositions.length - 1
																? "border-b border-border/50"
																: ""
														}
													>
														<td className="px-4 py-3 max-w-[260px]">
															<a
																href={`https://polymarket.com/event/${p.slug}`}
																target="_blank"
																rel="noopener noreferrer"
																className="text-foreground hover:text-[var(--accent-orange)] transition-colors font-medium flex items-center gap-1"
															>
																<span className="truncate">{p.title}</span>
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
															{p.onChain.shares.toFixed(1)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															${p.onChain.avgPrice.toFixed(2)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															${p.onChain.currentPrice.toFixed(2)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.onChain.initialValue)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.onChain.currentValue)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
															{p.pipeline?.edgePct != null
																? `${(p.pipeline.edgePct * 100).toFixed(1)}%`
																: "—"}
														</td>
														<td className="text-right px-4 py-3 tabular-nums">
															<PnlBadge value={p.onChain.unrealizedPnl} />
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</section>

							{/* Manual positions */}
							{manualPositions.length > 0 && (
								<section>
									<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
										Manual Positions
										<span className="ml-2 text-muted-foreground font-normal normal-case">
											({manualPositions.length})
										</span>
									</h3>
									<div className="bg-white border border-border rounded-xl overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
													<th className="text-left px-4 py-3">Market</th>
													<th className="text-left px-3 py-3">Outcome</th>
													<th className="text-right px-3 py-3">Shares</th>
													<th className="text-right px-3 py-3">Avg Price</th>
													<th className="text-right px-3 py-3">Current</th>
													<th className="text-right px-3 py-3">Value</th>
													<th className="text-right px-4 py-3">P&L</th>
												</tr>
											</thead>
											<tbody>
												{manualPositions.map(
													(p: PortfolioPosition, i) => (
														<tr
															key={`${p.slug}-${p.outcome}`}
															className={
																i < manualPositions.length - 1
																	? "border-b border-border/50"
																	: ""
															}
														>
															<td className="px-4 py-3 max-w-[260px]">
																<a
																	href={`https://polymarket.com/event/${p.slug}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-foreground hover:text-[var(--accent-orange)] transition-colors font-medium flex items-center gap-1"
																>
																	<span className="truncate">{p.title}</span>
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
																{p.onChain.shares.toFixed(1)}
															</td>
															<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
																${p.onChain.avgPrice.toFixed(2)}
															</td>
															<td className="text-right px-3 py-3 tabular-nums text-muted-foreground">
																${p.onChain.currentPrice.toFixed(2)}
															</td>
															<td className="text-right px-3 py-3 tabular-nums">
																{formatUsd(p.onChain.currentValue)}
															</td>
															<td className="text-right px-4 py-3 tabular-nums">
																<PnlBadge value={p.onChain.unrealizedPnl} />
															</td>
														</tr>
													),
												)}
											</tbody>
										</table>
									</div>
								</section>
							)}

							{/* Legacy / resolved positions */}
							{(resolvedPositions.length > 0 ||
								legacyPositions.length > 0) && (
								<section>
									<h3 className="text-sm font-bold text-foreground tracking-wide mb-3 uppercase">
										Resolved / Legacy
										<span className="ml-2 text-muted-foreground font-normal normal-case">
											(
											{
												new Set([
													...resolvedPositions.map((p) => p.slug),
													...legacyPositions.map((p) => p.slug),
												]).size
											}
											)
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
													<th className="text-right px-3 py-3">Value</th>
													<th className="text-right px-3 py-3">P&L</th>
													<th className="text-right px-4 py-3">Status</th>
												</tr>
											</thead>
											<tbody>
												{[
													...new Map(
														[...resolvedPositions, ...legacyPositions].map(
															(p) => [p.slug + "|" + p.outcome, p],
														),
													).values(),
												].map((p: PortfolioPosition, i, arr) => (
													<tr
														key={`${p.slug}-${p.outcome}`}
														className={
															i < arr.length - 1
																? "border-b border-border/50"
																: ""
														}
													>
														<td className="px-4 py-3 max-w-[260px] text-muted-foreground">
															<span className="truncate block">{p.title}</span>
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
															{p.onChain.shares.toFixed(1)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.onChain.initialValue)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															{formatUsd(p.onChain.currentValue)}
														</td>
														<td className="text-right px-3 py-3 tabular-nums">
															<PnlBadge value={p.onChain.unrealizedPnl} />
														</td>
														<td className="text-right px-4 py-3">
															{p.onChain.redeemable ? (
																<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-blue-100 text-blue-700">
																	Claim
																</span>
															) : p.onChain.resolved ? (
																<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-slate-100 text-slate-600">
																	Resolved
																</span>
															) : (
																<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-gray-100 text-gray-500">
																	Legacy
																</span>
															)}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</section>
							)}
						</>
					)}
				</div>
			</main>
		</div>
	);
}
