import React, { useEffect, useState } from "react";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { useConvexHttpQuery } from "../lib/useConvexHttpQuery";

const STALE_MS = 120_000;

type Variant = "loading" | "unknown" | "offline" | "paper" | "stale";

type StatusData = {
	running: boolean;
	pid?: number;
	mode: string;
	bankroll: number;
	openPositions: number;
	totalPaperPnl: number;
	activeLeaderCount?: number;
	monitoredLeaderCount?: number;
	skipReasons?: Array<{ reason: string; count: number }>;
	status: string;
	lastHeartbeatAt: number;
};

const STYLES: Record<
	Variant,
	{ bg: string; text: string; dot: string; pulse?: boolean }
> = {
	loading: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
	unknown: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
	offline: { bg: "bg-muted", text: "text-[#495057]", dot: "bg-[#868e96]" },
	paper: {
		bg: "bg-[#e6fcf5]",
		text: "text-[#0ca678]",
		dot: "bg-[#0ca678]",
		pulse: true,
	},
	stale: { bg: "bg-[#fff4e6]", text: "text-[#e67700]", dot: "bg-[#adb5bd]" },
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
		case "loading":
			return "CT2 ...";
		case "unknown":
			return "CT2";
		case "offline":
			return "CT2 OFF";
		case "stale":
			return "CT2 STALE";
		case "paper": {
			const pnl = status?.totalPaperPnl ?? 0;
			const sign = pnl >= 0 ? "+" : "";
			return `CT2 ${sign}$${Math.round(pnl)}`;
		}
	}
}

const CopyTradeV2Badge: React.FC = () => {
	const status = useConvexHttpQuery<StatusData>(
		"copyTradeV2:getStatus",
		{ tenantId: DEFAULT_TENANT_ID },
		{ pollMs: 15_000 },
	);
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(id);
	}, []);

	const variant = resolveVariant(status, now);
	const style = STYLES[variant];
	const label = resolveLabel(variant, status);

	return (
		<div
			title={
				status != null
					? `Mode: ${status.mode} | Bankroll: $${status.bankroll.toFixed(2)} | Open: ${status.openPositions} | Active leaders: ${status.activeLeaderCount ?? "?"} | PnL: ${status.totalPaperPnl >= 0 ? "+" : ""}$${status.totalPaperPnl.toFixed(2)} | Last seen: ${new Date(status.lastHeartbeatAt).toLocaleTimeString()}`
					: "No Copy V2 daemon status yet"
			}
			className={`hidden md:flex items-center gap-1.5 ${style.bg} ${style.text} px-3 py-1.5 rounded-full text-xs md:text-sm font-bold tracking-[0.5px] select-none cursor-default transition-colors`}
		>
			<span
				className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot} ${style.pulse ? "animate-pulse" : ""}`}
			/>
			{label}
		</div>
	);
};

export default CopyTradeV2Badge;
