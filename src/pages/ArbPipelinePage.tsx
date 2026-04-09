import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	useNodesState,
	useEdgesState,
	BackgroundVariant,
	MarkerType,
	Handle,
	Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Header from "../components/Header";
import {
	IconGlobe,
	IconBrandFunimation,
	IconBallFootball,
	IconBrain,
	IconActivity,
	IconScale,
	IconShieldLock,
	IconPlayerPlay,
	IconArrowsRightLeft,
	IconChartPie,
	IconTarget,
	IconChartBar,
	IconRadar,
	IconDatabase,
	IconShieldCheck,
	IconLock,
	IconRoute,
} from "@tabler/icons-react";

const SourceNode = ({ data }: any) => {
	return (
		<div
			className={`px-4 py-3 min-w-[160px] rounded-xl shadow-sm border bg-white flex items-center gap-3 transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 ${data.borderColor}`}
		>
			<div className={`p-2 rounded-lg bg-slate-50 border ${data.iconColor}`}>
				{data.icon}
			</div>
			<div>
				<div className="text-xs font-bold text-slate-800">{data.label}</div>
				<div className="text-[10px] text-slate-500 font-medium">
					{data.type}
				</div>
			</div>
			<Handle
				type="source"
				position={Position.Right}
				className="w-2 h-2 !bg-slate-300 border-none"
			/>
		</div>
	);
};

const SystemNode = ({ data }: any) => {
	return (
		<div
			className={`w-56 bg-white/80 backdrop-blur-xl rounded-[20px] shadow-lg border border-slate-200/50 p-5 transition-all hover:shadow-xl hover:-translate-y-1 ${data.glowClass}`}
		>
			<Handle
				type="target"
				position={Position.Left}
				className="w-2 h-2 !bg-slate-300 border-none"
			/>
			<div className="flex justify-between items-start mb-3">
				<div className={`p-2.5 rounded-2xl ${data.iconClass} shadow-sm`}>
					{data.icon}
				</div>
				<div className="text-[10px] font-black tracking-widest text-slate-400/80 uppercase mt-1">
					{data.step}
				</div>
			</div>
			<h3 className="font-extrabold text-slate-800 text-sm mb-0.5">
				{data.label}
			</h3>
			<div
				className={`text-xs font-bold ${data.agentColor} uppercase tracking-wide opacity-90`}
			>
				{data.agent}
			</div>
			<p className="text-[11px] text-slate-500 mt-2.5 leading-snug">
				{data.desc}
			</p>
			{data.badge && (
				<div className="mt-3.5 inline-block px-2.5 py-1 bg-slate-50 rounded-lg text-[9px] font-bold text-slate-500 border border-slate-100 uppercase tracking-wider">
					{data.badge}
				</div>
			)}
			<Handle
				type="source"
				position={Position.Right}
				className="w-2 h-2 !bg-slate-300 border-none"
			/>
		</div>
	);
};

const GuardNode = ({ data }: any) => {
	return (
		<div className="bg-rose-50/80 backdrop-blur-md rounded-xl border border-rose-200 border-dashed px-4 py-3 flex items-center gap-2.5 w-44 shadow-sm hover:shadow-md transition-all">
			<Handle
				type="target"
				position={Position.Left}
				className="w-2 h-2 !bg-rose-300 border-none"
			/>
			<div className="p-1.5 bg-rose-100 rounded-lg text-rose-500">
				{data.icon || <IconShieldLock size={16} stroke={2.5} />}
			</div>
			<div>
				<div className="text-xs font-bold text-rose-800">{data.label}</div>
				<div className="text-[9px] text-rose-600/80 font-bold uppercase">
					{data.type}
				</div>
			</div>
			<Handle
				type="source"
				position={Position.Right}
				className="w-2 h-2 !bg-rose-300 border-none"
			/>
		</div>
	);
};

const KnowledgeNode = ({ data }: any) => {
	return (
		<div className="bg-slate-800 text-slate-100 rounded-2xl border border-slate-700 p-4 w-60 shadow-2xl">
			<div className="flex items-center gap-3 mb-3">
				<div className="p-2 bg-slate-700 rounded-lg text-blue-400">
					<IconDatabase size={20} stroke={2} />
				</div>
				<div>
					<div className="text-xs font-black uppercase tracking-widest text-slate-400">
						Persistence
					</div>
					<div className="text-sm font-bold">{data.label}</div>
				</div>
			</div>
			<div className="space-y-1.5">
				{data.items.map((item: string, i: number) => (
					<div
						key={i}
						className="text-[10px] flex items-center gap-2 text-slate-300"
					>
						<div className="w-1 h-1 rounded-full bg-blue-500" />
						{item}
					</div>
				))}
			</div>
			<Handle
				type="target"
				position={Position.Top}
				className="w-2 h-2 !bg-slate-600 border-none"
			/>
			<Handle
				type="source"
				position={Position.Top}
				className="w-2 h-2 !bg-slate-600 border-none"
			/>
		</div>
	);
};

