import type { OrgMember } from "../../data/orgConfig";

type AgentStatus = "active" | "idle" | "blocked";

interface OrgNodeProps {
	member: OrgMember;
	isSelected: boolean;
	onSelect: (id: string) => void;
	status?: AgentStatus;
	depth: number;
}

export default function OrgNode({
	member,
	isSelected,
	onSelect,
	status,
	depth,
}: OrgNodeProps) {
	const statusColor =
		status === "active"
			? "bg-[var(--status-working)]"
			: status === "blocked"
				? "bg-[var(--accent-red)]"
				: "bg-muted-foreground";

	const statusLabel =
		status === "active"
			? "Active"
			: status === "blocked"
				? "Blocked"
				: status === "idle"
					? "Idle"
					: null;

	// Tier-based sizing
	const isRoot = depth === 0;
	const isExecutive = depth === 1;

	const sizeClasses = isRoot
		? "w-[220px] px-8 py-7"
		: isExecutive
			? "w-[200px] px-7 py-6"
			: "w-[180px] px-6 py-5";

	const avatarSize = isRoot
		? "text-5xl"
		: isExecutive
			? "text-4xl"
			: "text-3xl";
	const nameSize = isRoot
		? "text-base"
		: isExecutive
			? "text-sm"
			: "text-[13px]";
	const titleSize = isRoot ? "text-xs" : "text-[11px]";
	const dotSize = isRoot
		? "w-3.5 h-3.5 -bottom-0.5 -right-1.5"
		: "w-3 h-3 -bottom-0.5 -right-1";

	const selectedStyles = isSelected
		? "border-[var(--accent-orange)] bg-[var(--accent-orange)]/5 shadow-lg scale-[1.03]"
		: "border-border bg-white hover:border-[var(--accent-orange)]/40 hover:shadow-md";

	return (
		<button
			type="button"
			onClick={() => onSelect(member.id)}
			className={`
				flex flex-col items-center gap-2.5 rounded-2xl border-2 transition-all cursor-pointer
				${sizeClasses} ${selectedStyles}
			`}
		>
			<div className="relative">
				<span className={`${avatarSize} leading-none`}>{member.avatar}</span>
				{member.convexAgentName && (
					<span
						className={`absolute rounded-full border-2 border-white ${statusColor} ${dotSize}`}
					/>
				)}
			</div>
			<div className="text-center">
				<div
					className={`${nameSize} font-semibold text-foreground leading-tight`}
				>
					{member.name}
				</div>
				<div className={`${titleSize} text-muted-foreground leading-snug mt-1`}>
					{member.title}
				</div>
			</div>
			{member.convexAgentName && statusLabel && (
				<div className="flex items-center gap-1.5">
					<span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
					<span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
						{statusLabel}
					</span>
				</div>
			)}
		</button>
	);
}
