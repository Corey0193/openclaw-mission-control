import { useState, useEffect, useCallback } from "react";
import Header from "../components/Header";
import {
	IconRefresh,
	IconTrash,
	IconUser,
	IconAlertCircle,
} from "@tabler/icons-react";

interface Todo {
	blockId: string;
	checked: boolean;
	priority: "P1" | "P2" | "P3";
	description: string;
	due?: string;
	delegatedTo?: string;
	delegatedAt?: string;
	status?: string;
	section: "active" | "waiting" | "upcoming" | "someday" | "completed";
}

type SectionKey = Todo["section"];

const SECTION_META: Record<
	SectionKey,
	{ label: string; color: string; emptyText: string }
> = {
	active: {
		label: "Active",
		color: "#54a0ff",
		emptyText: "No active tasks",
	},
	waiting: {
		label: "Waiting",
		color: "#ff9f43",
		emptyText: "Nothing delegated",
	},
	upcoming: {
		label: "Upcoming",
		color: "#1dd1a1",
		emptyText: "Nothing scheduled",
	},
	someday: {
		label: "Someday",
		color: "#a29bfe",
		emptyText: "Backlog is clear",
	},
	completed: {
		label: "Completed",
		color: "#b2bec3",
		emptyText: "Nothing completed yet",
	},
};

const PRIORITY_CONFIG: Record<
	string,
	{ label: string; bg: string; text: string }
> = {
	P1: { label: "P1", bg: "#ee5253", text: "#fff" },
	P2: { label: "P2", bg: "#ff9f43", text: "#fff" },
	P3: { label: "P3", bg: "#54a0ff", text: "#fff" },
};

function getDueBadge(due: string): { label: string; className: string } | null {
	if (due === "today")
		return { label: "Today", className: "bg-red-100 text-red-700" };
	if (due === "tomorrow")
		return { label: "Tomorrow", className: "bg-orange-100 text-orange-700" };

	const parsed = new Date(due + "T00:00:00");
	if (isNaN(parsed.getTime())) return null;

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const dueDay = new Date(
		parsed.getFullYear(),
		parsed.getMonth(),
		parsed.getDate(),
	);
	const diffDays = (dueDay.getTime() - today.getTime()) / 86400000;
	const label = parsed.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});

	if (diffDays < 0) return { label, className: "bg-red-100 text-red-700" };
	if (diffDays <= 2)
		return { label, className: "bg-orange-100 text-orange-700" };
	return { label, className: "bg-muted text-muted-foreground" };
}

function formatLastFetched(date: Date): string {
	const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
	if (diffSec < 10) return "Just now";
	if (diffSec < 60) return `${diffSec}s ago`;
	const diffMin = Math.floor(diffSec / 60);
	return diffMin === 1 ? "1 min ago" : `${diffMin} min ago`;
}

function formatDelegatedAge(delegatedAt: string): string {
	const days = Math.floor(
		(Date.now() - new Date(delegatedAt).getTime()) / 86400000,
	);
	if (days === 0) return "today";
	if (days === 1) return "1d ago";
	return `${days}d ago`;
}

function SkeletonRow({ width }: { width: string }) {
	return (
		<div className="flex items-center gap-2.5 px-3 py-2.5 animate-pulse">
			<div className="w-4 h-4 rounded bg-muted shrink-0" />
			<div className="w-7 h-4 rounded bg-muted shrink-0" />
			<div className="h-3.5 rounded bg-muted" style={{ width }} />
		</div>
	);
}

function SectionHeader({
	sectionKey,
	count,
}: {
	sectionKey: SectionKey;
	count: number;
}) {
	const meta = SECTION_META[sectionKey];
	return (
		<div className="flex items-center gap-2.5 mb-1">
			<div
				className="w-[3px] h-[14px] rounded-full shrink-0"
				style={{ backgroundColor: meta.color }}
			/>
			<span
				className="text-[11px] font-bold tracking-widest uppercase"
				style={{ color: meta.color }}
			>
				{meta.label}
			</span>
			<span
				className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
				style={{
					backgroundColor: `${meta.color}1a`,
					color: meta.color,
				}}
			>
				{count}
			</span>
		</div>
	);
}

