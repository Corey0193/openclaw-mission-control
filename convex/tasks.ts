import { v } from "convex/values";
import { mutation } from "./_generated/server";

function requireTenant<T extends { tenantId?: string }>(
	record: T | null,
	tenantId: string,
	entityName: string,
): T {
	if (!record || record.tenantId !== tenantId) {
		throw new Error(`${entityName} not found`);
	}
	return record;
}

export const updateStatus = mutation({
	args: {
		taskId: v.id("tasks"),
		tenantId: v.string(),
		status: v.union(
			v.literal("inbox"),
			v.literal("assigned"),
			v.literal("in_progress"),
			v.literal("review"),
			v.literal("done"),
			v.literal("archived"),
		),
		agentId: v.id("agents"),
	},
	handler: async (ctx, args) => {
		const task = requireTenant(
			await ctx.db.get("tasks", args.taskId),
			args.tenantId,
			"Task",
		);

		requireTenant(
			await ctx.db.get("agents", args.agentId),
			args.tenantId,
			"Agent",
		);

		await ctx.db.patch(args.taskId, { status: args.status });

		await ctx.db.insert("activities", {
			type: "status_update",
			agentId: args.agentId,
			message: `changed status of "${task.title}" to ${args.status}`,
			targetId: args.taskId,
			tenantId: args.tenantId,
		});
	},
});

export const updateAssignees = mutation({
	args: {
		taskId: v.id("tasks"),
		tenantId: v.string(),
		assigneeIds: v.array(v.id("agents")),
		agentId: v.id("agents"),
	},
	handler: async (ctx, args) => {
		const task = requireTenant(
			await ctx.db.get("tasks", args.taskId),
			args.tenantId,
			"Task",
		);

		requireTenant(
			await ctx.db.get("agents", args.agentId),
			args.tenantId,
			"Agent",
		);

		for (const assigneeId of args.assigneeIds) {
			requireTenant(
				await ctx.db.get("agents", assigneeId),
				args.tenantId,
				"Assignee",
			);
		}

		await ctx.db.patch(args.taskId, { assigneeIds: args.assigneeIds });

		await ctx.db.insert("activities", {
			type: "assignees_update",
			agentId: args.agentId,
			message: `updated assignees for "${task.title}"`,
			targetId: args.taskId,
			tenantId: args.tenantId,
		});
	},
});

export const createTask = mutation({
	args: {
		title: v.string(),
		description: v.string(),
		status: v.string(),
		tags: v.array(v.string()),
		borderColor: v.optional(v.string()),
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		const taskId = await ctx.db.insert("tasks", {
			title: args.title,
			description: args.description,
			status: args.status as any,
			assigneeIds: [],
			tags: args.tags,
			borderColor: args.borderColor,
			tenantId: args.tenantId,
		});
		return taskId;
	},
});

export const archiveTask = mutation({
	args: {
		taskId: v.id("tasks"),
		tenantId: v.string(),
		agentId: v.id("agents"),
	},
	handler: async (ctx, args) => {
		const task = requireTenant(
			await ctx.db.get("tasks", args.taskId),
			args.tenantId,
			"Task",
		);

		requireTenant(
			await ctx.db.get("agents", args.agentId),
			args.tenantId,
			"Agent",
		);

		await ctx.db.patch(args.taskId, { status: "archived" });

		await ctx.db.insert("activities", {
			type: "status_update",
			agentId: args.agentId,
			message: `archived "${task.title}"`,
			targetId: args.taskId,
			tenantId: args.tenantId,
		});
	},
});

export const linkRun = mutation({
	args: {
		taskId: v.id("tasks"),
		openclawRunId: v.string(),
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		requireTenant(
			await ctx.db.get("tasks", args.taskId),
			args.tenantId,
			"Task",
		);

		await ctx.db.patch(args.taskId, {
			openclawRunId: args.openclawRunId,
			startedAt: Date.now(),
		});
	},
});

export const updateTask = mutation({
	args: {
		taskId: v.id("tasks"),
		tenantId: v.string(),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		tags: v.optional(v.array(v.string())),
		agentId: v.id("agents"),
	},
	handler: async (ctx, args) => {
		const task = requireTenant(
			await ctx.db.get("tasks", args.taskId),
			args.tenantId,
			"Task",
		);

		requireTenant(
			await ctx.db.get("agents", args.agentId),
			args.tenantId,
			"Agent",
		);

		const fields: any = {};
		const updates: string[] = [];

		if (args.title !== undefined) {
			fields.title = args.title;
			updates.push("title");
		}
		if (args.description !== undefined) {
			fields.description = args.description;
			updates.push("description");
		}
		if (args.tags !== undefined) {
			fields.tags = args.tags;
			updates.push("tags");
		}

		await ctx.db.patch(args.taskId, fields);

		if (updates.length > 0) {
			await ctx.db.insert("activities", {
				type: "task_update",
				agentId: args.agentId,
				message: `updated ${updates.join(", ")} of "${task.title}"`,
				targetId: args.taskId,
				tenantId: args.tenantId,
			});
		}
	},
});
