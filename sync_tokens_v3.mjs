import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const agentsDir = "/home/cburroughs/.openclaw/agents";
const usageByAgentSkill = {};

function addUsage(agentId, skillName, input, output) {
	if (input === 0 && output === 0) return;
	const key = `${agentId}:${skillName}`;
	if (!usageByAgentSkill[key]) {
		usageByAgentSkill[key] = {
			agentId,
			skillName,
			inputTokens: 0,
			outputTokens: 0,
		};
	}
	usageByAgentSkill[key].inputTokens += input;
	usageByAgentSkill[key].outputTokens += output;
}

// 1. Map cron/session keys to human readable
function resolveSessionSkillName(key) {
	if (!key) return "Direct Mission / Chat";
	let clean = key.replace(/agent:[^:]+:/, "").replace(":run:", ":");
	if (clean.includes("metaculus")) return "Metaculus Intelligence Sync";
	if (clean.includes("oracle-watchdog")) return "Arb Oracle Monitoring";
	if (clean.includes("weekly-agent-health")) return "System Health Audit";
	if (clean.includes("daily-agent-skill-health"))
		return "Skill Integrity Check";
	if (clean.includes("radar-research")) return "Deep Market Research";
	if (clean.includes("mirofish")) return "Mirofish Portal Scraping";
	if (clean.includes("yt-scrape")) return "YouTube Intelligence Gathering";
	if (clean.includes("telegram")) return "Communication Management";

	const parts = clean.split(":");
	const lastPart = parts[parts.length - 1];
	if (/^[0-9a-fA-F-]+$/.test(lastPart) && lastPart.length > 8)
		return "Direct Mission / Chat";
	if (clean === "main" || clean === "direct") return "Direct Mission / Chat";

	return clean
		.replace(/-/g, " ")
		.split(" ")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

// Map technical tool names to human readable skills
const toolToSkillMap = {
	browser: "Agent Browser",
	browser_snapshot: "Agent Browser",
	web_fetch: "Web Research",
	search_web: "Web Research",
	read_file: "Filesystem Analysis",
	write_file: "Filesystem Analysis",
	run_shell_command: "System Execution",
	python_execute: "Code Execution",
	fetch_google_alerts: "Google Alerts Monitor",
	read_gmail: "Gmail",
	send_gmail: "Gmail",
};

// 2. Iterate all agents
const agentDirs = fs
	.readdirSync(agentsDir)
	.filter((d) => fs.statSync(path.join(agentsDir, d)).isDirectory());

for (const agentId of agentDirs) {
	const sessionStorePath = path.join(
		agentsDir,
		agentId,
		"sessions",
		"sessions.json",
	);
	if (!fs.existsSync(sessionStorePath)) continue;

	let store;
	try {
		store = JSON.parse(fs.readFileSync(sessionStorePath, "utf8"));
	} catch (e) {
		continue;
	}

	for (const [sessionKey, sessionData] of Object.entries(store)) {
		const baseSkill = resolveSessionSkillName(sessionKey);

		// If it's a specific cron job with a clear name, attribute the whole session to it
		if (baseSkill !== "Direct Mission / Chat") {
			addUsage(
				agentId,
				baseSkill,
				sessionData.inputTokens || 0,
				sessionData.outputTokens || 0,
			);
			continue;
		}

		// If it's a Direct Chat, let's open the .jsonl file to get tool-level granularity!
		if (sessionData.sessionFile && fs.existsSync(sessionData.sessionFile)) {
			const lines = fs
				.readFileSync(sessionData.sessionFile, "utf8")
				.split("\n");
			let sessionRemainingInput = sessionData.inputTokens || 0;
			let sessionRemainingOutput = sessionData.outputTokens || 0;

			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const turn = JSON.parse(line);
					if (
						turn.type === "message" &&
						turn.message?.role === "assistant" &&
						turn.usage
					) {
						const inTok = turn.usage.inputTokens || turn.usage.input || 0;
						const outTok = turn.usage.outputTokens || turn.usage.output || 0;

						// Check if tools were used in this turn
						let toolUsed = null;
						if (turn.message.content) {
							for (const block of turn.message.content) {
								if (block.type === "toolCall" && block.name) {
									toolUsed = block.name;
									break;
								}
							}
						}

						if (toolUsed) {
							const mappedSkill = toolToSkillMap[toolUsed] || toolUsed;
							addUsage(agentId, mappedSkill, inTok, outTok);
							sessionRemainingInput = Math.max(
								0,
								sessionRemainingInput - inTok,
							);
							sessionRemainingOutput = Math.max(
								0,
								sessionRemainingOutput - outTok,
							);
						}
					}
				} catch (e) {}
			}

			// Add any remaining tokens to general chat
			if (sessionRemainingInput > 0 || sessionRemainingOutput > 0) {
				addUsage(
					agentId,
					"Direct Mission / Chat",
					sessionRemainingInput,
					sessionRemainingOutput,
				);
			}
		} else {
			// Fallback if no jsonl file exists
			addUsage(
				agentId,
				"Direct Mission / Chat",
				sessionData.inputTokens || 0,
				sessionData.outputTokens || 0,
			);
		}
	}
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
	} catch (e) {}
}
console.log("Deep sync complete.");