interface TodoItemProps {
	todo: Todo;
	isPending: boolean;
	isStaleDelegate: boolean;
	onComplete: () => void;
	onDelete: () => void;
	compact?: boolean;
}

function TodoItem({
	todo,
	isPending,
	isStaleDelegate,
	onComplete,
	onDelete,
	compact = false,
}: TodoItemProps) {
	const priority = PRIORITY_CONFIG[todo.priority] ?? PRIORITY_CONFIG.P3;
	const dueBadge = todo.due ? getDueBadge(todo.due) : null;
	const isCompleted = todo.section === "completed" || todo.checked;

	return (
		<div
			className={`group flex items-center gap-2.5 rounded-lg border transition-all duration-150 ${
				compact
					? "px-2 py-1.5 opacity-60 text-[13px] scale-[0.99] origin-left bg-muted/20"
					: "px-3 py-2"
			} ${isPending ? "opacity-40 pointer-events-none" : ""} ${
				isStaleDelegate
					? "bg-orange-50/60 border-orange-200/70"
					: "border-transparent hover:bg-muted/50 hover:border-border/50"
			} ${isCompleted ? "opacity-60" : ""}`}
		>
			{/* Checkbox */}
			<input
				type="checkbox"
				checked={todo.checked}
				onChange={() => {
					if (!todo.checked) onComplete();
				}}
				className="w-4 h-4 rounded border-border cursor-pointer shrink-0 accent-[var(--accent-orange)]"
			/>

			{/* Priority pill */}
			<span
				className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 leading-none"
				style={{
					backgroundColor: isCompleted ? "var(--muted)" : priority.bg,
					color: isCompleted ? "var(--muted-foreground)" : priority.text,
				}}
			>
				{priority.label}
			</span>

			{/* Description */}
			<span
				className={`text-sm flex-1 leading-snug ${
					isCompleted ? "line-through text-muted-foreground" : "text-foreground"
				}`}
			>
				{todo.description}
			</span>

			{/* Delegation info */}
			{todo.delegatedTo && (
				<span
					className={`flex items-center gap-1 text-[11px] shrink-0 ${
						isStaleDelegate
							? "text-orange-600 font-semibold"
							: "text-muted-foreground"
					}`}
				>
					<IconUser size={11} className="shrink-0" />
					<span>{todo.delegatedTo}</span>
					{todo.delegatedAt && (
						<span className="opacity-70">
							· {formatDelegatedAge(todo.delegatedAt)}
						</span>
					)}
				</span>
			)}

			{/* Due badge */}
			{dueBadge && (
				<span
					className={`text-[11px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${dueBadge.className}`}
				>
					{dueBadge.label}
				</span>
			)}

			{/* Delete */}
			<button
				type="button"
				onClick={onDelete}
				className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-[var(--accent-red)] shrink-0 p-1 rounded"
				title="Delete task"
			>
				<IconTrash size={13} />
			</button>
		</div>
	);
}

