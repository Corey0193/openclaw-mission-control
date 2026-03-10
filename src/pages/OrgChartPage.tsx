import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { ORG_MEMBERS, getMember } from "../data/orgConfig";
import Header from "../components/Header";
import OrgTree from "../components/OrgChart/OrgTree";
import PanZoomCanvas from "../components/OrgChart/PanZoomCanvas";
import AgentProfilePanel from "../components/OrgChart/AgentProfilePanel";
import type { AgentSummary } from "../components/OrgChart/OrgTree";

export default function OrgChartPage() {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const selectedMember = selectedId ? getMember(selectedId) : null;

	const rawSummaries = useQuery(api.queries.getAgentSummaries, {
		tenantId: DEFAULT_TENANT_ID,
	});

	const agentSummaries: AgentSummary[] = (rawSummaries ?? []).map((s) => ({
		name: s.name,
		status: s.status,
		currentTaskTitle: s.currentTaskTitle,
		recentActivityCount: s.recentActivityCount,
		latestActivityMessage: s.latestActivityMessage,
		latestActivityTime: s.latestActivityTime,
	}));

	const selectedSummary = selectedMember?.convexAgentName
		? agentSummaries.find((s) => s.name === selectedMember.convexAgentName)
		: undefined;

	return (
		<div className="org-page">
			<Header />

			<div className="org-page-content">
				<div className="org-page-tree">
					<div className="px-6 py-4 border-b border-border">
						<h2 className="text-sm font-semibold tracking-wide text-foreground">
							CB HOLDINGS
						</h2>
						<p className="text-[11px] text-muted-foreground mt-0.5">
							{ORG_MEMBERS.length} team members
						</p>
					</div>
					<PanZoomCanvas>
						<OrgTree
							selectedId={selectedId}
							onSelect={setSelectedId}
							agentSummaries={agentSummaries}
						/>
					</PanZoomCanvas>
				</div>

				{selectedMember && (
					<AgentProfilePanel
						member={selectedMember}
						agentSummary={selectedSummary}
						onClose={() => setSelectedId(null)}
					/>
				)}
			</div>
		</div>
	);
}
