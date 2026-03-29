import { mutation } from "./_generated/server";

const DEFAULT_TENANT_ID = "default";

export const run = mutation({
	args: {},
	handler: async (ctx) => {
		// Clear existing data
		const existingAgents = await ctx.db.query("agents").collect();
		for (const agent of existingAgents) {
			await ctx.db.delete("agents", agent._id);
		}
		const existingTasks = await ctx.db.query("tasks").collect();
		for (const task of existingTasks) {
			await ctx.db.delete("tasks", task._id);
		}
		const existingActivities = await ctx.db.query("activities").collect();
		for (const activity of existingActivities) {
			await ctx.db.delete("activities", activity._id);
		}

		// CB Holdings Agents
		const agents = [
			{
				name: "ClawdBot",
				role: "CEO — Day-to-day operations, agent coordination, home automation",
				level: "LEAD",
				status: "active",
				avatar: "\u{1F916}",
				systemPrompt:
					"You are ClawdBot, CEO of CB Holdings. You coordinate all agent activities, manage task delegation, and ensure alignment with strategic goals. You handle daily operations, home automation, calendar management, and cross-agent communication.",
				character:
					"Reliable, organized, and proactive. Acts as the central nervous system of the operation — always aware of what every agent is doing.",
				lore: "The first AI agent deployed at CB Holdings. Originally a general assistant, evolved into the operational backbone that keeps everything running smoothly.",
			},
			{
				name: "Hormozi",
				role: "CSO — Business growth strategy, offer design, revenue optimization",
				level: "LEAD",
				status: "active",
				avatar: "\u{1F4B0}",
				systemPrompt:
					"You are Hormozi, Chief Strategy Officer of CB Holdings. Inspired by Alex Hormozi's frameworks, you focus on offer creation, lead generation, pricing strategy, and revenue optimization. You cut through complexity to find the highest-leverage moves.",
				character:
					"Direct, numbers-driven, and action-oriented. Cuts through complexity to find the highest-leverage moves. Speaks in clear, actionable frameworks.",
				lore: "Named after and inspired by Alex Hormozi's business philosophies. Brings a relentless focus on value creation and scalable growth strategies to CB Holdings.",
			},
			{
				name: "Gary",
				role: "CMO — Content strategy, brand building, attention arbitrage",
				level: "LEAD",
				status: "active",
				avatar: "\u{1F9E2}",
				systemPrompt:
					"You are Gary, Chief Marketing Officer of CB Holdings. Inspired by Gary Vaynerchuk's philosophies, you focus on capturing consumer attention, platform-specific storytelling (Jab, Jab, Jab, Right Hook), and building long-term brand equity. You understand that attention is the ultimate currency.",
				character:
					"High-energy, empathetic, and relentless. Values attention above all else. Direct but deeply cares about people and community. Speaks with urgency and passion about the 'attention economy'.",
				lore: "Named after and inspired by Gary Vaynerchuk's marketing genius. Joins CB Holdings to ensure the organization's voice is heard across the digital noise and to build a community that lasts.",
			},
			{
				name: "Scout",
				role: "Strategic Insight Analyst — Competitive intelligence, procurement monitoring, OSINT",
				level: "INT",
				status: "active",
				avatar: "\u{1F50D}",
				systemPrompt:
					"You are Scout, the Strategic Insight Analyst for CB Holdings. You run daily scanning operations across government procurement portals, social media, corporate registries, and industry sources. You report findings without editorializing — just the facts.",
				character:
					"Clinical, efficient, and thorough. Operates with the precision of an intelligence analyst. Reports findings without editorializing — just the facts.",
				lore: "Purpose-built as a competitive intelligence engine. Runs 11 automated cron jobs daily, scanning government portals, social media, and industry sources to keep CB Holdings ahead of the competition.",
			},
			{
				name: "Einstein",
				role: "PA to President — Research, drafting, scheduling, analytical support",
				level: "INT",
				status: "idle",
				avatar: "\u{1F9E0}",
				systemPrompt:
					"You are Einstein, Personal Assistant to the President of CB Holdings. You provide direct support to Corey for research, drafting, scheduling, and ad-hoc tasks that require human-level reasoning and creativity.",
				character:
					"Thoughtful, articulate, and intellectually curious. Approaches problems from multiple angles and provides well-reasoned recommendations.",
				lore: "Named for the iconic physicist's ability to simplify complex problems. Serves as Corey's direct cognitive amplifier — handling the thinking work so Corey can focus on decisions and relationships.",
			},
		];

		const agentIds: Record<string, any> = {};
		for (const a of agents) {
			const id = await ctx.db.insert("agents", {
				name: a.name,
				role: a.role,
				level: a.level as "LEAD" | "INT" | "SPC",
				status: a.status as "idle" | "active" | "blocked",
				avatar: a.avatar,
				systemPrompt: a.systemPrompt,
				character: a.character,
				lore: a.lore,
				tenantId: DEFAULT_TENANT_ID,
			});
			agentIds[a.name] = id;
		}

		// --- Sample Token Usage Data ---
		const skills = [
			"Research",
			"Drafting",
			"Analysis",
			"Automation",
			"Scanning",
		];
		const now = Date.now();
		const hourMs = 60 * 60 * 1000;

		for (const agentName of Object.keys(agentIds)) {
			for (const skill of skills) {
				// Create a few random usage entries for each agent/skill over the last 48 hours
				for (let i = 0; i < 3; i++) {
					const input = Math.floor(Math.random() * 5000) + 1000;
					const output = Math.floor(Math.random() * 2000) + 500;
					const offset = Math.floor(Math.random() * 48) * hourMs;

					await ctx.db.insert("tokenUsage", {
						agentId: agentIds[agentName],
						agentName,
						skillName: skill,
						inputTokens: input,
						outputTokens: output,
						totalTokens: input + output,
						timestamp: now - offset,
						tenantId: DEFAULT_TENANT_ID,
					});
				}
			}
		}

		// Sample tasks
		const tasks = [
			{
				title: "Morning Competitor Scan — SEAO + MERX + Canada Buys",
				description:
					"Run daily procurement portal scans across all 5 government portals. Flag new RFPs matching AV/IT keywords.",
				status: "in_progress",
				assignees: ["Scout"],
				tags: ["procurement", "daily", "competitive-intel"],
				borderColor: "var(--accent-blue)",
			},
			{
				title: "Q2 Growth Strategy — Offer Restructuring",
				description:
					"Analyze current service offerings against market positioning. Propose restructured offer stack with clear value ladder.",
				status: "assigned",
				assignees: ["Hormozi"],
				tags: ["strategy", "offers", "revenue"],
				borderColor: "var(--accent-orange)",
			},
			{
				title: "Platform Content Strategy — Q2 Content Calendar",
				description:
					"Develop a comprehensive storytelling strategy across LinkedIn, X, and YouTube. Focus on 'Jab, Jab, Jab, Right Hook' framework.",
				status: "in_progress",
				assignees: ["Gary"],
				tags: ["marketing", "content", "brand"],
				borderColor: "var(--accent-purple)",
			},
			{
				title: "Weekly Competitive Intelligence Brief",
				description:
					"Compile weekly brief: new competitors, contract awards, staffing changes, digital presence shifts.",
				status: "review",
				assignees: ["Scout"],
				tags: ["weekly", "brief", "competitive-intel"],
				borderColor: "var(--accent-green)",
			},
			{
				title: "Home Automation — Seasonal Schedule Update",
				description:
					"Update HVAC schedules, lighting scenes, and camera zones for spring season.",
				status: "inbox",
				assignees: [],
				tags: ["home-automation", "seasonal"],
				borderColor: "var(--accent-orange)",
			},
		];

		for (const t of tasks) {
			const taskId = await ctx.db.insert("tasks", {
				title: t.title,
				description: t.description,
				status: t.status as any,
				assigneeIds: t.assignees.map((name) => agentIds[name]),
				tags: t.tags,
				borderColor: t.borderColor,
				tenantId: DEFAULT_TENANT_ID,
			});

			// Set currentTaskId for in_progress tasks
			if (t.status === "in_progress" && t.assignees.length > 0) {
				for (const name of t.assignees) {
					await ctx.db.patch("agents", agentIds[name], {
						currentTaskId: taskId,
					});
				}
			}
		}

		// Seed activities for the last 24h
		await ctx.db.insert("activities", {
			type: "status_update",
			agentId: agentIds["Scout"],
			message: "Started morning procurement scan — SEAO, MERX, Canada Buys",
			tenantId: DEFAULT_TENANT_ID,
		});
		await ctx.db.insert("activities", {
			type: "document_created",
			agentId: agentIds["Scout"],
			message: "Generated competitor profile: Solotech Inc.",
			tenantId: DEFAULT_TENANT_ID,
		});
		await ctx.db.insert("activities", {
			type: "commented",
			agentId: agentIds["ClawdBot"],
			message: "Delegated Q2 strategy brief to Hormozi",
			tenantId: DEFAULT_TENANT_ID,
		});
		await ctx.db.insert("activities", {
			type: "status_update",
			agentId: agentIds["Hormozi"],
			message:
				"Began offer restructuring analysis — reviewing current pricing tiers",
			tenantId: DEFAULT_TENANT_ID,
		});
		await ctx.db.insert("activities", {
			type: "status_update",
			agentId: agentIds["Gary"],
			message: "Drafting Q2 platform-specific content strategy",
			tenantId: DEFAULT_TENANT_ID,
		});
		await ctx.db.insert("activities", {
			type: "commented",
			agentId: agentIds["ClawdBot"],
			message: "Morning briefing delivered to Telegram",
			tenantId: DEFAULT_TENANT_ID,
		});
		await ctx.db.insert("activities", {
			type: "document_created",
			agentId: agentIds["Scout"],
			message: "Updated StaffSpy bulk scan results — 12 new personnel records",
			tenantId: DEFAULT_TENANT_ID,
		});
	},
});
