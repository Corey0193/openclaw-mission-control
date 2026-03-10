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
	const hasAssistants = leftAssistants.length > 0 || rightAssistants.length > 0;

	return (
		<div className="flex flex-col items-center">
			{/* This level's node + assistants */}
			{hasAssistants ? (
				<div className="relative flex items-start justify-center">
					{/* Left assistants — absolutely positioned to the left of the node */}
					{leftAssistants.map((asst) => (
						<div
							key={asst.id}
							className="absolute right-full top-0 flex items-start mr-0"
						>
							<div className="flex flex-col items-end">
								<OrgLevel
									member={asst}
									selectedId={selectedId}
									onSelect={onSelect}
									agentSummaries={agentSummaries}
									depth={depth + 1}
								/>
							</div>
							{/* Dashed connector line */}
							<div className="mt-12 w-10 border-t-[3px] border-dashed border-[var(--accent-orange)]/40" />
						</div>
					))}

					<OrgNode
						member={member}
						isSelected={selectedId === member.id}
						onSelect={onSelect}
						status={getStatusForMember(member, agentSummaries)}
						depth={depth}
					/>

					{/* Right assistants — absolutely positioned to the right of the node */}
					{rightAssistants.map((asst) => (
						<div
							key={asst.id}
							className="absolute left-full top-0 flex items-start ml-0"
						>
							{/* Dashed connector line */}
							<div className="mt-12 w-10 border-t-[3px] border-dashed border-[var(--accent-orange)]/40" />
							<div className="flex flex-col items-start">
								<OrgLevel
									member={asst}
									selectedId={selectedId}
									onSelect={onSelect}
									agentSummaries={agentSummaries}
									depth={depth + 1}
								/>
							</div>
						</div>
					))}
				</div>
			) : (
				<OrgNode
					member={member}
					isSelected={selectedId === member.id}
					onSelect={onSelect}
					status={getStatusForMember(member, agentSummaries)}
					depth={depth}
				/>
			)}

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
