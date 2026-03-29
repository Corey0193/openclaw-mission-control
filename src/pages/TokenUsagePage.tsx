"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import Header from "../components/Header";
import {
	IconChartBar,
	IconFilter,
	IconCalendarEvent,
} from "@tabler/icons-react";
import { ORG_MEMBERS } from "../data/orgConfig";

const TIME_RANGES = [
	{ label: "24H", value: 24 * 60 * 60 * 1000 },
	{ label: "7D", value: 7 * 24 * 60 * 60 * 1000 },
	{ label: "30D", value: 30 * 24 * 60 * 60 * 1000 },
	{ label: "ALL", value: Infinity },
];

export default function TokenUsagePage() {
	const [selectedRange, setSelectedRange] = useState(TIME_RANGES[1]); // Default 7 days
	const [selectedAgent, setSelectedAgent] = useState<string>("All");
	const [selectedSkill, setSelectedSkill] = useState<string>("All");

	const startTime = useMemo(() => {
		if (selectedRange.value === Infinity) return 0;
		return Date.now() - selectedRange.value;
	}, [selectedRange]);

	const data = useQuery(api.tokens.getAggregatedTokenUsage, {
		tenantId: DEFAULT_TENANT_ID,
		startTime,
		selectedAgentName: selectedAgent,
		selectedSkillName: selectedSkill,
	});

	const agents = useMemo(() => {
		const orgAgents = ORG_MEMBERS.filter((m) => m.convexAgentName).map(
			(m) => m.convexAgentName as string,
		);
		const telemetryAgents = data?.agents ?? [];
		const uniqueAgents = Array.from(
			new Set([...orgAgents, ...telemetryAgents]),
		);
		return ["All", ...uniqueAgents.sort()];
	}, [data?.agents]);

	const skills = useMemo(() => {
		const telemetrySkills = data?.skills ?? [];
		if (selectedAgent === "All") return ["All", ...telemetrySkills.sort()];

		// If we have telemetry for this agent, ONLY show skills that have appeared in telemetry
		// plus any skills from ORG_MEMBERS that the user might want to see (padding).
		// BUT: if a skill is in ORG_MEMBERS but has 0 usage AND other skills HAVE usage,
		// it's likely a Zombie Skill (reassigned). We should be conservative.

		const member = ORG_MEMBERS.find((m) => m.convexAgentName === selectedAgent);
		const orgSkills = member?.profile.skills.map((s) => s.name) ?? [];

		// Senior Decision: If the agent has NO telemetry at all, show all Org skills as 0s.
		// If the agent HAS telemetry, only show the skills that are active.
		const hasAnyTelemetry = (data?.chartData.length ?? 0) > 0;

		const uniqueSkills = hasAnyTelemetry
			? Array.from(new Set(telemetrySkills))
			: Array.from(new Set([...orgSkills, ...telemetrySkills]));

		return ["All", ...uniqueSkills.sort()];
	}, [data?.skills, data?.chartData.length, selectedAgent]);

	const chartData = useMemo(() => {
		if (!data) return [];

		const telemetryData = data.chartData;
		const result = [...telemetryData];
		const resultNames = new Set(result.map((d) => d.name));

		if (selectedAgent === "All") {
			// Pad with all agents from ORG_MEMBERS
			ORG_MEMBERS.forEach((m) => {
				if (m.convexAgentName && !resultNames.has(m.convexAgentName)) {
					result.push({ name: m.convexAgentName, Input: 0, Output: 0 });
				}
			});
		} else if (selectedSkill === "All") {
			// Pad with Org skills ONLY if the agent has no telemetry at all
			const hasAnyTelemetry = telemetryData.length > 0;
			if (!hasAnyTelemetry) {
				const member = ORG_MEMBERS.find(
					(m) => m.convexAgentName === selectedAgent,
				);
				member?.profile.skills.forEach((s) => {
					if (!resultNames.has(s.name)) {
						result.push({ name: s.name, Input: 0, Output: 0 });
					}
				});
			}
		}

		// Sort: Telemetry first (descending), then alphabetical for the 0s
		return result.sort((a, b) => {
			const totalA = a.Input + a.Output;
			const totalB = b.Input + b.Output;
			if (totalA !== totalB) return totalB - totalA;
			return a.name.localeCompare(b.name);
		});
	}, [data, selectedAgent, selectedSkill]);

	return (
		<div className="org-page bg-secondary/30">
			<Header />

			<div className="org-page-content flex-col p-6 overflow-hidden">
				<div className="flex flex-col h-full max-w-[1600px] mx-auto w-full gap-6">
					{/* Top Header Section */}
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/50 shadow-sm">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-[var(--accent-orange)]/10 flex items-center justify-center text-[var(--accent-orange)]">
								<IconChartBar size={24} />
							</div>
							<div>
								<h1 className="text-lg font-bold tracking-tight text-foreground uppercase">
									Token Analytics
								</h1>
								<p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
									Usage across agents and skills
								</p>
							</div>
						</div>

						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border border-border">
								{TIME_RANGES.map((range) => (
									<button
										key={range.label}
										onClick={() => setSelectedRange(range)}
										className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest ${
											selectedRange.label === range.label
												? "bg-white text-foreground shadow-sm ring-1 ring-black/5"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										{range.label}
									</button>
								))}
							</div>
						</div>
					</div>

					{/* Filters and Main Content */}
					<div className="flex flex-1 gap-6 min-h-0">
						{/* Sidebar Filters */}
						<div className="w-72 flex flex-col gap-4 shrink-0">
							<div className="bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-white/50 shadow-sm space-y-6">
								<div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
									<IconFilter size={14} />
									Filters
								</div>

								<div className="space-y-2">
									<label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
										Agent
									</label>
									<select
										className="w-full rounded-xl border border-border bg-white/80 px-4 py-2.5 text-xs font-semibold outline-none focus:border-[var(--accent-orange)] focus:ring-4 focus:ring-[var(--accent-orange)]/5 transition-all appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:1.1em_1.1em] bg-[right_0.8em_center] bg-no-repeat"
										value={selectedAgent}
										onChange={(e) => {
											setSelectedAgent(e.target.value);
											setSelectedSkill("All");
										}}
									>
										{agents.map((agent) => (
											<option key={agent} value={agent}>
												{agent}
											</option>
										))}
									</select>
								</div>

								<div className="space-y-2">
									<label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
										Skill
									</label>
									<select
										className="w-full rounded-xl border border-border bg-white/80 px-4 py-2.5 text-xs font-semibold outline-none focus:border-[var(--accent-orange)] focus:ring-4 focus:ring-[var(--accent-orange)]/5 transition-all appearance-none disabled:opacity-50 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:1.1em_1.1em] bg-[right_0.8em_center] bg-no-repeat"
										value={selectedSkill}
										onChange={(e) => setSelectedSkill(e.target.value)}
									>
										{skills.map((skill) => (
											<option key={skill} value={skill}>
												{skill}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className="bg-[var(--accent-orange)]/5 p-5 rounded-2xl border border-[var(--accent-orange)]/10 shadow-sm flex flex-col gap-1">
								<div className="text-[10px] font-bold text-[var(--accent-orange)] uppercase tracking-widest flex items-center gap-2">
									<IconCalendarEvent size={14} />
									Period
								</div>
								<div className="text-xs font-bold text-foreground mt-1">
									{selectedRange.label === "ALL"
										? "Total History"
										: `Last ${selectedRange.label}`}
								</div>
							</div>
						</div>

						{/* Visualization Area */}
						<div className="flex-1 bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-white shadow-xl shadow-black/5 min-h-0 flex flex-col overflow-hidden">
							{data === undefined ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-6">
										<div className="relative">
											<div className="w-16 h-16 border-[5px] border-muted rounded-full" />
											<div className="absolute top-0 left-0 w-16 h-16 border-[5px] border-transparent border-t-[var(--accent-orange)] rounded-full animate-spin" />
										</div>
										<span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] animate-pulse">
											Scanning Grid...
										</span>
									</div>
								</div>
							) : chartData.length === 0 ? (
								<div className="flex flex-1 items-center justify-center text-center">
									<div className="max-w-xs space-y-4">
										<div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto text-muted-foreground">
											<IconChartBar size={32} />
										</div>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
											Intelligence feed empty.
											<br />
											Waiting for agent telemetry.
										</p>
									</div>
								</div>
							) : (
								<div className="flex-1 min-h-0">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart
											data={chartData}
											margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
										>
											<defs>
												<linearGradient
													id="inputGradient"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="0%"
														stopColor="#3B82F6"
														stopOpacity={0.9}
													/>
													<stop
														offset="100%"
														stopColor="#3B82F6"
														stopOpacity={0.6}
													/>
												</linearGradient>
												<linearGradient
													id="outputGradient"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="0%"
														stopColor="#8B5CF6"
														stopOpacity={0.9}
													/>
													<stop
														offset="100%"
														stopColor="#8B5CF6"
														stopOpacity={0.6}
													/>
												</linearGradient>
											</defs>
											<CartesianGrid
												strokeDasharray="3 3"
												vertical={false}
												stroke="#F3F4F6"
											/>
											<XAxis
												dataKey="name"
												axisLine={false}
												tickLine={false}
												tick={{
													fill: "#6B7280",
													fontSize: 10,
													fontWeight: 700,
												}}
												dy={15}
												interval={0}
												angle={-35}
												textAnchor="end"
											/>
											<YAxis
												axisLine={false}
												tickLine={false}
												tick={{
													fill: "#9CA3AF",
													fontSize: 10,
													fontWeight: 700,
												}}
												dx={-10}
											/>
											<Tooltip
												cursor={{ fill: "rgba(0,0,0,0.02)" }}
												contentStyle={{
													borderRadius: "16px",
													border: "none",
													boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
													padding: "16px",
													backgroundColor: "rgba(255, 255, 255, 0.95)",
													backdropFilter: "blur(10px)",
												}}
												itemStyle={{
													fontWeight: 700,
													fontSize: "11px",
													textTransform: "uppercase",
												}}
												labelStyle={{
													fontWeight: 800,
													marginBottom: "8px",
													color: "#111",
												}}
											/>
											<Legend
												verticalAlign="top"
												align="right"
												wrapperStyle={{ paddingBottom: "40px" }}
												iconType="circle"
												formatter={(value) => (
													<span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-4">
														{value}
													</span>
												)}
											/>
											<Bar
												dataKey="Input"
												stackId="a"
												fill="url(#inputGradient)"
												radius={[0, 0, 0, 0]}
												maxBarSize={45}
											/>
											<Bar
												dataKey="Output"
												stackId="a"
												fill="url(#outputGradient)"
												radius={[4, 4, 0, 0]}
												maxBarSize={45}
											/>
										</BarChart>
									</ResponsiveContainer>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
