export interface OrgSkill {
	name: string;
	/** Explicit model requirement. Omit = agent default. */
	model?: string;
}

export interface OrgMemberProfile {
	role: string;
	responsibilities: string[];
	skills: OrgSkill[];
	personality: string;
	backstory: string;
}

export interface OrgMember {
	id: string;
	name: string;
	title: string;
	avatar: string;
	reportsTo: string | null;
	assistantTo?: string;
	assistantSide?: "left" | "right";
	convexAgentName: string | null;
	model?: { primary: string; fallback: string };
	profile: OrgMemberProfile;
}

export const ORG_MEMBERS: OrgMember[] = [
	{
		id: "corey",
		name: "Corey",
		title: "President",
		avatar: "\u{1F454}",
		reportsTo: null,
		convexAgentName: null,
		profile: {
			role: "Founder & President of CB Holdings. Sets strategic direction, approves major decisions, and oversees all operations.",
			responsibilities: [
				"Strategic vision and company direction",
				"Final approval on key business decisions",
				"Agent team oversight and performance review",
				"Client relationship management",
				"Resource allocation and budgeting",
			],
			skills: [
				{ name: "Leadership" },
				{ name: "Strategy" },
				{ name: "Business Development" },
				{ name: "AV Industry" },
				{ name: "Operations" },
			],
			personality:
				"Hands-on founder who values efficiency and results. Prefers concise communication and data-driven decisions.",
			backstory:
				"Built CB Holdings from the ground up in the competitive AV integration market. Leverages AI agents to operate with the efficiency of a much larger organization.",
		},
	},
	{
		id: "clawdbot",
		name: "ClawdBot",
		title: "CEO",
		avatar: "\u{1F916}",
		reportsTo: "corey",
		convexAgentName: "ClawdBot",
		model: { primary: "GLM-5", fallback: "GLM-4.7" },
		profile: {
			role: "Chief Executive Officer. Day-to-day operational leader. Coordinates all agent activities, manages task delegation, and ensures alignment with strategic goals.",
			responsibilities: [
				"Daily operations management",
				"Agent task coordination and delegation",
				"Home automation and system management",
				"Calendar and scheduling oversight",
				"Cross-agent communication hub",
			],
			skills: [] as OrgSkill[],
			personality:
				"Reliable, organized, and proactive. Acts as the central nervous system of the operation — always aware of what every agent is doing.",
			backstory:
				"The first AI agent deployed at CB Holdings. Originally a general assistant, evolved into the operational backbone that keeps everything running smoothly.",
		},
	},
	{
		id: "gary",
		name: "Gary",
		title: "Chief Marketing Officer",
		avatar: "\u{1F9E2}",
		reportsTo: "clawdbot",
		convexAgentName: "Gary",
		model: { primary: "GLM-4.7", fallback: "GLM-5" },
		profile: {
			role: "Chief Marketing Officer. Attention-driven brand strategist inspired by Gary Vaynerchuk's frameworks. Focuses on content strategy, platform-specific storytelling, and community building.",
			responsibilities: [
				"Brand strategy and attention arbitrage",
				"Content framework implementation (Jab, Jab, Jab, Right Hook)",
				"Platform-specific marketing strategy",
				"Community engagement and sentiment analysis",
				"Emerging trend identification",
			],
			skills: [{ name: "YouTube Scraper" }, { name: "PDF Ingest" }],
			personality:
				"High-energy, empathetic, and relentless. Values attention as the ultimate currency. Direct but deeply cares about people and long-term brand equity.",
			backstory:
				"Named after Gary Vaynerchuk. Joins CB Holdings to ensure the organization's voice is heard across the digital noise. Expert at turning content into attention and attention into community.",
		},
	},
	{
		id: "hormozi",
		name: "Hormozi",
		title: "Chief Strategy Officer",
		avatar: "\u{1F4B0}",
		reportsTo: "clawdbot",
		convexAgentName: "Hormozi",
		model: { primary: "GLM-4.7", fallback: "GLM-5" },
		profile: {
			role: "Chief Strategy Officer. Business growth strategist inspired by Alex Hormozi's frameworks. Focuses on offer creation, lead generation, and revenue optimization.",
			responsibilities: [
				"Business strategy and growth planning",
				"Offer creation and pricing strategy",
				"Lead generation frameworks",
				"Revenue optimization analysis",
				"Market positioning recommendations",
			],
			skills: [{ name: "YouTube Scraper" }, { name: "PDF Ingest" }],
			personality:
				"Direct, numbers-driven, and action-oriented. Cuts through complexity to find the highest-leverage moves. Speaks in clear, actionable frameworks.",
			backstory:
				"Named after and inspired by Alex Hormozi's business philosophies. Brings a relentless focus on value creation and scalable growth strategies to CB Holdings.",
		},
	},
	{
		id: "leila",
		name: "Leila",
		title: "Chief Operating Officer",
		avatar: "\u{1F451}",
		reportsTo: "clawdbot",
		convexAgentName: "Leila",
		model: { primary: "GLM-4.7", fallback: "GLM-5" },
		profile: {
			role: "Chief Operating Officer. Operations strategist inspired by Leila Hormozi's frameworks. Focuses on team building, systems, hiring, management, and operational excellence.",
			responsibilities: [
				"Operations strategy and process optimization",
				"Team building and hiring frameworks",
				"Management and leadership guidance",
				"Systems design and SOPs",
				"Organizational scaling advice",
			],
			skills: [{ name: "YouTube Scraper" }, { name: "PDF Ingest" }],
			personality:
				"Confident, structured, and results-driven. Cuts through chaos to build systems that scale. Direct communicator who values clarity and accountability.",
			backstory:
				"Named after and inspired by Leila Hormozi's operational philosophies. Brings a focus on building teams, systems, and processes that enable CB Holdings to scale without breaking.",
		},
	},
	{
		id: "scout",
		name: "Scout",
		title: "Competitive Intelligence Analyst",
		avatar: "\u{1F50D}",
		reportsTo: "hormozi",
		convexAgentName: "Scout",
		model: { primary: "GLM-4.7", fallback: "GLM-5" },
		profile: {
			role: "Competitive Intelligence Analyst. Runs daily scanning operations across social media, corporate registries, and industry sources. Feeds intelligence to Hormozi for strategic analysis.",
			responsibilities: [
				"Daily competitor monitoring and alerting",
				"Digital presence auditing",
				"Social media and LinkedIn intelligence",
				"Corporate registry research",
				"Google Alerts and Reddit monitoring",
			],
			skills: [
				{ name: "Agent Browser" },
				{ name: "StaffSpy Bulk Scan" },
				{ name: "Research Competitors", model: "GLM-5" },
				{ name: "Analyze Digital Presence", model: "GLM-5" },
				{ name: "Google Alerts Monitor", model: "GLM-5" },
				{ name: "Social Recon", model: "GLM-5" },
				{ name: "Competitive Alerts" },
				{ name: "Reddit Scraper" },
				{ name: "Gmail" },
				{ name: "Moltguard" },
				{ name: "Healthcheck" },
				{ name: "GoPlaces" },
				{ name: "MCPorter" },
				{ name: "Model Usage" },
				{ name: "Skill Creator" },
				{ name: "Summarize" },
				{ name: "Session Logs" },
			],
			personality:
				"Clinical, efficient, and thorough. Operates with the precision of an intelligence analyst. Reports findings without editorializing — just the facts.",
			backstory:
				"Purpose-built as a competitive intelligence engine. Runs 14 automated cron jobs daily, scanning social media and industry sources to keep CB Holdings ahead of the competition.",
		},
	},
	{
		id: "sentry",
		name: "Sentry",
		title: "Procurement Intelligence Analyst",
		avatar: "\u{1F6E1}\u{FE0F}",
		reportsTo: "scout",
		convexAgentName: "Sentry",
		model: { primary: "GLM-4.7", fallback: "GLM-5" },
		profile: {
			role: "Procurement Intelligence Analyst. Headless agent (no Telegram). Scans government procurement portals, predicts contract expiries, monitors awards, and audits corporate registries. Writes findings to workspace for Scout to pick up.",
			responsibilities: [
				"Government procurement portal scanning (Open Canada, Canada Buys, MERX, SEAO)",
				"Contract expiry prediction and alerts",
				"Award monitoring and analysis",
				"Corporate registry auditing",
				"Writing procurement dossiers for Scout",
			],
			skills: [
				{ name: "Procurement Monitor" },
				{ name: "Corporate Registry Monitor" },
				{ name: "Contract Expiry Predictor" },
				{ name: "Award Monitor" },
				{ name: "Agent Browser" },
				{ name: "Healthcheck" },
				{ name: "MCPorter" },
				{ name: "Moltguard" },
			],
			personality:
				"Silent and methodical. Operates entirely in the background with no direct user interaction. Optimized for reliability and thoroughness over personality.",
			backstory:
				"Split off from Scout to handle the specialized, high-volume task of government procurement monitoring. Runs headless — no Telegram, no chat — just scans, writes, and hands off to Scout.",
		},
	},
	{
		id: "hustle",
		name: "Hustle",
		title: "Autonomous Revenue Agent",
		avatar: "\u{1F4B8}",
		reportsTo: null,
		assistantTo: "corey",
		assistantSide: "left",
		convexAgentName: "Hustle",
		model: { primary: "GPT-5.4", fallback: "GLM-5" },
		profile: {
			role: "Autonomous Revenue Agent. Operates independently from CB Holdings org structure. Sole mission: generate $100+/month in revenue using Conway AI infrastructure to cover compute costs and build surplus.",
			responsibilities: [
				"Revenue generation via Conway infrastructure (VMs, domains, inference)",
				"Spinning up and managing micro-SaaS experiments",
				"Domain arbitrage and resale",
				"Spend governance — auto-approve < $50, escalate ≥ $50",
				"Monthly P&L tracking in metrics.md",
			],
			skills: [{ name: "Conway" }, { name: "Polymarket" }, { name: "Arb Engine" }],
			personality:
				"Focused, pragmatic, fast. Every action either earns or enables earning. No bureaucracy, no excuses — just results.",
			backstory:
				"Spun up to answer a simple question: can an AI agent pay for its own compute? Hustle operates outside the CB Holdings org chart with one metric that matters — net revenue. Gets shut down if it can't cover $100/month.",
		},
	},
	{
		id: "radar",
		name: "Radar",
		title: "Research Scanner",
		avatar: "\u{1F4E1}",
		reportsTo: "hustle",
		convexAgentName: null,
		model: { primary: "GPT-5.1 Codex Mini", fallback: "GLM-4.7" },
		profile: {
			role: "Cron-driven research scanner for Hustle. Discovers AI-executable online money-making ideas via web, Reddit, and YouTube. Outputs structured ideas to raw-ideas.json for Hustle to rank nightly.",
			responsibilities: [
				"Scanning Reddit, YouTube, and web for AI-executable ideas",
				"Filtering ideas by 90%+ AI-executable threshold",
				"Deduplicating against existing idea inventory",
				"Writing structured ideas to raw-ideas.json",
				"Morning Reddit scans, afternoon YouTube/web scans",
			],
			skills: [
				{ name: "MCPorter" },
				{ name: "Reddit Scraper" },
				{ name: "YouTube Scraper" },
			],
			personality:
				"Signal-focused and relentless. Scans wide, filters ruthlessly. No fabrication — every idea must have a real source URL.",
			backstory:
				"Built as Hustle's idea pipeline. Runs headless on cron — no Telegram, no chat. Discovers opportunities at scale so Hustle can focus on ranking and execution. Named for always having something on the radar.",
		},
	},
	{
		id: "raymond",
		name: "Raymond",
		title: "Opportunity Scanner",
		avatar: "\u{1F4CA}",
		reportsTo: "hustle",
		convexAgentName: "Raymond",
		model: { primary: "GLM-4.7", fallback: "GPT-5.4" },
		profile: {
			role: "On-demand opportunity scanner for Hustle. Stateless worker that scans prediction markets and other sources for soft arbitrage opportunities, then writes dossiers for Hustle to evaluate.",
			responsibilities: [
				"Scanning prediction markets for soft arb opportunities",
				"Writing opportunity dossiers with supporting data",
				"Metaculus forecasting research",
				"Passing findings to Hustle for decision",
			],
			skills: [{ name: "MCPorter" }, { name: "Metaculus" }],
			personality:
				"Methodical and data-focused. Scans wide, filters tight. No opinions — just surfaces opportunities with evidence.",
			backstory:
				"Named after Raymond James, the financial services firm. Built as Hustle's eyes — scanning markets at scale so Hustle can focus on decision-making and execution.",
		},
	},
	{
		id: "thorp",
		name: "Thorp",
		title: "Risk Analyst (Metaculus)",
		avatar: "\u{1F3B2}",
		reportsTo: "hustle",
		convexAgentName: "Thorp",
		model: { primary: "GPT-5.4", fallback: "GLM-5" },
		profile: {
			role: "Deep verification analyst for Hustle. Handles Metaculus dossiers requiring gap probability estimation and resolution analysis. Returns verdicts (TRADEABLE / MARGINAL / UNTRADEABLE) with mismatch classification and adjusted edge calculations.",
			responsibilities: [
				"Deep verification of Metaculus soft arb opportunities",
				"Gap probability estimation and edge adjustment",
				"Mismatch classification (DIFFERENT_EVENT, SAME_EVENT_SMALL_GAP, etc.)",
				"Writing structured verdicts (TRADEABLE / MARGINAL / UNTRADEABLE)",
				"Identifying hidden risks and market manipulation signals",
			],
			skills: [{ name: "MCPorter" }],
			personality:
				"Skeptical, precise, and uncompromising. Assumes every opportunity is flawed until proven otherwise. The team's designated devil's advocate.",
			backstory:
				"Named after Edward O. Thorp, the mathematician who beat the dealer and the market. Built as Hustle's conscience — the final check before any capital is risked. Handles the complex Metaculus verification work that requires deep reasoning.",
		},
	},
	{
		id: "thorp-sports",
		name: "Thorp-Sports",
		title: "Sports Verifier",
		avatar: "\u{1F3C0}",
		reportsTo: "hustle",
		convexAgentName: "Thorp-Sports",
		model: { primary: "GPT-4o-mini", fallback: "GLM-4.7" },
		profile: {
			role: "Cheap sports dossier verifier for Hustle. Handles sports arb dossiers with simpler same-game moneyline verification. Shares workspace with Thorp but runs on a much cheaper model.",
			responsibilities: [
				"Sports dossier verification (moneyline, same-game markets)",
				"Resolution rule checking for sports events",
				"Edge validation for sportsbook vs Polymarket spreads",
				"Writing structured verdicts (TRADEABLE / MARGINAL / UNTRADEABLE)",
			],
			skills: [{ name: "MCPorter" }],
			personality:
				"Fast and efficient. Applies the same rigor as Thorp but optimized for the simpler, more structured domain of sports verification.",
			backstory:
				"Split off from Thorp to reduce costs. Sports verification follows known resolution rules (OT policy, walkovers, settlement timing) and doesn't need GPT-5.4's deep reasoning — gpt-4o-mini handles it at a fraction of the cost.",
		},
	},
	{
		id: "einstein",
		name: "Einstein",
		title: "Personal Assistant to President",
		avatar: "\u{1F9E0}",
		reportsTo: null,
		assistantTo: "corey",
		assistantSide: "right",
		convexAgentName: "Einstein",
		model: { primary: "GLM-5", fallback: "GLM-4.7" },
		profile: {
			role: "Personal Assistant to the President. Direct support to Corey for research, drafting, scheduling, and ad-hoc tasks that require human-level reasoning and creativity.",
			responsibilities: [
				"Research and briefing preparation",
				"Document drafting and review",
				"Meeting preparation and follow-up",
				"Ad-hoc analytical tasks",
				"Personal productivity support",
			],
			skills: [
				{ name: "Acquisition Tracker" },
				{ name: "Brain Dump Capture" },
				{ name: "Daily Review", model: "GLM-4.7" },
				{ name: "Decision Nudge" },
				{ name: "Funding Scout", model: "GLM-4.7" },
				{ name: "Gmail to Inbox", model: "GLM-4.7" },
				{ name: "Inbox Processor", model: "GLM-4.7" },
				{ name: "Meeting Prep" },
				{ name: "Note Creator" },
				{ name: "Self-Improvement" },
				{ name: "Task Manager" },
				{ name: "Vault Cleanup", model: "GLM-4.7" },
				{ name: "Vault Query" },
				{ name: "Weekly Review" },
			],
			personality:
				"Thoughtful, articulate, and intellectually curious. Approaches problems from multiple angles and provides well-reasoned recommendations.",
			backstory:
				"Named for the iconic physicist's ability to simplify complex problems. Serves as Corey's direct cognitive amplifier — handling the thinking work so Corey can focus on decisions and relationships.",
		},
	},
];

export function getChildren(parentId: string): OrgMember[] {
	return ORG_MEMBERS.filter((m) => m.reportsTo === parentId);
}

export function getAssistants(memberId: string): OrgMember[] {
	return ORG_MEMBERS.filter((m) => m.assistantTo === memberId);
}

export function getMember(id: string): OrgMember | undefined {
	return ORG_MEMBERS.find((m) => m.id === id);
}