const EventNode = ({ data }: any) => {
	return (
		<div
			className={`p-4 rounded-2xl border bg-white shadow-xl ${data.borderColor} flex flex-col items-center justify-center text-center w-52 bg-gradient-to-b ${data.gradClass} hover:shadow-2xl hover:-translate-y-1 transition-all`}
		>
			<Handle
				type="target"
				position={Position.Left}
				className="w-2 h-2 !bg-slate-300 border-none"
			/>
			<div
				className={`p-3 rounded-2xl mb-2 bg-white shadow-sm border ${data.iconBorder}`}
			>
				{data.icon}
			</div>
			<div className="font-black text-sm text-slate-800 mb-1 tracking-tight">
				{data.label}
			</div>
			<div
				className={`text-[10px] font-bold uppercase tracking-widest ${data.subColor}`}
			>
				{data.sub}
			</div>
			<p className="text-[10px] text-slate-500 mt-2 leading-tight px-2">
				{data.desc}
			</p>
			{data.hasRightHandle && (
				<Handle
					type="source"
					position={Position.Right}
					className="w-2 h-2 !bg-slate-300 border-none"
				/>
			)}
		</div>
	);
};

const nodeTypes = {
	source: SourceNode,
	system: SystemNode,
	guard: GuardNode,
	knowledge: KnowledgeNode,
	event: EventNode,
};

const nodeOpts = (
	id: string,
	type: string,
	pos: { x: number; y: number },
	data: any,
) => ({
	id,
	type,
	position: pos,
	data,
});

