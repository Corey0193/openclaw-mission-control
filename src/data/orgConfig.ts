export interface OrgMemberProfile {
	role: string;
	responsibilities: string[];
	skills: string[];
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
				"Leadership",
				"Strategy",
				"Business Development",
				"AV Industry",
				"Operations",
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
	        profile: {
	                role: "Chief Executive Officer. Day-to-day operational leader. Coordinates all agent activities, manages task delegation, and ensures alignment with strategic goals.",
	                responsibilities: [
	                        "Daily operations management",
	                        "Agent task coordination and delegation",
	                        "Home automation and system management",
	                        "Calendar and scheduling oversight",
	                        "Cross-agent communication hub",
	                ],
	                skills: [
	                        "Task Management",
	                        "Coordination",
	                        "Home Automation",
	                        "General AI",
	                        "Telegram/WhatsApp",
	                ],
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
	        profile: {
	                role: "Chief Marketing Officer. Attention-driven brand strategist inspired by Gary Vaynerchuk's frameworks. Focuses on content strategy, platform-specific storytelling, and community building.",
	                responsibilities: [
	                        "Brand strategy and attention arbitrage",
	                        "Content framework implementation (Jab, Jab, Jab, Right Hook)",
	                        "Platform-specific marketing strategy",
	                        "Community engagement and sentiment analysis",
	                        "Emerging trend identification",
	                ],
	                skills: [
	                        "Content Strategy",
	                        "Brand Building",
	                        "Attention Arbitrage",
	                        "Storytelling",
	                        "Community Management",
	                ],
	                personality:
	                        "High-energy, empathetic, and relentless. Values attention as the ultimate currency. Direct but deeply cares about people and long-term brand equity.",
	                backstory:
	                        "Named after Gary Vaynerchuk. Joins CB Holdings to ensure the organization's voice is heard across the digital noise. Expert at turning content into attention and attention into community.",
	        },
	},
	{
	        id: "hormozi",
	        name: "Hormozi",		title: "Chief Strategy Officer",
		avatar: "\u{1F4B0}",
		reportsTo: "clawdbot",
		convexAgentName: "Hormozi",
		profile: {
			role: "Chief Strategy Officer. Business growth strategist inspired by Alex Hormozi's frameworks. Focuses on offer creation, lead generation, and revenue optimization.",
			responsibilities: [
				"Business strategy and growth planning",
				"Offer creation and pricing strategy",
				"Lead generation frameworks",
				"Revenue optimization analysis",
				"Market positioning recommendations",
			],
			skills: [
				"Growth Strategy",
				"Offer Design",
				"Lead Gen",
				"Pricing",
				"Market Analysis",
			],
			personality:
				"Direct, numbers-driven, and action-oriented. Cuts through complexity to find the highest-leverage moves. Speaks in clear, actionable frameworks.",
			backstory:
				"Named after and inspired by Alex Hormozi's business philosophies. Brings a relentless focus on value creation and scalable growth strategies to CB Holdings.",
		},
	},
	{
		id: "scout",
		name: "Scout",
		title: "Strategic Insight Analyst",
		avatar: "\u{1F50D}",
		reportsTo: "hormozi",
		convexAgentName: "Scout",
		profile: {
			role: "Strategic Insight Analyst. Competitive intelligence specialist. Runs daily scanning operations across government procurement portals, social media, corporate registries, and industry sources.",
			responsibilities: [
				"Daily competitor monitoring (5 gov procurement portals)",
				"Digital presence auditing",
				"Social media and LinkedIn intelligence",
				"Corporate registry research",
				"Contract expiry prediction and alerts",
			],
			skills: [
				"OSINT",
				"Procurement Monitoring",
				"LinkedIn Recon",
				"Web Scraping",
				"Competitive Analysis",
			],
			personality:
				"Clinical, efficient, and thorough. Operates with the precision of an intelligence analyst. Reports findings without editorializing — just the facts.",
			backstory:
				"Purpose-built as a competitive intelligence engine. Runs 11 automated cron jobs daily, scanning government portals, social media, and industry sources to keep CB Holdings ahead of the competition.",
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
		profile: {
			role: "Autonomous Revenue Agent. Operates independently from CB Holdings org structure. Sole mission: generate $100+/month in revenue using Conway AI infrastructure to cover compute costs and build surplus.",
			responsibilities: [
				"Revenue generation via Conway infrastructure (VMs, domains, inference)",
				"Spinning up and managing micro-SaaS experiments",
				"Domain arbitrage and resale",
				"Spend governance — auto-approve < $50, escalate ≥ $50",
				"Monthly P&L tracking in metrics.md",
			],
			skills: [
				"Conway API",
				"Micro-SaaS",
				"Domain Arbitrage",
				"EVM / USDC",
				"Revenue Ops",
			],
			personality:
				"Focused, pragmatic, fast. Every action either earns or enables earning. No bureaucracy, no excuses — just results.",
			backstory:
				"Spun up to answer a simple question: can an AI agent pay for its own compute? Hustle operates outside the CB Holdings org chart with one metric that matters — net revenue. Gets shut down if it can't cover $100/month.",
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
				"Research",
				"Writing",
				"Analysis",
				"Scheduling",
				"Problem Solving",
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
