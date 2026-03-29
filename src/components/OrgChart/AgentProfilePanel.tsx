import { IconX } from "@tabler/icons-react";
import type { OrgMember } from "../../data/orgConfig";
import type { AgentSummary } from "./OrgTree";

interface AgentProfilePanelProps {
	member: OrgMember;
	agentSummary?: AgentSummary;
	onClose: () => void;
}

export default function AgentProfilePanel({
	member,
	agentSummary,
	onClose,
}: AgentProfilePanelProps) {
	const statusColor =
		agentSummary?.status === "active"
			? "bg-[var(--status-working)]"
			: agentSummary?.status === "blocked"
				? "bg-[var(--accent-red)]"
				: "bg-muted-foreground";

	const statusLabel = agentSummary?.status?.toUpperCase() ?? "HUMAN";

	return (
		<div className="w-[380px] shrink-0 border-l border-border bg-white h-full overflow-y-auto">
			<div className="p-5">
				{/* Header */}
				<div className="flex items-start justify-between mb-5">
					<div className="flex items-center gap-3">
						<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl">
							{member.avatar}
						</div>
						<div>
							<h2 className="text-base font-semibold text-foreground">
								{member.name}
							</h2>
							<p className="text-xs text-muted-foreground">{member.title}</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
					>
						<IconX size={16} />
					</button>
				</div>

				{/* Status badge */}
				<div className="flex items-center gap-2 mb-5">
					<span className={`w-2 h-2 rounded-full ${statusColor}`} />
					<span className="text-[10px] font-bold tracking-widest text-muted-foreground">
						{statusLabel}
					</span>
				</div>

				{/* Live Status Box (agents only) */}
				{agentSummary && (
					<div className="bg-muted/50 rounded-lg p-3 mb-5">
						<div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase mb-2">
							Live Status
						</div>
						<div className="space-y-1.5">
							{agentSummary.currentTaskTitle && (
								<div className="text-xs text-foreground">
									<span className="text-muted-foreground">Current task: </span>
									{agentSummary.currentTaskTitle}
								</div>
							)}
							<div className="text-xs text-foreground">
								<span className="text-muted-foreground">Activity (24h): </span>
								{agentSummary.recentActivityCount ?? 0} events
							</div>
							{agentSummary.latestActivityMessage && (
								<div className="text-xs text-foreground">
									<span className="text-muted-foreground">Latest: </span>
									<span className="line-clamp-2">
										{agentSummary.latestActivityMessage}
									</span>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Role */}
				<section className="mb-5">
					<div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase mb-2">
						Role
					</div>
					<div className="bg-muted/50 rounded-lg p-3">
						<p className="text-xs text-foreground leading-relaxed">
							{member.profile.role}
						</p>
					</div>
				</section>

				{/* Responsibilities */}
				<section className="mb-5">
					<div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase mb-2">
						Responsibilities
					</div>
					<div className="bg-muted/50 rounded-lg p-3">
						<ul className="space-y-1">
							{member.profile.responsibilities.map((r) => (
								<li
									key={r}
									className="text-xs text-foreground flex items-start gap-2"
								>
									<span className="text-muted-foreground mt-0.5 shrink-0">
										&bull;
									</span>
									{r}
								</li>
							))}
						</ul>
					</div>
				</section>

				{/* LLM Model */}
				{member.model && (
					<section className="mb-5">
						<div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase mb-2">
							LLM Model
						</div>
						<div className="flex items-center gap-2 flex-wrap">
							<div className="flex items-center gap-1.5">
								<span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
									Primary
								</span>
								<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
									{member.model.primary}
								</span>
							</div>
							<span className="text-muted-foreground text-[10px]">/</span>
							<div className="flex items-center gap-1.5">
								<span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
									Fallback
								</span>
								<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
									{member.model.fallback}
								</span>
							</div>
						</div>
					</section>
				)}

				{/* Skills */}
				<section className="mb-5">
					<div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase mb-2">
						Skills
						{member.profile.skills.length > 0 && (
							<span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground">
								({member.profile.skills.length})
							</span>
						)}
					</div>
					{member.profile.skills.length === 0 ? (
						<p className="text-xs text-muted-foreground italic">
							No skills configured
						</p>
					) : (
						<div className="bg-muted/50 rounded-lg overflow-hidden divide-y divide-border">
							{member.profile.skills.map((s) => {
								const modelLabel = s.model ?? member.model?.primary;
								const isOverride = !!s.model;
								return (
									<div
										key={s.name}
										className="flex items-center justify-between px-3 py-1.5 gap-2"
									>
										<span className="text-xs text-foreground">{s.name}</span>
										{modelLabel && (
											<span
												className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap border ${
													isOverride
														? "bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] border-[var(--accent-orange)]/20"
														: "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20"
												}`}
											>
												{modelLabel}
											</span>
										)}
									</div>
								);
							})}
						</div>
					)}
				</section>

				{/* Character */}
				<section className="mb-5">
					<div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase mb-2">
						Character
					</div>
					<div className="bg-muted/50 rounded-lg p-3">
						<p className="text-xs text-foreground leading-relaxed">
							{member.profile.personality}
						</p>
					</div>
				</section>

				{/* Backstory */}
				<section>
					<div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase mb-2">
						Backstory
					</div>
					<div className="bg-muted/50 rounded-lg p-3">
						<p className="text-xs text-foreground leading-relaxed">
							{member.profile.backstory}
						</p>
					</div>
				</section>
			</div>
		</div>
	);
}
