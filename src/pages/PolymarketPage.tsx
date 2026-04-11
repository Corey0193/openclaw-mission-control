import { useEffect, useMemo, useState } from "react";
import { usePortfolio } from "../lib/usePortfolio";
import type { PortfolioPosition, PortfolioAlert } from "../types/portfolio";
import type { WalletSnapshot } from "../types/portfolio";
import Header from "../components/Header";
import { WalletSummary } from "../components/WalletSummary";
import { SummaryCard } from "../components/SummaryCard";
import { PnlBadge } from "../components/PnlBadge";
import { formatUsd, timeAgo } from "../lib/formatters";
import {
	IconChartBar,
	IconExternalLink,
	IconRefresh,
	IconTrendingUp,
	IconCoin,
} from "@tabler/icons-react";

export default function PolymarketPage() {
	const { data: portfolio, loading, refresh } = usePortfolio();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [walletSnapshot, setWalletSnapshot] = useState<WalletSnapshot | null>(null);
	const [statusFilter, setStatusFilter] = useState<"all" | "soft-arb" | "manual" | "resolved">("all");

	// Fetch wallet data from soft-arb API (same source as SoftArbPage)
	useEffect(() => {
		let cancelled = false;
		async function fetchWallet() {
			try {
				const res = await fetch("/api/soft-arb/trades");
				if (!res.ok) return;
				const json = await res.json();
				if (!cancelled && json?.wallet) {
					setWalletSnapshot({
						total_wallet_value_usd: Number(json.wallet.total_wallet_value_usd ?? 0),
						deployable_bankroll_usd: Number(json.wallet.deployable_bankroll_usd ?? 0),
						magic_usdc: Number(json.wallet.magic_usdc ?? 0),
						phantom_usdc: Number(json.wallet.phantom_usdc ?? 0),
						phantom_pol: Number(json.wallet.phantom_pol ?? 0),
						phantom_pol_usd_value: Number(json.wallet.phantom_pol_usd_value ?? 0),
						updated_at: json.wallet.updated_at,
					});
				}
			} catch { /* wallet is optional enhancement */ }
		}
		fetchWallet();
		const interval = setInterval(fetchWallet, 30_000);
		return () => { cancelled = true; clearInterval(interval); };
	}, []);

	const handleRefresh = () => {
		if (isRefreshing) return;
		setIsRefreshing(true);
		void refresh().finally(() => {
			setTimeout(() => setIsRefreshing(false), 1500);
		});
	};

	const highAlerts = useMemo(
		() => (portfolio?.alerts ?? []).filter((a) => a.type === "orphaned_trade"),
		[portfolio],
	);

	const claimableAlerts = useMemo(
		() =>
			(portfolio?.alerts ?? []).filter((a) => a.type === "unclaimed_payout"),
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

	const positionsValue = useMemo(
		() =>
			Math.round(
				(portfolio?.positions ?? [])
					.filter((p) => !p.onChain.resolved && p.onChain.shares > 0)
					.reduce((sum, p) => sum + p.onChain.currentValue, 0) * 100,
			) / 100,
		[portfolio],
	);

	const allPositions = useMemo(() => {
		const positions = portfolio?.positions ?? [];
		if (statusFilter === "all") return positions;
		if (statusFilter === "soft-arb")
			return positions.filter((p) => p.category === "tracked");
		if (statusFilter === "manual")
			return positions.filter((p) => p.category === "manual");
		if (statusFilter === "resolved")
			return positions.filter(
				(p) => p.onChain.resolved || p.onChain.redeemable || p.category === "legacy",
			);
		return positions;
	}, [portfolio, statusFilter]);

	const isLoaded = !loading && portfolio !== null;

	return (
		<div className="h-screen overflow-y-auto bg-[#f8f9fa] text-slate-800">
			<Header />

			<main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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
					<div className="grid grid-cols-3 gap-3">
						{[...Array(3)].map((_, i) => (
							<div
								key={i}
								className="h-20 bg-white border border-border rounded-xl animate-pulse"
							/>
						))}
					</div>
				) : (
					<>
						{/* Wallet header */}
						<WalletSummary
							wallet={walletSnapshot}
							positionsValue={positionsValue}
							crossLink={{ to: "/arb/soft", label: "Strategy dashboard" }}
						/>

						{/* Portfolio summary cards */}
						<div className="grid grid-cols-3 gap-3">
							<SummaryCard
								label="Invested"
								value={totalInvested}
								icon={<IconCoin size={18} />}
								isCurrency
							/>
							<SummaryCard
								label="Current Value"
								value={totalCurrentValue}
								icon={<IconTrendingUp size={18} />}
								isCurrency
							/>
							<SummaryCard
								label="Total P&L"
								value={totalPnl}
								icon={<IconChartBar size={18} />}
								isPnl
							/>
						</div>

						{/* Alert banners */}
						{highAlerts.length > 0 && (
							<div className="rounded-xl border border-red-200 bg-red-50 p-3">
								<p className="mb-1 text-sm font-semibold text-red-700">
									Pipeline Tracking Errors ({highAlerts.length})
								</p>
								{highAlerts.map((a: PortfolioAlert) => (
									<p key={a.tradeId ?? a.slug} className="text-xs text-red-600">
										{a.message}
									</p>
								))}
							</div>
						)}

						{claimableAlerts.length > 0 && (
							<div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
								<p className="mb-1 text-sm font-semibold text-blue-700">
									Unclaimed Payouts ({claimableAlerts.length})
								</p>
								{claimableAlerts.map((a: PortfolioAlert) => (
									<p
										key={a.tradeId ?? a.slug}
										className="text-xs text-blue-600"
									>
										{a.message}
									</p>
								))}
							</div>
						)}

						{/* Filter row */}
						<div className="flex items-center gap-2">
							{(["all", "soft-arb", "manual", "resolved"] as const).map(
								(filter) => (
									<button
										key={filter}
										onClick={() => setStatusFilter(filter)}
										className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${
											statusFilter === filter
												? "bg-foreground text-white"
												: "bg-white border border-border text-muted-foreground hover:bg-muted/50"
										}`}
									>
										{filter === "soft-arb" ? "Soft Arb" : filter === "all" ? "All" : filter === "manual" ? "Manual" : "Resolved"}
										{filter === "all" && (
											<span className="ml-1 opacity-60">
												({(portfolio?.positions ?? []).length})
											</span>
										)}
									</button>
								),
							)}
						</div>

						{/* Unified positions table */}
						<section>
							{allPositions.length === 0 ? (
								<div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
									No positions
									{statusFilter !== "all" && " matching this filter"}
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
												<th className="text-right px-3 py-3">Value</th>
												<th className="text-right px-3 py-3">P&L</th>
												<th className="text-right px-4 py-3">Status</th>
											</tr>
										</thead>
										<tbody>
											{allPositions.map((p: PortfolioPosition, i) => (
												<tr
													key={`${p.slug}-${p.outcome}`}
													className={
														i < allPositions.length - 1
															? "border-b border-border/50 hover:bg-muted/5"
															: "hover:bg-muted/5"
													}
												>
													<td className="px-4 py-3 max-w-[260px]">
														<a
															href={`https://polymarket.com/event/${p.onChain.eventSlug || p.slug}`}
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
													<td className="text-right px-3 py-3 tabular-nums">
														<PnlBadge value={p.onChain.unrealizedPnl} />
													</td>
													<td className="text-right px-4 py-3">
														{p.onChain.redeemable ? (
															<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-emerald-100 text-emerald-700">
																Claimable
															</span>
														) : p.onChain.resolved ? (
															<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-slate-100 text-slate-600">
																Resolved
															</span>
														) : p.category === "tracked" ? (
															<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-blue-100 text-blue-700">
																Soft Arb
															</span>
														) : p.category === "manual" ? (
															<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-gray-100 text-gray-600">
																Manual
															</span>
														) : (
															<span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-gray-50 text-gray-400">
																Legacy
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
					</>
				)}
			</main>
		</div>
	);
}
