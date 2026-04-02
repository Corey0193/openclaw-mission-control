import React, { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";

const STALE_MS = 120_000; // 2 min

type Variant = "loading" | "unknown" | "offline" | "paper" | "stale";

interface Style {
	bg: string;
	text: string;
	dot: string;
	pulse?: boolean;
}

const STYLES: Record<Variant, Style> = {
	loading: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
	unknown: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
	offline: { bg: "bg-muted", text: "text-[#495057]", dot: "bg-[#868e96]" },
	paper: { bg: "bg-[#f3f0ff]", text: "text-[#7048e8]", dot: "bg-[#7048e8]", pulse: true },
	stale: { bg: "bg-[#fff4e6]", text: "text-[#e67700]", dot: "bg-[#adb5bd]" },
};

type StatusData = {
	running: boolean;
	pid?: number;
	mode: string;
	bankroll: number;
	openPositions: number;
	totalPaperPnl: number;
	status: string;
	lastHeartbeatAt: number;
};

function resolveVariant(status: StatusData | null | undefined, now: number): Variant {
	if (status === undefined) return "loading";
	if (status === null) return "unknown";
	if (!status.running) return "offline";
	if (now - status.lastHeartbeatAt > STALE_MS) return "stale";
	return "paper";
}

function resolveLabel(variant: Variant, status: StatusData | null | undefined): string {
	switch (variant) {
		case "loading": return "CT ...";
		case "unknown":  return "CT";
		case "offline":  return "CT OFF";
		case "stale":    return "CT STALE";
		case "paper": {
			const pnl = status?.totalPaperPnl ?? 0;
			const sign = pnl >= 0 ? "+" : "";
			return `CT ${sign}$${Math.round(pnl)}`;
		}
	}
}

const CopyTradeBadge: React.FC = () => {
	const status = useQuery(api.copyTrade.getStatus, { tenantId: DEFAULT_TENANT_ID });
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(id);
	}, []);

	const variant = resolveVariant(status, now);
	const style = STYLES[variant];
	const label = resolveLabel(variant, status);

	const tooltip =
		status != null
			? `Mode: ${status.mode} | Bankroll: $${status.bankroll.toFixed(2)} | Open: ${status.openPositions} | PnL: ${status.totalPaperPnl >= 0 ? "+" : ""}$${status.totalPaperPnl.toFixed(2)}${status.pid ? ` | PID: ${status.pid}` : ""} | Last seen: ${new Date(status.lastHeartbeatAt).toLocaleTimeString()}`
			: "No copy-trade daemon status yet";

	return (
		<div
			title={tooltip}
			className={`hidden md:flex items-center gap-1.5 ${style.bg} ${style.text} px-3 py-1.5 rounded-full text-xs md:text-sm font-bold tracking-[0.5px] select-none cursor-default transition-colors`}
		>
			<span
				className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot} ${style.pulse ? "animate-pulse" : ""}`}
			/>
			{label}
		</div>
	);
};

export default CopyTradeBadge;