function TodoSection({
	sectionKey,
	todos,
	pendingActions,
	onComplete,
	onDelete,
}: {
	sectionKey: SectionKey;
	todos: Todo[];
	pendingActions: Set<string>;
	onComplete: (id: string) => void;
	onDelete: (id: string) => void;
}) {
	const [showChecked, setShowChecked] = useState(false);
	// eslint-disable-next-line react-hooks/purity
	const now = Date.now();
	const meta = SECTION_META[sectionKey];

	// Ensure main completed section behaves fully transparently
	const isCompletedSection = sectionKey === "completed";
	const activeTasks = isCompletedSection ? [] : todos.filter((t) => !t.checked);
	const checkedTasks = isCompletedSection
		? todos
		: todos.filter((t) => t.checked);

	return (
		<div>
			<SectionHeader sectionKey={sectionKey} count={todos.length} />
			<div
				className="mb-2 h-px"
				style={{
					background: `linear-gradient(to right, ${meta.color}30, transparent)`,
				}}
			/>

			{todos.length === 0 ? (
				<p className="text-xs text-muted-foreground pl-5 py-1">
					{meta.emptyText}
				</p>
			) : (
				<div className="space-y-0.5">
					{/* Active tasks */}
					{activeTasks.map((todo) => {
						const isPending = pendingActions.has(todo.blockId);
						const isStaleDelegate =
							sectionKey === "waiting" &&
							!!todo.delegatedAt &&
							(now - new Date(todo.delegatedAt).getTime()) / 86400000 >= 5;

						return (
							<TodoItem
								key={todo.blockId}
								todo={todo}
								isPending={isPending}
								isStaleDelegate={isStaleDelegate}
								onComplete={() => onComplete(todo.blockId)}
								onDelete={() => onDelete(todo.blockId)}
							/>
						);
					})}

					{/* Checked tasks toggle & list */}
					{checkedTasks.length > 0 && !isCompletedSection && (
						<div className="pt-2 pb-1 pl-2">
							<button
								type="button"
								onClick={() => setShowChecked(!showChecked)}
								className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
							>
								<span className="opacity-70">{showChecked ? "▼" : "▶"}</span>
								{showChecked ? "Hide" : "Show"} {checkedTasks.length} completed{" "}
								{checkedTasks.length === 1 ? "task" : "tasks"}
							</button>
						</div>
					)}

					{(!isCompletedSection ? showChecked : true) &&
						checkedTasks.map((todo) => {
							const isPending = pendingActions.has(todo.blockId);
							const isStaleDelegate =
								sectionKey === "waiting" &&
								!!todo.delegatedAt &&
								(now - new Date(todo.delegatedAt).getTime()) / 86400000 >= 5;

							return (
								<TodoItem
									key={todo.blockId}
									todo={todo}
									isPending={isPending}
									isStaleDelegate={isStaleDelegate}
									onComplete={() => onComplete(todo.blockId)}
									onDelete={() => onDelete(todo.blockId)}
									compact={!isCompletedSection}
								/>
							);
						})}
				</div>
			)}
		</div>
	);
}

