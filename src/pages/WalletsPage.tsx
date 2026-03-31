import { useState, useMemo } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import Header from "../components/Header";
import {
        IconWallet,
        IconExternalLink,
        IconSearch,
        IconFilter,
        IconTrendingUp,
        IconTrendingDown,
        IconAlertTriangle,
        IconUserCheck,
        IconTrophy,
        IconSelector,
        IconSortAscending,
        IconSortDescending,
        IconTag,
        IconTarget,
        IconChevronDown,
        IconLoader2,
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

function CtsBadge({ score }: { score: number | undefined | null }) {
	if (score === undefined || score === null) return <span className="text-muted-foreground text-xs">N/A</span>;
	const color = score >= 70 ? "text-emerald-700" : score >= 40 ? "text-amber-700" : "text-red-600";
	const bg = score >= 70 ? "bg-emerald-50 border-emerald-200" : score >= 40 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
	return (
		<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border ${bg} ${color} text-xs font-black`}>
			{score}
		</span>
	);
}

function timeAgo(dateStr: string | undefined | null): string {
	if (!dateStr) return "N/A";
	try {
		const ts = new Date(dateStr).getTime();
		const diffMs = Date.now() - ts;
		const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		if (days < 1) return "today";
		if (days < 30) return `${days}d ago`;
		const months = Math.floor(days / 30);
		if (months < 12) return `${months}mo ago`;
		return `${Math.floor(months / 12)}y ago`;
	} catch (e) {
		return "N/A";
	}
}

type SortKey = "address" | "isInsider" | "totalPnl" | "copyTradingScore" | "computedWinRate" | "pnl7d" | "pnl30d" | "tradeCount" | "firstTradeAt" | "tags";
type SortDirection = "asc" | "desc" | null;

export default function WalletsPage() {
        const { results: paginatedWallets, status, loadMore } = usePaginatedQuery(
                api.wallets.paginatedList,
                { tenantId: DEFAULT_TENANT_ID },
                { initialNumItems: 200 }
        );

        const insiderWallets = useQuery(api.wallets.listInsiders, { tenantId: DEFAULT_TENANT_ID });

        const [searchQuery, setSearchQuery] = useState("");	const [showOnlyInsiders, setShowOnlyInsiders] = useState(false);

        // When showing insiders, use the dedicated insider query.
        // Otherwise use paginated results, but merge any insiders to the top.
        const wallets = useMemo(() => {
                if (showOnlyInsiders) {
                        return insiderWallets ?? [];
                }
                const paginated = paginatedWallets ?? [];
                const insiders = insiderWallets ?? [];
                // Merge insiders at the top, deduplicating by address
                const paginatedAddrs = new Set(paginated.map((w) => w.address));
                const extraInsiders = insiders.filter((w) => !paginatedAddrs.has(w.address));
                return [...extraInsiders, ...paginated];
        }, [showOnlyInsiders, paginatedWallets, insiderWallets]);
	const [minPnl, setMinPnl] = useState<number | "">("");
	const [minCts, setMinCts] = useState<number | "">("");
	const [tagFilter, setTagFilter] = useState("");

	const [sortKey, setSortKey] = useState<SortKey>("copyTradingScore");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	const allTags = useMemo(() => {
		if (!wallets) return [];
		const tags = new Set<string>();
		wallets.forEach(w => w.tags.forEach(t => tags.add(t)));
		return Array.from(tags).sort();
	}, [wallets]);

	const handleSort = (key: SortKey) => {
		if (sortKey === key) {
			if (sortDirection === "desc") setSortDirection("asc");
			else if (sortDirection === "asc") {
				setSortKey("copyTradingScore");
				setSortDirection("desc");
			}
		} else {
			setSortKey(key);
			setSortDirection("desc");
		}
	};

	const filteredAndSortedWallets = useMemo(() => {
		if (!wallets) return [];
		
		// 1. Filter
		let result = wallets.filter((w) => {
			const matchesSearch =
				w.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(w.username?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
				w.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
			
			const matchesInsider = !showOnlyInsiders || w.isInsider;
			const matchesPnl = minPnl === "" || w.totalPnl >= minPnl;
			const matchesCts = minCts === "" || (w.copyTradingScore ?? 0) >= minCts;
			const matchesTag = !tagFilter || w.tags.includes(tagFilter);

			return matchesSearch && matchesInsider && matchesPnl && matchesCts && matchesTag;
		});

		// 2. Sort
		if (sortKey && sortDirection) {
			result.sort((a, b) => {
				let valA: any = a[sortKey as keyof typeof a];
				let valB: any = b[sortKey as keyof typeof b];

				// Special handling for some keys
				if (sortKey === "firstTradeAt") {
					valA = valA ? new Date(valA).getTime() : 0;
					valB = valB ? new Date(valB).getTime() : 0;
				} else if (sortKey === "tags") {
					valA = a.tags.length;
					valB = b.tags.length;
				} else if (sortKey === "isInsider") {
					valA = a.isInsider ? 1 : 0;
					valB = b.isInsider ? 1 : 0;
				}

				if (valA === valB) return 0;
				if (valA === null || valA === undefined) return 1;
				if (valB === null || valB === undefined) return -1;

				const multiplier = sortDirection === "asc" ? 1 : -1;
				return valA < valB ? -1 * multiplier : 1 * multiplier;
			});
		}

		return result;
	}, [wallets, searchQuery, showOnlyInsiders, minPnl, minCts, tagFilter, sortKey, sortDirection]);

	const SortIcon = ({ k }: { k: SortKey }) => {
		if (sortKey !== k) return <IconSelector size={14} className="opacity-30 group-hover:opacity-100" />;
		if (sortDirection === "asc") return <IconSortAscending size={14} className="text-[var(--accent-orange)]" />;
		return <IconSortDescending size={14} className="text-[var(--accent-orange)]" />;
	};

	return (
		<div className="org-page bg-[#f8f9fa]">
			<Header />
			<main className="[grid-area:content] overflow-auto">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
					{/* Page Header */}
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent-orange)] text-white shadow-sm">
								<IconWallet size={22} />
							</div>
							<div>
								<h2 className="text-xl font-bold text-foreground tracking-tight">
									Polymarket Wallets
								</h2>
								<p className="text-[12px] text-muted-foreground font-medium">
									Tracking {wallets?.length ?? 0} wallets for Radar & Copy
								</p>
							</div>
						</div>

						{/* Filters Row */}
						<div className="flex flex-wrap items-center gap-3">
							<div className="relative">
								<IconSearch
									size={16}
									className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
								/>
								<input
								        type="text"
								        placeholder="Search address, username, or tag..."
								        value={searchQuery}
								        onChange={(e) => setSearchQuery(e.target.value)}
								        className="pl-9 pr-4 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]/20 w-full md:w-64 transition-all"
								/>

							</div>

							<button
								onClick={() => setShowOnlyInsiders(!showOnlyInsiders)}
								className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
									showOnlyInsiders
										? "bg-red-50 border-red-200 text-red-600 shadow-sm"
										: "bg-white border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/30"
								}`}
							>
								<IconAlertTriangle size={16} />
								Insiders
							</button>

							<div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-1.5 shadow-sm">
								<IconTag size={16} className="text-muted-foreground" />
								<select
									value={tagFilter}
									onChange={(e) => setTagFilter(e.target.value)}
									className="bg-transparent border-none text-xs font-bold focus:outline-none text-muted-foreground uppercase tracking-wider cursor-pointer"
								>
									<option value="">All Tags</option>
									{allTags.map(tag => (
										<option key={tag} value={tag}>{tag.toUpperCase()}</option>
									))}
								</select>
							</div>

							<div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-1.5 shadow-sm">
								<IconTrendingUp size={16} className="text-muted-foreground" />
								<span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
									Min P&L:
								</span>
								<input
									type="number"
									placeholder="0"
									value={minPnl}
									onChange={(e) =>
										setMinPnl(e.target.value === "" ? "" : Number(e.target.value))
									}
									className="w-20 bg-transparent border-none text-sm font-bold focus:outline-none"
								/>
							</div>

							<div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-1.5 shadow-sm">
								<IconTarget size={16} className="text-emerald-500" />
								<span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
									Min CTS:
								</span>
								<input
									type="number"
									placeholder="0"
									value={minCts}
									onChange={(e) =>
										setMinCts(e.target.value === "" ? "" : Number(e.target.value))
									}
									className="w-16 bg-transparent border-none text-sm font-bold focus:outline-none"
								/>
							</div>
						</div>
					</div>

					{/* Wallets Table */}
					<div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="bg-muted/30 border-b border-border text-[11px] font-bold text-muted-foreground tracking-widest uppercase select-none">
										<th className="text-left px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("address")}>
											<div className="flex items-center gap-1">Wallet / User <SortIcon k="address" /></div>
										</th>
										<th className="text-left px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("isInsider")}>
											<div className="flex items-center gap-1">Status <SortIcon k="isInsider" /></div>
										</th>
										<th className="text-right px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("copyTradingScore")}>
											<div className="flex items-center justify-end gap-1">CTS <SortIcon k="copyTradingScore" /></div>
										</th>
										<th className="text-right px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("totalPnl")}>
											<div className="flex items-center justify-end gap-1">P&L <SortIcon k="totalPnl" /></div>
										</th>
										<th className="text-right px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("pnl7d")}>
											<div className="flex items-center justify-end gap-1">7d P&L <SortIcon k="pnl7d" /></div>
										</th>
										<th className="text-right px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("pnl30d")}>
											<div className="flex items-center justify-end gap-1">30d P&L <SortIcon k="pnl30d" /></div>
										</th>
										<th className="text-right px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("computedWinRate")}>
											<div className="flex items-center justify-end gap-1">Win Rate <SortIcon k="computedWinRate" /></div>
										</th>
										<th className="text-right px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("tradeCount")}>
											<div className="flex items-center justify-end gap-1">Trades <SortIcon k="tradeCount" /></div>
										</th>
										<th className="text-right px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("firstTradeAt")}>
											<div className="flex items-center justify-end gap-1">Age <SortIcon k="firstTradeAt" /></div>
										</th>
										<th className="text-left px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => handleSort("tags")}>
											<div className="flex items-center gap-1">Tags <SortIcon k="tags" /></div>
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/50">
									{!wallets ? (
										[...Array(5)].map((_, i) => (
											<tr key={i} className="animate-pulse">
												<td colSpan={10} className="px-6 py-8">
													<div className="h-4 bg-muted rounded w-3/4" />
												</td>
											</tr>
										))
									) : filteredAndSortedWallets.length === 0 ? (
										<tr>
											<td
												colSpan={10}
												className="px-6 py-20 text-center text-muted-foreground"
											>
												<div className="flex flex-col items-center">
													<IconSearch size={40} className="mb-4 opacity-20" />
													<p className="font-semibold text-base">
														No wallets found
													</p>
													<p className="text-xs mt-1">
														Try adjusting your search or filters
													</p>
												</div>
											</td>
										</tr>
									) : (
										filteredAndSortedWallets.map((w) => (
											<tr
												key={w._id}
												className="hover:bg-muted/20 transition-colors group"
											>
												<td className="px-6 py-4">
													<a
														href={`https://polymarket.com/@${w.username || w.address}`}
														target="_blank"
														rel="noopener noreferrer"
														className="flex flex-col hover:opacity-70 transition-opacity"
													>
														<span className="font-bold text-foreground">
															{w.username === w.address
																? w.address.slice(0, 8) + "..."
																: w.username || "Anonymous"}
														</span>
														<code className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded w-fit mt-1 group-hover:bg-muted group-hover:text-foreground transition-colors">
															{w.address.slice(0, 6)}...{w.address.slice(-4)}
														</code>
													</a>
												</td>
												<td className="px-4 py-4">
													<div className="flex flex-wrap gap-2">
														{w.isInsider && (
															<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-tighter">
																<IconAlertTriangle size={10} />
																Insider
															</span>
														)}
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-tighter">
															<IconUserCheck size={10} />
															Tracked
														</span>
													</div>
												</td>
												<td className="px-4 py-4 text-right">
													<CtsBadge score={w.copyTradingScore} />
												</td>
												<td className="px-4 py-4 text-right">
													<PnlBadge value={w.totalPnl} />
												</td>
												<td className="px-4 py-4 text-right">
													<PnlBadge value={w.pnl7d ?? 0} />
												</td>
												<td className="px-4 py-4 text-right">
													<PnlBadge value={w.pnl30d ?? 0} />
												</td>
												<td className="px-4 py-4 text-right">
													{(() => {
														const wr = w.computedWinRate ?? w.winRate;
														if (wr === null || wr === undefined) return <span className="font-bold text-foreground">N/A</span>;
														return <span className={`font-bold ${wr >= 0.6 ? 'text-emerald-600' : 'text-foreground'}`}>{(wr * 100).toFixed(0)}%</span>;
													})()}
												</td>
												<td className="px-4 py-4 text-right">
													<span className="font-bold">{(w.tradeCount !== null && w.tradeCount !== undefined) ? w.tradeCount : "N/A"}</span>
												</td>
												<td className="px-4 py-4 text-right text-muted-foreground font-medium">
													{timeAgo(w.firstTradeAt)}
												</td>
												<td className="px-4 py-4">
													<div className="flex flex-wrap gap-1">
														{w.tags.map((tag) => (
															<span
																key={tag}
																className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-bold"
															>
																{tag}
															</span>
														))}
													</div>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
						{wallets && (
						        <div className="bg-muted/20 px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
						                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
						                        Loaded {wallets.length} wallets (filtered: {filteredAndSortedWallets.length})
						                </span>

						                {status === "CanLoadMore" && (
						                        <button
						                                onClick={() => loadMore(100)}
						                                className="flex items-center gap-2 px-6 py-2 bg-white border border-border rounded-xl text-sm font-bold hover:bg-muted/30 transition-all shadow-sm"
						                        >
						                                Load More Wallets
						                                <IconChevronDown size={16} />
						                        </button>
						                )}

						                {status === "LoadingMore" && (
						                        <div className="flex items-center gap-2 text-muted-foreground text-sm font-bold uppercase tracking-widest">
						                                <IconLoader2 size={16} className="animate-spin text-[var(--accent-orange)]" />
						                                Syncing...
						                        </div>
						                )}

						                <div className="flex items-center gap-2">
						                        <IconTrophy size={16} className="text-amber-500" />
						                        <span className="text-[11px] font-black text-foreground uppercase italic text-right">
						                                Alpha Intelligence v2.1
						                        </span>
						                </div>
						        </div>
						)}					</div>
				</div>
			</main>
		</div>
	);
}
