import { useEffect, useMemo, useState } from "react";
import { IconActivityHeartbeat } from "@tabler/icons-react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

type HealthStatus = "loading" | "healthy" | "degraded" | "down" | "unconfigured";

type OllamaHealthResponse = {
	ok: boolean;
	status: HealthStatus;
	checkedAt: number;
	latencyMs?: number;
	model?: string;
	text?: string;
	message?: string;
	body?: string;
	responseId?: string;
};

const POLL_MS = 60_000;
const STALE_MS = 150_000;

const STYLE_BY_STATUS: Record<
	HealthStatus,
	{ bg: string; text: string; dot: string; pulse?: boolean }
> = {
	loading: {
		bg: "bg-muted",
		text: "text-muted-foreground",
		dot: "bg-muted-foreground/40",
	},
	healthy: {
		bg: "bg-[#e6fcf5]",
		text: "text-[#0ca678]",
		dot: "bg-[#0ca678]",
		pulse: true,
	},
	degraded: {
		bg: "bg-[#fff9db]",
		text: "text-[#e67700]",
		dot: "bg-[#e67700]",
		pulse: true,
	},
	down: {
		bg: "bg-[#fff5f5]",
		text: "text-[#e03131]",
		dot: "bg-[#e03131]",
		pulse: true,
	},
	unconfigured: {
		bg: "bg-muted",
		text: "text-muted-foreground",
		dot: "bg-muted-foreground/40",
	},
};

const OllamaHealthBadge = () => {
	const [status, setStatus] = useState<OllamaHealthResponse | null>(null);
	const [lastPollAt, setLastPollAt] = useState<number | null>(null);
	const [now, setNow] = useState(0);
	const checkOllamaHealth = useAction(api.ollamaHealth.checkOllamaHealth);

	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		let cancelled = false;

		const poll = async () => {
			try {
				const payload = (await checkOllamaHealth()) as OllamaHealthResponse;
				if (!cancelled) {
					setStatus({
						...payload,
						status: payload.status ?? "down",
					});
					setLastPollAt(Date.now());
				}
			} catch {
				if (!cancelled) {
					setStatus((current) =>
						current ?? {
							ok: false,
							status: "down",
							checkedAt: Date.now(),
							message: "Health check unavailable",
						},
					);
					setLastPollAt(Date.now());
				}
			}
		};

		void poll();
		const intervalId = window.setInterval(() => {
			void poll();
		}, POLL_MS);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
		};
	}, [checkOllamaHealth]);

	const currentStatus: HealthStatus = useMemo(() => {
		if (!status) return "loading";
		if (status.status === "healthy" && lastPollAt && now - lastPollAt > STALE_MS) {
			return "degraded";
		}
		return status.status;
	}, [lastPollAt, now, status]);

	const style = STYLE_BY_STATUS[currentStatus];

	const label = useMemo(() => {
		switch (currentStatus) {
			case "loading":
				return "OLLAMA ...";
			case "healthy":
				return "OLLAMA OK";
			case "degraded":
				return "OLLAMA STALE";
			case "down":
				return "OLLAMA DOWN";
			case "unconfigured":
				return "OLLAMA N/A";
		}
	}, [currentStatus]);

	const tooltip = useMemo(() => {
		if (!status) {
			return "Checking Ollama health...";
		}
		const latency = status.latencyMs != null ? `${status.latencyMs}ms` : "n/a";
		const checkedAt = status.checkedAt
			? new Date(status.checkedAt).toLocaleTimeString()
			: "n/a";
		return [
			`Status: ${status.status}`,
			`Model: ${status.model ?? "n/a"}`,
			`Latency: ${latency}`,
			status.text ? `Reply: ${status.text}` : null,
			status.message ? `Message: ${status.message}` : null,
			`Checked: ${checkedAt}`,
		]
			.filter(Boolean)
			.join(" | ");
	}, [status]);

	return (
		<div
			title={tooltip}
			className={`hidden lg:flex items-center gap-1.5 ${style.bg} ${style.text} px-3 py-1.5 rounded-full text-xs md:text-sm font-bold tracking-[0.5px] select-none cursor-default transition-colors`}
		>
			<IconActivityHeartbeat
				size={14}
				className={`${style.pulse ? "animate-pulse" : ""}`}
			/>
			<span
				className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot} ${style.pulse ? "animate-pulse" : ""}`}
			/>
			{label}
		</div>
	);
};

export default OllamaHealthBadge;
