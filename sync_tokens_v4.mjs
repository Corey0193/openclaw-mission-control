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

function resolveSessionSkillName(key, label) {
	if (label && label.toLowerCase().includes("cron:")) {
		return label
			.replace("Cron:", "")
			.trim()
			.replace(/-/g, " ")
			.split(" ")
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");
	}
	if (!key) return "Direct Mission / Chat";
	let clean = key.replace(/agent:[^:]+:/, "").replace(":run:", ":");
	if (clean.includes("metaculus")) return "Metaculus Intelligence Sync";
	if (clean.includes("oracle-watchdog")) return "Arb Oracle Monitoring";
	if (clean.includes("weekly-agent-health")) return "System Health Audit";
	if (clean.includes("daily-agent-skill-health"))
		return "Skill Integrity Check";
	if (clean.includes("radar-research")) return "Deep Market Research";

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
		const baseSkill = resolveSessionSkillName(sessionKey, sessionData.label);

		if (sessionData.sessionFile && fs.existsSync(sessionData.sessionFile)) {
			const lines = fs
				.readFileSync(sessionData.sessionFile, "utf8")
				.split("\n");
			let currentActiveTool =
				baseSkill !== "Direct Mission / Chat"
					? baseSkill
					: "Direct Mission / Chat";

			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const turn = JSON.parse(line);

					// 1. Detect tool usage start
					if (
						turn.type === "message" &&
						turn.message?.role === "assistant" &&
						turn.message.content
					) {
						for (const block of turn.message.content) {
							if (block.type === "toolCall" && block.name) {
								currentActiveTool = toolToSkillMap[block.name] || block.name;
								break;
							}
						}
					}

					// 2. Capture tokens for this turn
					if (turn.usage) {
						const inTok = turn.usage.inputTokens || turn.usage.input || 0;
						const outTok = turn.usage.outputTokens || turn.usage.output || 0;
						addUsage(agentId, currentActiveTool, inTok, outTok);
					}
				} catch (e) {}
			}
		} else {
			addUsage(
				agentId,
				baseSkill,
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
console.log("Granular sync v4 complete.");