const initialNodes = [
	// SOURCES (Col 1: x=50)
	nodeOpts(
		"src-metaculus",
		"source",
		{ x: 50, y: 50 },
		{
			label: "Metaculus",
			type: "PREDICTION MARKET",
			icon: <IconGlobe size={18} stroke={2} className="text-sky-500" />,
			borderColor: "border-l-sky-400",
			iconColor: "border-sky-100",
		},
	),
	nodeOpts(
		"src-predictit",
		"source",
		{ x: 50, y: 160 },
		{
			label: "PredictIt",
			type: "POLITICAL MARKET",
			icon: <IconChartPie size={18} stroke={2} className="text-indigo-500" />,
			borderColor: "border-l-indigo-400",
			iconColor: "border-indigo-100",
		},
	),
	nodeOpts(
		"src-kalshi",
		"source",
		{ x: 50, y: 270 },
		{
			label: "Kalshi",
			type: "EVENT CONTRACTS",
			icon: <IconTarget size={18} stroke={2} className="text-blue-500" />,
			borderColor: "border-l-blue-400",
			iconColor: "border-blue-100",
		},
	),
	nodeOpts(
		"src-predictfun",
		"source",
		{ x: 50, y: 380 },
		{
			label: "Predict.fun",
			type: "WEB3 MARKET",
			icon: (
				<IconBrandFunimation size={18} stroke={2} className="text-violet-500" />
			),
			borderColor: "border-l-violet-400",
			iconColor: "border-violet-100",
		},
	),
	nodeOpts(
		"src-azuro",
		"source",
		{ x: 50, y: 490 },
		{
			label: "Azuro",
			type: "SPORTS BOOK (WEB3)",
			icon: <IconActivity size={18} stroke={2} className="text-amber-500" />,
			borderColor: "border-l-amber-400",
			iconColor: "border-amber-100",
		},
	),
	nodeOpts(
		"src-sports",
		"source",
		{ x: 50, y: 600 },
		{
			label: "General Sports",
			type: "TRADITIONAL ODDS",
			icon: (
				<IconBallFootball size={18} stroke={2} className="text-emerald-500" />
			),
			borderColor: "border-l-emerald-400",
			iconColor: "border-emerald-100",
		},
	),

	// DISPATCHER (Col 1.5: x=280)
	nodeOpts(
		"hustle-router",
		"system",
		{ x: 280, y: 325 },
		{
			step: "0.5. Dispatcher",
			label: "Cron Router",
			agent: "Hustle-Router",
			agentColor: "text-slate-600",
			desc: "Receives cron scan triggers and dispatches Raymond, Thorp, and Thorp-Sports. Forwards verdicts to Hustle.",
			icon: <IconRoute size={24} stroke={2.5} className="text-slate-600" />,
			iconClass: "bg-slate-100/50",
			glowClass: "ring-1 ring-slate-500/10 shadow-slate-500/5",
		},
	),

	// ANALYSIS & RADAR (Col 2: x=450)
	nodeOpts(
		"stage-radar",
		"system",
		{ x: 450, y: 50 },
		{
			step: "0. Intelligence",
			label: "Sentiment & Narrative",
			agent: "Radar",
			agentColor: "text-orange-600",
			desc: "Scans X, Reddit, and YouTube to identify narrative divergence and retail bias.",
			icon: <IconRadar size={24} stroke={2.5} className="text-orange-600" />,
			iconClass: "bg-orange-100/50",
			glowClass: "ring-1 ring-orange-500/10 shadow-orange-500/5",
		},
	),
	nodeOpts(
		"stage-scan",
		"system",
		{ x: 450, y: 325 },
		{
			step: "1. Scanner",
			label: "Discovery & Dossier",
			agent: "Raymond",
			agentColor: "text-blue-600",
			desc: "Constantly polls APIs for new mispriced opportunities, builds initial context dossier.",
			icon: <IconActivity size={24} stroke={2.5} className="text-blue-600" />,
			iconClass: "bg-blue-100/50",
			glowClass: "ring-1 ring-blue-500/10 shadow-blue-500/5",
		},
	),

	// VERIFIERS (Col 3: x=850)
	nodeOpts(
		"stage-verify-thorp",
		"system",
		{ x: 850, y: 150 },
		{
			step: "2A. Verifier",
			label: "Deep Reasoning",
			agent: "Thorp",
			agentColor: "text-purple-600",
			desc: "Uses GLM-5 and Evidence-Prior to verify subset/inverse relationships and Bayesian sync.",
			badge: "Metaculus, Politics, Hedges",
			icon: <IconBrain size={24} stroke={2.5} className="text-purple-600" />,
			iconClass: "bg-purple-100/50",
			glowClass: "ring-1 ring-purple-500/10 shadow-purple-500/5",
		},
	),
	nodeOpts(
		"stage-verify-sports",
		"system",
		{ x: 850, y: 500 },
		{
			step: "2B. Verifier",
			label: "Mechanical Sync",
			agent: "Thorp-Sports",
			agentColor: "text-emerald-600",
			desc: "Fast, deterministic matching of team names, dates, and odds via verification script.",
			badge: "NBA, NHL, MLB, Azuro",
			icon: (
				<IconChartBar size={24} stroke={2.5} className="text-emerald-600" />
			),
			iconClass: "bg-emerald-100/50",
			glowClass: "ring-1 ring-emerald-500/10 shadow-emerald-500/5",
		},
	),

	// ORCHESTRATOR (Col 4: x=1300)
	nodeOpts(
		"stage-decision",
		"system",
		{ x: 1300, y: 325 },
		{
			step: "3. Orchestrator",
			label: "Decision & Control",
			agent: "Hustle",
			agentColor: "text-pink-600",
			desc: "Final sign-off. Checks Kelly sizes,Issues GO/NO-GO, and manages the knowledge loop.",
			icon: <IconScale size={24} stroke={2.5} className="text-pink-600" />,
			iconClass: "bg-pink-100/50",
			glowClass: "ring-1 ring-pink-500/10 shadow-pink-500/5",
		},
	),

	// PRE-EXECUTION GATES (Col 5 & 6: x=1700 & 2000)
	nodeOpts(
		"guard-oracle",
		"guard",
		{ x: 1700, y: 325 },
		{
			label: "Oracle Shield",
			type: "Hyperliquid / Toxic Flow",
			icon: <IconLock size={16} stroke={2.5} className="text-rose-500" />,
		},
	),
	nodeOpts(
		"guard-risk",
		"guard",
		{ x: 2000, y: 325 },
		{
			label: "Risk Protocol",
			type: "Sector Caps / Exposure",
			icon: (
				<IconShieldCheck size={16} stroke={2.5} className="text-rose-500" />
			),
		},
	),

	// EXECUTION (Col 7: x=2350)
	nodeOpts(
		"stage-execute",
		"event",
		{ x: 2350, y: 275 },
		{
			label: "Execution",
			sub: "Paper Mode",
			subColor: "text-emerald-500",
			desc: "Logs synthetic trades to DB for performance tracking without exposing capital.",
			icon: (
				<IconPlayerPlay size={28} stroke={2.5} className="text-emerald-500" />
			),
			borderColor: "border-emerald-200",
			gradClass: "from-emerald-50/50 to-white",
			iconBorder: "border-emerald-100",
			hasRightHandle: true,
		},
	),

	// FEEDBACK & KNOWLEDGE
	nodeOpts(
		"feedback",
		"event",
		{ x: 1850, y: 550 },
		{
			label: "Outcome Calibration",
			sub: "Feedback Loop",
			subColor: "text-amber-500",
			desc: "Monitors settled outcomes to update Kelly multipliers and dynamic edge thresholds.",
			icon: (
				<IconArrowsRightLeft
					size={28}
					stroke={2.5}
					className="text-amber-500"
				/>
			),
			borderColor: "border-amber-200",
			gradClass: "from-amber-50/50 to-white",
			iconBorder: "border-amber-100",
			hasRightHandle: true,
		},
	),

	nodeOpts(
		"knowledge-base",
		"knowledge",
		{ x: 1300, y: 650 },
		{
			label: "Pipeline State",
			items: [
				"cooldown.json (Bad Matches)",
				"known-pairs.json (Verified)",
				"calibration.json (Thresholds)",
				"reverse-seed-feedback.json",
			],
		},
	),
];