export default function EinsteinTodosPage() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [lastFetched, setLastFetched] = useState<Date | null>(null);
	const [showSomeday, setShowSomeday] = useState(false);
	const [showCompleted, setShowCompleted] = useState(false);
	const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

	const fetchTodos = useCallback(async () => {
		try {
			const res = await fetch("/api/todos");
			const data = (await res.json()) as {
				todos: Todo[];
				error?: string;
			};
			setTodos(data.todos ?? []);
			setError(data.error ?? null);
			setLastFetched(new Date());
		} catch {
			setError("Failed to fetch todos");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchTodos();
		const interval = setInterval(() => void fetchTodos(), 30000);
		return () => clearInterval(interval);
	}, [fetchTodos]);

	const handleComplete = async (blockId: string) => {
		setTodos((prev) =>
			prev.map((t) => (t.blockId === blockId ? { ...t, checked: true } : t)),
		);
		setPendingActions((prev) => new Set(prev).add(blockId));
		try {
			await fetch(`/api/todos/${blockId}/complete`, { method: "POST" });
		} finally {
			setPendingActions((prev) => {
				const next = new Set(prev);
				next.delete(blockId);
				return next;
			});
			await fetchTodos();
		}
	};

	const handleDelete = async (blockId: string) => {
		setTodos((prev) => prev.filter((t) => t.blockId !== blockId));
		setPendingActions((prev) => new Set(prev).add(blockId));
		try {
			await fetch(`/api/todos/${blockId}`, { method: "DELETE" });
		} finally {
			setPendingActions((prev) => {
				const next = new Set(prev);
				next.delete(blockId);
				return next;
			});
			await fetchTodos();
		}
	};

	const p1Count = todos.filter(
		(t) =>
			!t.checked &&
			t.priority === "P1" &&
			["active", "waiting", "upcoming"].includes(t.section),
	).length;

	const activeTodos = todos.filter((t) => t.section === "active");
	const waitingTodos = todos.filter((t) => t.section === "waiting");
	const staleWaiting = waitingTodos.filter(
		(t) =>
			t.delegatedAt &&
			(Date.now() - new Date(t.delegatedAt).getTime()) / 86400000 >= 5,
	).length;

	const sectionsToShow: SectionKey[] = ["active", "waiting", "upcoming"];
	if (showSomeday) sectionsToShow.push("someday");
	if (showCompleted) sectionsToShow.push("completed");

	return (
		<div className="org-page">
			<Header />

			<div className="[grid-area:content] flex flex-col overflow-hidden bg-background">
				{/* Sub-header */}
				<div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-white shrink-0">
					<span className="text-lg">🧠</span>
					<h2 className="text-sm font-semibold text-foreground">
						Einstein To-Dos
					</h2>

					{/* Stats pills */}
					<div className="flex items-center gap-1.5">
						{p1Count > 0 && (
							<span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-red)] text-white">
								<IconAlertCircle size={11} />
								{p1Count} P1
							</span>
						)}
						{staleWaiting > 0 && (
							<span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
								{staleWaiting} stale
							</span>
						)}
					</div>

					<div className="flex-1" />

					{/* Sync info */}
					{lastFetched && (
						<span className="text-[11px] text-muted-foreground">
							{formatLastFetched(lastFetched)}
						</span>
					)}

					{/* Refresh */}
					<button
						type="button"
						onClick={() => void fetchTodos()}
						className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors text-muted-foreground"
						title="Refresh"
					>
						<IconRefresh size={14} />
					</button>

					{/* Divider */}
					<div className="w-px h-4 bg-border" />

					{/* Toggles */}
					<button
						type="button"
						onClick={() => setShowSomeday((v) => !v)}
						className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
							showSomeday
								? "bg-[#a29bfe1a] text-[#a29bfe]"
								: "text-muted-foreground hover:bg-muted"
						}`}
					>
						Someday
					</button>
					<button
						type="button"
						onClick={() => setShowCompleted((v) => !v)}
						className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
							showCompleted
								? "bg-muted text-foreground"
								: "text-muted-foreground hover:bg-muted"
						}`}
					>
						Completed
					</button>
				</div>

				{/* Main scrollable area */}
				<div className="flex-1 overflow-auto p-6">
					{/* Skeleton loading */}
					{loading && (
						<div className="max-w-2xl mx-auto space-y-8">
							{(["active", "waiting", "upcoming"] as SectionKey[]).map((sk) => (
								<div key={sk}>
									<div className="flex items-center gap-2.5 mb-3">
										<div className="w-[3px] h-[14px] rounded-full bg-muted animate-pulse" />
										<div className="w-16 h-3 rounded bg-muted animate-pulse" />
										<div className="w-5 h-3 rounded-full bg-muted animate-pulse" />
									</div>
									<div className="space-y-0.5">
										{[55, 75, 45]
											.slice(0, sk === "active" ? 3 : sk === "waiting" ? 2 : 1)
											.map((w, i) => (
												<SkeletonRow key={i} width={`${w}%`} />
											))}
									</div>
								</div>
							))}
						</div>
					)}

					{/* Error: file not found */}
					{!loading && error === "tasks.md not found" && (
						<div className="max-w-2xl mx-auto text-center py-16">
							<p className="text-sm font-medium text-foreground">
								tasks.md not found
							</p>
							<p className="text-xs mt-1 text-muted-foreground">
								Expected at ~/Documents/Second Brain/90-System/tasks.md
							</p>
						</div>
					)}

					{/* Other errors */}
					{!loading && error && error !== "tasks.md not found" && (
						<div className="max-w-2xl mx-auto">
							<p className="text-sm text-[var(--accent-red)]">{error}</p>
						</div>
					)}

					{/* Content */}
					{!loading && !error && (
						<div className="max-w-2xl mx-auto space-y-8">
							{sectionsToShow.map((sectionKey) => {
								const sectionTodos = todos.filter(
									(t) => t.section === sectionKey,
								);

								return (
									<TodoSection
										key={sectionKey}
										sectionKey={sectionKey}
										todos={sectionTodos}
										pendingActions={pendingActions}
										onComplete={(id) => void handleComplete(id)}
										onDelete={(id) => void handleDelete(id)}
									/>
								);
							})}

							{/* Footer spacer */}
							{todos.length > 0 && (
								<div className="flex items-center justify-between pt-2 border-t border-border/50">
									<span className="text-[11px] text-muted-foreground">
										{activeTodos.filter((t) => !t.checked).length} active ·{" "}
										{waitingTodos.length} waiting
									</span>
									<span className="text-[11px] text-muted-foreground">
										{
											todos.filter(
												(t) => t.checked || t.section === "completed",
											).length
										}{" "}
										done
									</span>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
