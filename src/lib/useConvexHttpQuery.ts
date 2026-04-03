import { useEffect, useState } from "react";

type ConvexQueryResponse<T> =
	| { status: "success"; value: T }
	| { status: "error"; errorMessage?: string };

const DEFAULT_POLL_MS = 30_000;

export function useConvexHttpQuery<T>(
	path: string,
	args: Record<string, unknown>,
	options?: { pollMs?: number },
): T | undefined {
	const [data, setData] = useState<T | undefined>(undefined);
	const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
	const serializedArgs = JSON.stringify(args);

	useEffect(() => {
		let cancelled = false;
		const parsedArgs = JSON.parse(serializedArgs) as Record<string, unknown>;

		const runQuery = async () => {
			try {
				const resp = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/query`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ path, args: parsedArgs }),
				});
				if (!resp.ok) {
					return;
				}
				const payload = (await resp.json()) as ConvexQueryResponse<T>;
				if (cancelled || payload.status !== "success") {
					return;
				}
				setData(payload.value);
			} catch {
				// Keep prior data if polling fails transiently.
			}
		};

		void runQuery();
		const intervalId = window.setInterval(() => {
			void runQuery();
		}, pollMs);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
		};
	}, [path, pollMs, serializedArgs]);

	return data;
}
