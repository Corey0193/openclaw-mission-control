import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
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

function timeAgo(dateStr: string | undefined): string {
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

export default function WalletsPage() {
        const wallets = useQuery(api.wallets.list, {
                tenantId: DEFAULT_TENANT_ID,
        });

        const [searchQuery, setSearchQuery] = useState("");
        const [showOnlyInsiders, setShowOnlyInsiders] = useState(false);
        const [minPnl, setMinPnl] = useState<number | "">("");

        const filteredWallets = useMemo(() => {
                if (!wallets) return [];
                return wallets.filter((w) => {
                        const matchesSearch =
                                w.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (w.username?.toLowerCase() || "").includes(searchQuery.toLowerCase());
                        const matchesInsider = !showOnlyInsiders || w.isInsider;
                        const matchesPnl = minPnl === "" || w.totalPnl >= minPnl;
                        return matchesSearch && matchesInsider && matchesPnl;
                });
        }, [wallets, searchQuery, showOnlyInsiders, minPnl]);

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

                                                {/* Filters */}
                                                <div className="flex flex-wrap items-center gap-3">
                                                        <div className="relative">
                                                                <IconSearch
                                                                        size={16}
                                                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                                />
                                                                <input
                                                                        type="text"
                                                                        placeholder="Search address or username..."
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
                                                                Insiders Only
                                                        </button>

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
                                                </div>
                                        </div>

                                        {/* Wallets Table */}
                                        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                                                <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                                <thead>
                                                                        <tr className="bg-muted/30 border-b border-border text-[11px] font-bold text-muted-foreground tracking-widest uppercase">
                                                                                <th className="text-left px-6 py-4">Wallet / User</th>
                                                                                <th className="text-left px-6 py-4">Status</th>
                                                                                <th className="text-right px-6 py-4">P&L</th>
                                                                                <th className="text-right px-6 py-4">Win Rate</th>
                                                                                <th className="text-right px-6 py-4">Trades</th>
                                                                                <th className="text-right px-6 py-4">Age</th>
                                                                                <th className="text-left px-6 py-4">Tags</th>
                                                                        </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-border/50">
                                                                        {!wallets ? (
                                                                                [...Array(5)].map((_, i) => (
                                                                                        <tr key={i} className="animate-pulse">
                                                                                              <td colSpan={7} className="px-6 py-8">
                                                                                              <div className="h-4 bg-muted rounded w-3/4" />
                                                                                              </td>
                                                                                        </tr>
                                                                                ))
                                                                        ) : filteredWallets.length === 0 ? (
                                                                                <tr>
                                                                                        <td
                                                                                              colSpan={7}
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
                                                                                filteredWallets.map((w) => (
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
                                                                                              <td className="px-6 py-4">
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
                                                                                              <td className="px-6 py-4 text-right">
                                                                                              <PnlBadge value={w.totalPnl} />
                                                                                              </td>
                                                                                              <td className="px-6 py-4 text-right">
                                                                                              <span className={`font-bold ${w.winRate && w.winRate >= 0.6 ? 'text-emerald-600' : 'text-foreground'}`}>
                                                                                              {w.winRate ? (w.winRate * 100).toFixed(0) + "%" : "N/A"}
                                                                                              </span>
                                                                                              </td>
                                                                                              <td className="px-6 py-4 text-right">
                                                                                              <span className="font-bold">{w.tradeCount || 0}</span>
                                                                                              </td>
                                                                                              <td className="px-6 py-4 text-right text-muted-foreground font-medium">
                                                                                              {timeAgo(w.firstTradeAt)}
                                                                                              </td>
                                                                                              <td className="px-6 py-4">
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
                                                        <div className="bg-muted/20 px-6 py-3 border-t border-border flex items-center justify-between">
                                                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                        Showing {filteredWallets.length} of {wallets.length} wallets
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                        <IconTrophy size={16} className="text-amber-500" />
                                                                        <span className="text-[11px] font-black text-foreground uppercase italic">
                                                                                Alpha Intelligence v2.1
                                                                        </span>
                                                                </div>
                                                        </div>
                                                )}
                                        </div>
                                </div>
                        </main>
                </div>
        );
}
