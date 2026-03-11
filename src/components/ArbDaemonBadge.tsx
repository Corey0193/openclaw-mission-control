import React, { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";

const STALE_MS = 120_000; // 2 min — heartbeat older than this → STALE

type Variant = "loading" | "unknown" | "offline" | "paper" | "live" | "multiple" | "stale";

interface Style {
	bg: string;
	text: string;
	dot: string;
	pulse?: boolean;
}

const STYLES: Record<Variant, Style> = {
	loading:  { bg: "bg-muted",         text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
	unknown:  { bg: "bg-muted",         text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
	offline:  { bg: "bg-muted",         text: "text-[#495057]",        dot: "bg-[#868e96]" },
	paper:    { bg: "bg-[#e6fcf5]",     text: "text-[#0ca678]",        dot: "bg-[#0ca678]" },
	live:     { bg: "bg-[#fff5f5]",     text: "text-[#e03131]",        dot: "bg-[#e03131]",  pulse: true },
	multiple: { bg: "bg-[#fff9db]",     text: "text-[#e67700]",        dot: "bg-[#e67700]",  pulse: true },
	stale:    { bg: "bg-[#fff4e6]",     text: "text-[#e67700]",        dot: "bg-[#adb5bd]" },
};

type StatusData = {
	running: boolean;
	mode: string;
	processCount: number;
	pid?: number;
	startedAt?: number;
	lastHeartbeatAt: number;
	event: string;
};

function resolveVariant(status: StatusData | null | undefined, now: number): Variant {
	if (status === undefined) return "loading";
	if (status === null) return "unknown";
	if (status.running && now - status.lastHeartbeatAt > STALE_MS) return "stale";
	if (!status.running) return "offline";
	if (status.processCount > 1) return "multiple";
	if (status.mode === "live") return "live";
	return "paper";
}

function resolveLabel(variant: Variant, status: StatusData | null | undefined): string {
	switch (variant) {
		case "loading":  return "ARB ...";
		case "unknown":  return "ARB";
		case "offline":  return "ARB OFF";
		case "paper":    return "ARB — PAPER";
		case "live":     return "ARB — LIVE ⚠";
		case "multiple": return `ARB ×${status?.processCount ?? "?"}`;
		case "stale":    return "ARB STALE";
	}
}

const ArbDaemonBadge: React.FC = () => {
	const status = useQuery(api.arbDaemon.getDaemonStatus, {
		tenantId: DEFAULT_TENANT_ID,
	});
	const [now, setNow] = useState(Date.now());

	// Re-evaluate staleness every 30s without waiting for a Convex update
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(id);
	}, []);

	const variant = resolveVariant(status, now);
	const style = STYLES[variant];
	const label = resolveLabel(variant, status);

	const tooltip =
		status != null
			? `Mode: ${status.mode} | Processes: ${status.processCount}${status.pid ? ` | PID: ${status.pid}` : ""} | Last seen: ${new Date(status.lastHeartbeatAt).toLocaleTimeString()}`
			: "No daemon status received yet";

	return (
		<div
			title={tooltip}
			className={`hidden md:flex items-center gap-1.5 ${style.bg} ${style.text} px-3 py-1.5 rounded-full text-[11px] font-bold tracking-[0.5px] select-none cursor-default transition-colors`}
		>
			<span
				className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot} ${style.pulse ? "animate-pulse" : ""}`}
			/>
			{label}
		</div>
	);
};

export default ArbDaemonBadge;
