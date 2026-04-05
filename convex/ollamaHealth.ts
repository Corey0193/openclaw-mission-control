"use node";

import { action } from "./_generated/server";

const OLLAMA_HEALTH_URL =
	process.env.OLLAMA_HEALTH_URL ??
	"https://ai.cb-server.ca/v1/responses";
const OLLAMA_HEALTH_MODEL =
	process.env.OLLAMA_HEALTH_MODEL ?? "qwen2.5-coder:14b";
const OLLAMA_HEALTH_API_KEY = process.env.OLLAMA_HEALTH_API_KEY ?? "ollama";
const OLLAMA_HEALTH_CLIENT_ID =
	process.env.OLLAMA_HEALTH_ACCESS_CLIENT_ID ?? "";
const OLLAMA_HEALTH_CLIENT_SECRET =
	process.env.OLLAMA_HEALTH_ACCESS_CLIENT_SECRET ?? "";

type HealthStatus = "healthy" | "degraded" | "down" | "unconfigured";

type HealthResponse = {
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

function extractResponseText(payload: any): string {
	const output = Array.isArray(payload?.output) ? payload.output : [];
	for (const item of output) {
		const content = Array.isArray(item?.content) ? item.content : [];
		for (const part of content) {
			if (typeof part?.text === "string" && part.text.trim()) {
				return part.text.trim();
			}
		}
	}
	return "";
}

export const checkOllamaHealth = action({
	args: {},
	handler: async (): Promise<HealthResponse> => {
		const checkedAt = Date.now();
		const missingConfig = [
			!OLLAMA_HEALTH_URL && "OLLAMA_HEALTH_URL",
			!OLLAMA_HEALTH_CLIENT_ID && "OLLAMA_HEALTH_ACCESS_CLIENT_ID",
			!OLLAMA_HEALTH_CLIENT_SECRET && "OLLAMA_HEALTH_ACCESS_CLIENT_SECRET",
			!OLLAMA_HEALTH_API_KEY && "OLLAMA_HEALTH_API_KEY",
		].filter(Boolean) as string[];

		if (missingConfig.length > 0) {
			return {
				ok: false,
				status: "unconfigured",
				checkedAt,
				model: OLLAMA_HEALTH_MODEL,
				message: `Missing env: ${missingConfig.join(", ")}`,
			};
		}

		const startedAt = Date.now();
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 8_000);

		try {
			const response = await fetch(OLLAMA_HEALTH_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${OLLAMA_HEALTH_API_KEY}`,
					"CF-Access-Client-Id": OLLAMA_HEALTH_CLIENT_ID,
					"CF-Access-Client-Secret": OLLAMA_HEALTH_CLIENT_SECRET,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: OLLAMA_HEALTH_MODEL,
					input: "Reply with exactly: pong",
					max_output_tokens: 10,
				}),
				signal: controller.signal,
			});

			const latencyMs = Date.now() - startedAt;

			if (!response.ok) {
				const bodyText = (await response.text()).slice(0, 240);
				return {
					ok: false,
					status: "down",
					checkedAt,
					latencyMs,
					model: OLLAMA_HEALTH_MODEL,
					message: `HTTP ${response.status}`,
					body: bodyText || undefined,
				};
			}

			const payload = await response.json();
			const text = extractResponseText(payload);
			const normalized = text.toLowerCase();
			const healthy = normalized === "pong" || normalized.includes("pong");

			return {
				ok: healthy,
				status: healthy ? "healthy" : "degraded",
				checkedAt,
				latencyMs,
				model: String(payload?.model ?? OLLAMA_HEALTH_MODEL),
				text: text || undefined,
				responseId: typeof payload?.id === "string" ? payload.id : undefined,
			};
		} catch (error) {
			const latencyMs = Date.now() - startedAt;
			return {
				ok: false,
				status: "down",
				checkedAt,
				latencyMs,
				model: OLLAMA_HEALTH_MODEL,
				message:
					error instanceof Error ? error.message : "Unknown Ollama health error",
			};
		} finally {
			clearTimeout(timeoutId);
		}
	},
});
