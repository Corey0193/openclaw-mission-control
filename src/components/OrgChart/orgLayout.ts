/**
 * Org chart layout engine — Reingold-Tilford style.
 *
 * Computes absolute (x, y) positions for every node so that:
 *   - Each node is horizontally centered over its subtree
 *   - No two subtrees overlap at any depth
 *   - Assistant nodes (Hustle, Einstein) are placed to the sides of the root
 *     with enough clearance for their own subtrees
 */

import {
	ORG_MEMBERS,
	getChildren,
	getAssistants,
	type OrgMember,
} from "../../data/orgConfig";

// ── Node sizes by depth ───────────────────────────────────────────────────────
// Heights are slightly generous so connector lines never overlap node bodies.
const SIZES: ReadonlyArray<{ width: number; height: number }> = [
	{ width: 220, height: 164 }, // depth 0 – root (President)
	{ width: 200, height: 152 }, // depth 1 – C-suite / assistants
	{ width: 180, height: 140 }, // depth 2+ – workers
];

const H_GAP = 40; // px between sibling subtrees
const V_GAP = 56; // px from bottom of parent to top of child
const ASST_H_GAP = 56; // px between assistant subtree edge and main tree edge
const PADDING = 48; // canvas outer padding

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LayoutNode {
	id: string;
	x: number; // horizontal center
	y: number; // top edge
	width: number;
	height: number;
	depth: number;
	isAssistant: boolean;
}

export interface HierarchyConnector {
	type: "hierarchy";
	parentId: string;
	childIds: string[];
}

export interface AssistantConnector {
	type: "assistant";
	fromId: string;
	toId: string;
	side: "left" | "right";
}

export type Connector = HierarchyConnector | AssistantConnector;

export interface OrgLayout {
	nodes: Map<string, LayoutNode>;
	canvasWidth: number;
	canvasHeight: number;
	connectors: Connector[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sizeAt(depth: number) {
	return SIZES[Math.min(depth, SIZES.length - 1)];
}

/**
 * Returns the minimum horizontal space needed to render a subtree rooted at
 * `member` at the given depth without any internal overlaps.
 */
function subtreeWidth(member: OrgMember, depth: number): number {
	const children = getChildren(member.id);
	const { width } = sizeAt(depth);
	if (children.length === 0) return width;
	const childrenTotalWidth =
		children.reduce((sum, c) => sum + subtreeWidth(c, depth + 1), 0) +
		(children.length - 1) * H_GAP;
	return Math.max(width, childrenTotalWidth);
}

/**
 * Recursively places a subtree rooted at `member`.
 * `centerX` is the horizontal center of this node's subtree.
 * `topY` is the top edge of this node.
 */
function placeSubtree(
	member: OrgMember,
	centerX: number,
	topY: number,
	depth: number,
	nodes: Map<string, LayoutNode>,
	connectors: Connector[],
	isAssistant: boolean,
): void {
	const { width, height } = sizeAt(depth);
	nodes.set(member.id, {
		id: member.id,
		x: centerX,
		y: topY,
		width,
		height,
		depth,
		isAssistant,
	});

	const children = getChildren(member.id);
	if (children.length === 0) return;

	connectors.push({
		type: "hierarchy",
		parentId: member.id,
		childIds: children.map((c) => c.id),
	});

	const childDepth = depth + 1;
	const childY = topY + height + V_GAP;
	const childWidths = children.map((c) => subtreeWidth(c, childDepth));
	const totalChildrenWidth =
		childWidths.reduce((a, b) => a + b, 0) + (children.length - 1) * H_GAP;

	let startX = centerX - totalChildrenWidth / 2;
	for (let i = 0; i < children.length; i++) {
		const childCenter = startX + childWidths[i] / 2;
		placeSubtree(
			children[i],
			childCenter,
			childY,
			childDepth,
			nodes,
			connectors,
			false,
		);
		startX += childWidths[i] + H_GAP;
	}
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeLayout(): OrgLayout {
	const root = ORG_MEMBERS.find((m) => m.reportsTo === null && !m.assistantTo);
	if (!root) {
		return {
			nodes: new Map(),
			canvasWidth: 0,
			canvasHeight: 0,
			connectors: [],
		};
	}

	const leftAsstList = getAssistants(root.id).filter(
		(a) => a.assistantSide === "left",
	);
	const rightAsstList = getAssistants(root.id).filter(
		(a) => a.assistantSide !== "left",
	);

	// Compute horizontal footprint for each region
	const mainWidth = subtreeWidth(root, 0);

	const leftAsstWidths = leftAsstList.map((a) => subtreeWidth(a, 1));
	const leftTotalWidth =
		leftAsstWidths.length > 0
			? leftAsstWidths.reduce((a, b) => a + b, 0) +
				(leftAsstWidths.length - 1) * H_GAP +
				ASST_H_GAP
			: 0;

	const rightAsstWidths = rightAsstList.map((a) => subtreeWidth(a, 1));
	const rightTotalWidth =
		rightAsstWidths.length > 0
			? rightAsstWidths.reduce((a, b) => a + b, 0) +
				(rightAsstWidths.length - 1) * H_GAP +
				ASST_H_GAP
			: 0;

	const canvasWidth =
		PADDING + leftTotalWidth + mainWidth + rightTotalWidth + PADDING;

	const nodes = new Map<string, LayoutNode>();
	const connectors: Connector[] = [];

	// Place main tree
	const mainCenterX = PADDING + leftTotalWidth + mainWidth / 2;
	const topY = PADDING;
	placeSubtree(root, mainCenterX, topY, 0, nodes, connectors, false);

	// Vertical centering: assistants align their center with the root's center
	const rootCenterY = topY + sizeAt(0).height / 2;

	// Place left assistants
	let leftX = PADDING;
	for (let i = 0; i < leftAsstList.length; i++) {
		const asst = leftAsstList[i];
		const asstSize = sizeAt(1);
		const asstCenterX = leftX + leftAsstWidths[i] / 2;
		const asstY = rootCenterY - asstSize.height / 2;
		connectors.push({
			type: "assistant",
			fromId: root.id,
			toId: asst.id,
			side: "left",
		});
		placeSubtree(asst, asstCenterX, asstY, 1, nodes, connectors, true);
		leftX += leftAsstWidths[i] + H_GAP;
	}

	// Place right assistants
	let rightX = PADDING + leftTotalWidth + mainWidth + ASST_H_GAP;
	for (let i = 0; i < rightAsstList.length; i++) {
		const asst = rightAsstList[i];
		const asstSize = sizeAt(1);
		const asstCenterX = rightX + rightAsstWidths[i] / 2;
		const asstY = rootCenterY - asstSize.height / 2;
		connectors.push({
			type: "assistant",
			fromId: root.id,
			toId: asst.id,
			side: "right",
		});
		placeSubtree(asst, asstCenterX, asstY, 1, nodes, connectors, true);
		rightX += rightAsstWidths[i] + H_GAP;
	}

	// Canvas height = deepest node bottom + padding
	let maxBottom = 0;
	for (const node of nodes.values()) {
		maxBottom = Math.max(maxBottom, node.y + node.height);
	}
	const canvasHeight = maxBottom + PADDING;

	return { nodes, canvasWidth, canvasHeight, connectors };
}
