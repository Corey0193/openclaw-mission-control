import { useMemo } from "react";
import { getMember } from "../../data/orgConfig";
import OrgNode from "./OrgNode";
import { computeLayout } from "./orgLayout";
import type { LayoutNode } from "./orgLayout";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── SVG connector rendering ───────────────────────────────────────────────────

const STROKE = "oklch(0.88 0 0)";
const STROKE_W = 1.5;
const ASST_STROKE = "var(--accent-orange)";

function HierarchyConnector({
	parentId,
	childIds,
	nodes,
}: {
	parentId: string;
	childIds: string[];
	nodes: Map<string, LayoutNode>;
}) {
	const parent = nodes.get(parentId);
	const children = childIds
		.map((id) => nodes.get(id))
		.filter((n): n is LayoutNode => !!n);
	if (!parent || children.length === 0) return null;

	const parentBotX = parent.x;
	const parentBotY = parent.y + parent.height;
	const firstChild = children[0];
	const midY = parentBotY + (firstChild.y - parentBotY) / 2;

	if (children.length === 1) {
		return (
			<path
				d={`M ${parentBotX} ${parentBotY} L ${parentBotX} ${midY} L ${firstChild.x} ${midY} L ${firstChild.x} ${firstChild.y}`}
				stroke={STROKE}
				strokeWidth={STROKE_W}
				fill="none"
				strokeLinecap="round"
			/>
		);
	}

	const xs = children.map((c) => c.x);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);

	return (
		<g>
			{/* Vertical stem from parent down to midpoint */}
			<line
				x1={parentBotX}
				y1={parentBotY}
				x2={parentBotX}
				y2={midY}
				stroke={STROKE}
				strokeWidth={STROKE_W}
				strokeLinecap="round"
			/>
			{/* Horizontal bar spanning all children */}
			<line
				x1={minX}
				y1={midY}
				x2={maxX}
				y2={midY}
				stroke={STROKE}
				strokeWidth={STROKE_W}
				strokeLinecap="round"
			/>
			{/* Vertical drops to each child */}
			{children.map((child) => (
				<line
					key={child.id}
					x1={child.x}
					y1={midY}
					x2={child.x}
					y2={child.y}
					stroke={STROKE}
					strokeWidth={STROKE_W}
					strokeLinecap="round"
				/>
			))}
		</g>
	);
}

function AssistantConnector({
	fromId,
	toId,
	side,
	nodes,
}: {
	fromId: string;
	toId: string;
	side: "left" | "right";
	nodes: Map<string, LayoutNode>;
}) {
	const fromNode = nodes.get(fromId);
	const toNode = nodes.get(toId);
	if (!fromNode || !toNode) return null;

	const fromCY = fromNode.y + fromNode.height / 2;
	const toCY = toNode.y + toNode.height / 2;

	const x1 =
		side === "left"
			? fromNode.x - fromNode.width / 2
			: fromNode.x + fromNode.width / 2;
	const x2 =
		side === "left"
			? toNode.x + toNode.width / 2
			: toNode.x - toNode.width / 2;

	return (
		<line
			x1={x1}
			y1={fromCY}
			x2={x2}
			y2={toCY}
			stroke={ASST_STROKE}
			strokeWidth={2}
			strokeDasharray="8 5"
			opacity={0.45}
			strokeLinecap="round"
		/>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrgTree({
	selectedId,
	onSelect,
	agentSummaries,
}: OrgTreeProps) {
	const layout = useMemo(() => computeLayout(), []);
	const { nodes, canvasWidth, canvasHeight, connectors } = layout;

	return (
		<div
			className="org-layout-canvas"
			style={{
				position: "relative",
				width: canvasWidth,
				height: canvasHeight,
				flexShrink: 0,
			}}
		>
			{/* SVG connector layer — rendered beneath nodes */}
			<svg
				width={canvasWidth}
				height={canvasHeight}
				style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
				aria-hidden="true"
			>
				{connectors.map((conn, i) => {
					if (conn.type === "hierarchy") {
						return (
							<HierarchyConnector
								key={`h-${i}`}
								parentId={conn.parentId}
								childIds={conn.childIds}
								nodes={nodes}
							/>
						);
					}
					return (
						<AssistantConnector
							key={`a-${i}`}
							fromId={conn.fromId}
							toId={conn.toId}
							side={conn.side}
							nodes={nodes}
						/>
					);
				})}
			</svg>

			{/* Absolutely positioned nodes */}
			{Array.from(nodes.values()).map((node) => {
				const member = getMember(node.id);
				if (!member) return null;

				let status: AgentStatus | undefined;
				if (member.convexAgentName) {
					const summary = agentSummaries.find(
						(s) => s.name === member.convexAgentName,
					);
					status = (summary?.status as AgentStatus) ?? "idle";
				}

				return (
					<div
						key={node.id}
						style={{
							position: "absolute",
							left: node.x - node.width / 2,
							top: node.y,
							width: node.width,
						}}
					>
						<OrgNode
							member={member}
							isSelected={selectedId === node.id}
							onSelect={onSelect}
							status={status}
							depth={node.depth}
						/>
					</div>
				);
			})}
		</div>
	);
}