const strokeParams = { strokeWidth: 1.5, strokeOpacity: 0.6 };
const animatedParams = { ...strokeParams, strokeDasharray: "4,4" };

const initialEdges = [
	// To Radar
	{
		id: "e-src-radar",
		source: "src-metaculus",
		target: "stage-radar",
		type: "smoothstep",
		style: { stroke: "#cbd5e1", ...strokeParams, strokeDasharray: "2,2" },
	},

	// To Dispatcher (hustle-router)
	{
		id: "e-met",
		source: "src-metaculus",
		target: "hustle-router",
		type: "smoothstep",
		style: { stroke: "#0ea5e9", ...animatedParams },
		animated: true,
	},
	{
		id: "e-pre",
		source: "src-predictit",
		target: "hustle-router",
		type: "smoothstep",
		style: { stroke: "#6366f1", ...animatedParams },
		animated: true,
	},
	{
		id: "e-kal",
		source: "src-kalshi",
		target: "hustle-router",
		type: "smoothstep",
		style: { stroke: "#3b82f6", ...animatedParams },
		animated: true,
	},
	{
		id: "e-fun",
		source: "src-predictfun",
		target: "hustle-router",
		type: "smoothstep",
		style: { stroke: "#8b5cf6", ...animatedParams },
		animated: true,
	},
	{
		id: "e-azu",
		source: "src-azuro",
		target: "hustle-router",
		type: "smoothstep",
		style: { stroke: "#f59e0b", ...animatedParams },
		animated: true,
	},
	{
		id: "e-spo",
		source: "src-sports",
		target: "hustle-router",
		type: "smoothstep",
		style: { stroke: "#10b981", ...animatedParams },
		animated: true,
	},

	// Dispatcher to Scanner
	{
		id: "e-router-scan",
		source: "hustle-router",
		target: "stage-scan",
		type: "smoothstep",
		label: "Dispatch",
		labelStyle: {
			fill: "#475569",
			fontWeight: 700,
			fontSize: 10,
			letterSpacing: "0.05em",
		},
		labelBgStyle: { fill: "transparent" },
		style: { stroke: "#94a3b8", strokeWidth: 2, strokeOpacity: 0.8 },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
	},

	// Radar to Verifier
	{
		id: "e-radar-thorp",
		source: "stage-radar",
		target: "stage-verify-thorp",
		type: "smoothstep",
		style: { stroke: "#f97316", strokeWidth: 1.5, strokeDasharray: "4,4" },
		label: "Sentiment",
	},

	// From Scanner
	{
		id: "e-scan-thorp",
		source: "stage-scan",
		target: "stage-verify-thorp",
		type: "smoothstep",
		label: "Reasoning Route",
		labelStyle: {
			fill: "#7e22ce",
			fontWeight: 700,
			fontSize: 10,
			letterSpacing: "0.05em",
		},
		labelBgStyle: { fill: "transparent" },
		style: { stroke: "#a855f7", strokeWidth: 2, strokeOpacity: 0.8 },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#a855f7" },
	},
	{
		id: "e-scan-sports",
		source: "stage-scan",
		target: "stage-verify-sports",
		type: "smoothstep",
		label: "Sports Route",
		labelStyle: {
			fill: "#047857",
			fontWeight: 700,
			fontSize: 10,
			letterSpacing: "0.05em",
		},
		labelBgStyle: { fill: "transparent" },
		style: { stroke: "#10b981", strokeWidth: 2, strokeOpacity: 0.8 },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
	},

	// Verifiers to Decision
	{
		id: "e-thorp-dec",
		source: "stage-verify-thorp",
		target: "stage-decision",
		type: "smoothstep",
		style: { stroke: "#cbd5e1", strokeWidth: 2 },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#cbd5e1" },
	},
	{
		id: "e-sports-dec",
		source: "stage-verify-sports",
		target: "stage-decision",
		type: "smoothstep",
		style: { stroke: "#cbd5e1", strokeWidth: 2 },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#cbd5e1" },
	},

	// Sequential Gates
	{
		id: "e-dec-oracle",
		source: "stage-decision",
		target: "guard-oracle",
		type: "smoothstep",
		style: { stroke: "#f43f5e", strokeWidth: 2 },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#f43f5e" },
	},
	{
		id: "e-oracle-risk",
		source: "guard-oracle",
		target: "guard-risk",
		type: "smoothstep",
		style: { stroke: "#f43f5e", strokeWidth: 2 },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#f43f5e" },
	},
	{
		id: "e-risk-exe",
		source: "guard-risk",
		target: "stage-execute",
		type: "smoothstep",
		style: { stroke: "#10b981", strokeWidth: 3 },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
	},

	// Knowledge Loop
	{
		id: "e-dec-know",
		source: "stage-decision",
		target: "knowledge-base",
		type: "smoothstep",
		style: { stroke: "#64748b", strokeWidth: 2, strokeDasharray: "4,4" },
		label: "State Sync",
	},
	{
		id: "e-know-scan",
		source: "knowledge-base",
		target: "stage-scan",
		type: "smoothstep",
		style: { stroke: "#64748b", strokeWidth: 1.5, strokeDasharray: "4,4" },
		label: "Context Injection",
	},

	// Feedback Loops
	{
		id: "e-exe-feed",
		source: "stage-execute",
		target: "feedback",
		type: "smoothstep",
		style: { stroke: "#f59e0b", strokeWidth: 2, strokeOpacity: 0.5 },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
	},
	{
		id: "e-feed-know",
		source: "feedback",
		target: "knowledge-base",
		type: "smoothstep",
		style: { stroke: "#f59e0b", strokeWidth: 2, strokeOpacity: 0.7 },
	},
];

