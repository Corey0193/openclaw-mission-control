import { useCallback, useEffect, useState } from "react";
import type { PortfolioResponse } from "../types/portfolio";

const DEFAULT_POLL_MS = 30_000;

export function usePortfolio(options?: { pollMs?: number }): {
	data: PortfolioResponse | null;
	loading: boolean;
	refresh: () => Promise<void>;
} {
	const [data, setData] = useState<PortfolioResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;

	const refresh = useCallback(async () => {
		try {
			const res = await fetch("/api/portfolio");
			if (!res.ok) throw new Error(`portfolio request failed (${res.status})`);
			const json = (await res.json()) as PortfolioResponse;
			setData(json);
		} catch (err) {
			console.error("[usePortfolio] fetch failed:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
		const interval = setInterval(() => void refresh(), pollMs);
		return () => clearInterval(interval);
	}, [refresh, pollMs]);

	return { data, loading, refresh };
}
