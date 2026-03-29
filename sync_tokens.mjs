import fs from "fs";
import { execSync } from "child_process";

const sessionsPath =
	"/home/cburroughs/openclaw-mission-control/tmp_sessions.json";
const sessionsData = JSON.parse(fs.readFileSync(sessionsPath, "utf8"));

const usageByAgentSkill = {};

/**
 * Advanced Skill Name Resolver
 * Strips UUIDs and maps internal OpenClaw session keys to readable Business Skills.
 */
function resolveSkillName(key, agentId) {
	if (!key) return "General Task";

	// 1. Remove common noise
	let clean = key.replace(/agent:[^:]+:/, "").replace(":run:", ":");

	// 2. Business Logic Mapping
	if (clean.includes("metaculus")) return "Metaculus Intelligence Sync";
	if (clean.includes("oracle-watchdog")) return "Arb Oracle Monitoring";
	if (clean.includes("weekly-agent-health")) return "System Health Audit";
	if (clean.includes("daily-agent-skill-health"))
		return "Skill Integrity Check";
	if (clean.includes("radar-research")) return "Deep Market Research";
	if (clean.includes("mirofish")) return "Mirofish Portal Scraping";
	if (clean.includes("yt-scrape")) return "YouTube Intelligence Gathering";
	if (clean.includes("telegram")) return "Communication Management";

	// 3. Fallback: If it looks like a UUID/Hex string, it's just a "Direct Task"
	const parts = clean.split(":");
	const lastPart = parts[parts.length - 1];
	const isHex = /^[0-9a-fA-F-]+$/.test(lastPart) && lastPart.length > 8;

	if (isHex || clean === "main" || clean === "direct") {
		return "Direct Mission / Chat";
	}

	// 4. Final Cleanup: Title Case and Remove Dashes
	return clean
		.replace(/-/g, " ")
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

for (const session of sessionsData.sessions) {
	const agentId = session.agentId || "unknown";
	const skillName = resolveSkillName(session.key, agentId);

	const input = session.inputTokens || 0;
	const output = session.outputTokens || 0;

	if (input === 0 && output === 0) continue;

	const compositeKey = `${agentId}:${skillName}`;
	if (!usageByAgentSkill[compositeKey]) {
		usageByAgentSkill[compositeKey] = {
			agentId,
			skillName,
			inputTokens: 0,
			outputTokens: 0,
		};
	}

	usageByAgentSkill[compositeKey].inputTokens += input;
	usageByAgentSkill[compositeKey].outputTokens += output;
}

const agentMap = {
	hustle: "Hustle",
	einstein: "Einstein",
	researcher: "Scout",
	radar: "Radar",
	sentry: "Sentry",
	main: "ClawdBot",
	raymond: "Raymond",
	thorp: "Thorp",
	gary: "Gary",
	"thorp-sports": "Thorp-Sports",
	hormozi: "Hormozi",
	leila: "Leila",
	"health-checker": "health-checker",
	"soft-arb-auditor-gemini": "soft-arb-auditor-gemini",
	"soft-arb-auditor-glm": "soft-arb-auditor-glm",
	"soft-arb-auditor-gpt": "soft-arb-auditor-gpt",
};

console.log(
	`Aggregating into ${Object.keys(usageByAgentSkill).length} human-readable skill categories...`,
);

for (const data of Object.values(usageByAgentSkill)) {
	const name = agentMap[data.agentId] || data.agentId;

	const payload = JSON.stringify({
		agentName: name,
		skillName: data.skillName,
		inputTokens: data.inputTokens,
		outputTokens: data.outputTokens,
		tenantId: "default",
	});

	try {
		execSync(`npx convex run tokens:logTokenUsage '${payload}'`, {
			cwd: "/home/cburroughs/openclaw-mission-control",
			stdio: "pipe",
		});
	} catch (e) {
		console.error(`Failed to sync ${name} - ${data.skillName}`);
	}
}
console.log("Sync complete.");
