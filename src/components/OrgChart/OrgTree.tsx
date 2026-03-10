import {
	ORG_MEMBERS,
	getChildren,
	getAssistants,
	type OrgMember,
} from "../../data/orgConfig";
import OrgNode from "./OrgNode";

type AgentStatus = "active" | "idle" | "blocked";

export interface AgentSummary {
	name: string;
	status: string;
	currentTaskTitle?: string | null;
	recentActivityCount?: number;
	latestActivityMessage?: string | null;
	latestActivityTime?: number | null;
}

interface OrgTreeProps {
	selectedId: string | null;
	onSelect: (id: string) => void;
	agentSummaries: AgentSummary[];
}

function getStatusForMember(
	member: OrgMember,
	agentSummaries: AgentSummary[],
): AgentStatus | undefined {
	if (!member.convexAgentName) return undefined;
	const summary = agentSummaries.find((s) => s.name === member.convexAgentName);
	return (summary?.status as AgentStatus) ?? "idle";
}

/** Renders a single level: the member node, any assistants, then recurses into children */
function OrgLevel({
	member,
	selectedId,
	onSelect,
	agentSummaries,
	depth,
}: {
	member: OrgMember;
	selectedId: string | null;
	onSelect: (id: string) => void;
	agentSummaries: AgentSummary[];
	depth: number;
}) {
	const children = getChildren(member.id);
	const assistants = getAssistants(member.id);
	const leftAssistants = assistants.filter((a) => a.assistantSide === "left");
	const rightAssistants = assistants.filter((a) => a.assistantSide !== "left");

	return (
		<div className="flex flex-col items-center">
			{/* This level's node + assistants */}
			<div className="flex items-start gap-10">
				{/* Left assistants (or spacer to balance right-only assistants) */}
				{leftAssistants.length > 0
					? leftAssistants.map((asst) => (
							<div key={asst.id} className="flex items-start gap-0">
								<OrgLevel
									member={asst}
									selectedId={selectedId}
									onSelect={onSelect}
									agentSummaries={agentSummaries}
									depth={depth + 1}
								/>
								{/* Dashed connector line — vertically centered on the top node */}
								<div className="mt-12 w-10 border-t-[3px] border-dashed border-[var(--accent-orange)]/40" />
							</div>
						))
					: rightAssistants.length > 0 && <div className="w-[200px]" />}

				<OrgNode
					member={member}
					isSelected={selectedId === member.id}
					onSelect={onSelect}
					status={getStatusForMember(member, agentSummaries)}
					depth={depth}
				/>

				{/* Right assistants (or spacer to balance left-only assistants) */}
				{rightAssistants.length > 0
					? rightAssistants.map((asst) => (
							<div key={asst.id} className="flex items-start gap-0">
								{/* Dashed connector line — vertically centered on the top node */}
								<div className="mt-12 w-10 border-t-[3px] border-dashed border-[var(--accent-orange)]/40" />
								<OrgLevel
									member={asst}
									selectedId={selectedId}
									onSelect={onSelect}
									agentSummaries={agentSummaries}
									depth={depth + 1}
								/>
							</div>
						))
					: leftAssistants.length > 0 && <div className="w-[200px]" />}
			</div>

			{/* Connector down + children */}
			{children.length > 0 && (
				<>
					{/* Vertical connector stem */}
					<div className="org-connector-stem" />

					{/* If multiple children, horizontal bar + vertical drops */}
					{children.length > 1 ? (
						<div className="org-connector-row">
							{children.map((child, i) => (
								<div key={child.id} className="flex flex-col items-center">
									{/* Vertical drop from horizontal bar */}
									<div className="org-connector-drop" />
									<OrgLevel
										member={child}
										selectedId={selectedId}
										onSelect={onSelect}
										agentSummaries={agentSummaries}
										depth={depth + 1}
									/>
									{/* Horizontal segment (rendered via CSS on the row) */}
									{i < children.length - 1 && null}
								</div>
							))}
						</div>
					) : (
						/* Single child — just continue the vertical line */
						<OrgLevel
							member={children[0]}
							selectedId={selectedId}
							onSelect={onSelect}
							agentSummaries={agentSummaries}
							depth={depth + 1}
						/>
					)}
				</>
			)}
		</div>
	);
}

export default function OrgTree({
	selectedId,
	onSelect,
	agentSummaries,
}: OrgTreeProps) {
	const root = ORG_MEMBERS.find((m) => m.reportsTo === null && !m.assistantTo);
	if (!root) return null;

	return (
		<div className="org-tree">
			<OrgLevel
				member={root}
				selectedId={selectedId}
				onSelect={onSelect}
				agentSummaries={agentSummaries}
				depth={0}
			/>
		</div>
	);
}
