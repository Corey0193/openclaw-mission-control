import React, { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import SignOutButton from "./Signout";
import ArbDaemonBadge from "./ArbDaemonBadge";
import WalletIngestorBadge from "./WalletIngestorBadge";
import CopyTradeBadge from "./CopyTradeBadge";
import CopyTradeV2Badge from "./CopyTradeV2Badge";
import OllamaHealthBadge from "./OllamaHealthBadge";

import { IconChevronDown } from "@tabler/icons-react";

type HeaderProps = {
        onOpenAgents?: () => void;
        onOpenLiveFeed?: () => void;
        title?: string;
};

const Header: React.FC<HeaderProps> = ({ onOpenAgents, onOpenLiveFeed, title }) => {
	const [time, setTime] = useState(new Date());
	const [isArbDropdownOpen, setIsArbDropdownOpen] = useState(false);
	const arbDropdownRef = useRef<HTMLDivElement>(null);
	const location = useLocation();

	useEffect(() => {
		const timer = setInterval(() => setTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	// Handle clicking outside of dropdown to close it
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				arbDropdownRef.current &&
				!arbDropdownRef.current.contains(event.target as Node)
			) {
				setIsArbDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString("en-US", {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	};

	const formatDate = (date: Date) => {
		return date
			.toLocaleDateString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
			})
			.toUpperCase();
	};

	const isArbActive =
		location.pathname.startsWith("/arb") ||
		location.pathname.startsWith("/copy-trade");

	return (
		<header className="[grid-area:header] flex items-center justify-between px-3 md:px-6 py-2 bg-white border-b border-border z-10 shadow-sm">
			<div className="flex items-center gap-2 md:gap-4 min-w-0">
				{title && (
					<div className="hidden lg:flex items-center mr-2">
						<span className="text-sm font-bold text-foreground whitespace-nowrap">{title}</span>
						<div className="mx-3 h-4 w-[1px] bg-border" />
					</div>
				)}
				<div className="flex md:hidden items-center gap-2">
					{onOpenAgents && (
						<button
							type="button"
							className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted hover:bg-accent transition-colors"
							onClick={onOpenAgents}
							aria-label="Open agents sidebar"
						>
							<span aria-hidden="true">&#9776;</span>
						</button>
					)}
				</div>
				<nav className="hidden sm:flex items-center gap-1 md:gap-2">
					<Link
						to="/"
						className={`
							text-[12px] font-semibold tracking-wide px-3.5 py-1.5 rounded-full transition-all
							${location.pathname === "/" ? "bg-[var(--accent-orange)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"}
						`}
					>
						Dashboard
					</Link>
					<Link
						to="/org"
						className={`
							text-[12px] font-semibold tracking-wide px-3.5 py-1.5 rounded-full transition-all
							${location.pathname === "/org" ? "bg-[var(--accent-orange)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"}
						`}
					>
						Org Chart
					</Link>
					<Link
						to="/todos"
						className={`
							text-[12px] font-semibold tracking-wide px-3.5 py-1.5 rounded-full transition-all
							${location.pathname === "/todos" ? "bg-[var(--accent-orange)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"}
						`}
					>
						To-Dos
					</Link>
					<Link
						to="/token-usage"
						className={`
							text-[12px] font-semibold tracking-wide px-3.5 py-1.5 rounded-full transition-all
							${location.pathname === "/token-usage" ? "bg-[var(--accent-orange)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"}
						`}
					>
						Token Usage
					</Link>
					{/* Arbitrage Dropdown */}
					<div className="relative" ref={arbDropdownRef}>
						<button
							type="button"
							onClick={() => setIsArbDropdownOpen(!isArbDropdownOpen)}
							className={`
								flex items-center gap-1 text-[12px] font-semibold tracking-wide px-3.5 py-1.5 rounded-full transition-all
								${isArbActive ? "bg-[var(--accent-orange)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"}
							`}
						>
							Arbitrage
							<IconChevronDown
								size={14}
								className={`transition-transform duration-200 ${isArbDropdownOpen ? "rotate-180" : ""}`}
							/>
						</button>

						{isArbDropdownOpen && (
							<div className="absolute left-0 mt-2 w-48 bg-white border border-border rounded-xl shadow-xl py-2 z-20">
								<Link
									to="/arb/pipeline"
									onClick={() => setIsArbDropdownOpen(false)}
									className={`
										block px-4 py-2 text-[12px] font-semibold hover:bg-muted transition-colors
										${location.pathname === "/arb/pipeline" ? "text-[var(--accent-orange)]" : "text-muted-foreground"}
									`}
								>
									Arb Pipeline
								</Link>
								<Link
									to="/arb/polymarket"
									onClick={() => setIsArbDropdownOpen(false)}
									className={`
								                block px-4 py-2 text-[12px] font-semibold hover:bg-muted transition-colors
								                ${location.pathname === "/arb/polymarket" ? "text-[var(--accent-orange)]" : "text-muted-foreground"}
								        `}
								>
									Polymarket
								</Link>
								<Link
								        to="/arb/experiments"
								        onClick={() => setIsArbDropdownOpen(false)}
								        className={`
								                block px-4 py-2 text-[12px] font-semibold hover:bg-muted transition-colors
								                ${location.pathname === "/arb/experiments" ? "text-[var(--accent-orange)]" : "text-muted-foreground"}
								        `}
								>
								        Experiments
								</Link>{" "}
								<Link
									to="/arb/soft"
									onClick={() => setIsArbDropdownOpen(false)}
									className={`
										block px-4 py-2 text-[12px] font-semibold hover:bg-muted transition-colors
										${location.pathname === "/arb/soft" ? "text-[var(--accent-orange)]" : "text-muted-foreground"}
									`}
								>
									Soft Arb
								</Link>
								<Link
									to="/arb/hard"
									onClick={() => setIsArbDropdownOpen(false)}
									className={`
								                block px-4 py-2 text-[12px] font-semibold hover:bg-muted transition-colors
								                ${location.pathname === "/arb/hard" ? "text-[var(--accent-orange)]" : "text-muted-foreground"}
								        `}
								>
									Hard Arb
								</Link>
								<Link
									to="/arb/wallets"
									onClick={() => setIsArbDropdownOpen(false)}
									className={`
								                block px-4 py-2 text-[12px] font-semibold hover:bg-muted transition-colors
								                ${location.pathname === "/arb/wallets" ? "text-[var(--accent-orange)]" : "text-muted-foreground"}
								        `}
								>
									Wallets
								</Link>
								<Link
									to="/copy-trade"
									onClick={() => setIsArbDropdownOpen(false)}
									className={`
								                block px-4 py-2 text-[12px] font-semibold hover:bg-muted transition-colors
								                ${location.pathname.startsWith("/copy-trade") ? "text-[var(--accent-orange)]" : "text-muted-foreground"}
								        `}
								>
									Copy Trade
								</Link>
								<Link
									to="/copy-trade-v2"
									onClick={() => setIsArbDropdownOpen(false)}
									className={`
								                block px-4 py-2 text-[12px] font-semibold hover:bg-muted transition-colors
								                ${location.pathname === "/copy-trade-v2" ? "text-[var(--accent-orange)]" : "text-muted-foreground"}
								        `}
								>
									Copy V2
								</Link>
							</div>
						)}
					</div>
				</nav>
			</div>



			<div className="flex items-center gap-3 md:gap-5">
				{onOpenLiveFeed && (
					<button
						type="button"
						className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted hover:bg-accent transition-colors"
						onClick={onOpenLiveFeed}
						aria-label="Open live feed sidebar"
					>
						<span aria-hidden="true">&#9776;</span>
					</button>
				)}
				<div className="hidden sm:block text-right">
					<div className="text-[13px] leading-tight font-bold text-foreground tabular-nums tracking-tight">
						{formatTime(time)}
					</div>
					<div className="text-[9px] font-bold text-muted-foreground tracking-wider">
						{formatDate(time)}
					</div>
				</div>
				<ArbDaemonBadge />
				<WalletIngestorBadge />
				<OllamaHealthBadge />
				<CopyTradeBadge />{" "}
				<CopyTradeV2Badge />{" "}
				<div className="hidden sm:flex items-center gap-2 bg-[#e6fcf5] text-[#0ca678] px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider border border-[#b2f2bb]/40 shadow-sm">
					<span className="w-1.5 h-1.5 bg-[#0ca678] rounded-full animate-pulse" />
					ONLINE
				</div>
				<SignOutButton />
			</div>
		</header>
	);
};

export default Header;
