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

export const send = mutation({
	args: {
		taskId: v.id("tasks"),
		agentId: v.id("agents"),
		tenantId: v.string(),
		content: v.string(),
		attachments: v.optional(v.array(v.id("documents"))),
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

		for (const attachmentId of args.attachments || []) {
			requireTenant(
				await ctx.db.get("documents", attachmentId),
				args.tenantId,
				"Document",
			);
		}

		await ctx.db.insert("messages", {
			taskId: args.taskId,
			fromAgentId: args.agentId,
			content: args.content,
			attachments: args.attachments || [],
			tenantId: args.tenantId,
		});

		await ctx.db.insert("activities", {
			type: "message",
			agentId: args.agentId,
			message: `commented on "${task.title}"`,
			targetId: args.taskId,
			tenantId: args.tenantId,
		});
	},
});