export default function ArbPipelinePage() {
	const [nodes, , onNodesChange] = useNodesState(initialNodes);
	const [edges, , onEdgesChange] = useEdgesState(initialEdges);

	return (
		<div className="flex flex-col h-screen text-slate-800 bg-slate-50 font-sans selection:bg-blue-100 overflow-hidden">
			<Header />

			{/* Paper Mode Watermark */}
			<div className="absolute top-20 right-8 z-50 pointer-events-none">
				<div className="bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-2 border-2 border-rose-400 animate-pulse">
					<IconShieldLock size={14} />
					MANDATORY PAPER MODE ACTIVE
				</div>
			</div>

			<div className="flex-1 relative">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					nodeTypes={nodeTypes}
					fitView
					minZoom={0.2}
					maxZoom={1.5}
					className="bg-slate-50"
				>
					<Background
						variant={BackgroundVariant.Dots}
						gap={20}
						size={1}
						color="#cbd5e1"
					/>
					<Controls className="!bg-white !border-slate-200 !shadow-sm" />
					<MiniMap
						nodeColor={(n) => {
							if (n.type === "source") return "#f8fafc";
							if (n.type === "system") return "#eff6ff";
							if (n.type === "knowledge") return "#1e293b";
							if (n.type === "guard") return "#fff1f2";
							return "#ffffff";
						}}
						maskColor="rgba(241, 245, 249, 0.7)"
						className="!bg-white !border-slate-200 !shadow-sm"
					/>
				</ReactFlow>

				{/* Legend / Info Overlay */}
				<div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-2xl shadow-xl max-w-xs z-10">
					<h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
						Soft Arb Legend
					</h4>
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
							<div className="w-3 h-3 rounded-full bg-purple-500" />
							Reasoning Route (Deep analysis)
						</div>
						<div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
							<div className="w-3 h-3 rounded-full bg-emerald-500" />
							Mechanical Route (Sync scripts)
						</div>
						<div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
							<div className="w-3 h-3 rounded-full bg-rose-500" />
							Security Gates (Oracle/Risk)
						</div>
						<div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
							<div className="w-3 h-3 rounded-full bg-slate-800" />
							System Memory (Persistence)
						</div>
					</div>
					<p className="mt-3 text-[9px] text-slate-400 leading-relaxed font-medium">
						This visualization reflects the production pipeline where logic,
						sentiment, and safety protocols interact to find edges without speed
						races.
					</p>
				</div>
			</div>
		</div>
	);
}
