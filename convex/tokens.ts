import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_TENANT_ID = "default";

export const logTokenUsage = mutation({
	args: {
		agentId: v.optional(v.id("agents")),
		agentName: v.string(),
		skillName: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		totalTokens: v.optional(v.number()),
		runId: v.optional(v.string()),
		tenantId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const tenantId = args.tenantId ?? DEFAULT_TENANT_ID;

		await ctx.db.insert("tokenUsage", {
			agentId: args.agentId,
			agentName: args.agentName,
			skillName: args.skillName,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			totalTokens: args.totalTokens ?? args.inputTokens + args.outputTokens,
			timestamp: Date.now(),
			runId: args.runId,
			tenantId,
		});
	},
});

export const getAggregatedTokenUsage = query({
	args: {
		tenantId: v.optional(v.string()),
		startTime: v.optional(v.number()),
		endTime: v.optional(v.number()),
		selectedAgentName: v.optional(v.string()),
		selectedSkillName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const tenantId = args.tenantId ?? DEFAULT_TENANT_ID;
		const start = args.startTime ?? 0;
		const end = args.endTime ?? Date.now();

		let usageQuery = ctx.db
			.query("tokenUsage")
			.withIndex("by_tenant_timestamp", (q) =>
				q.eq("tenantId", tenantId).gt("timestamp", start).lt("timestamp", end),
			);

		const rawUsage = await usageQuery.collect();

		// Server-side aggregation to keep the response size small and the frontend fast
		const aggregated: Record<
			string,
			{ name: string; Input: number; Output: number }
		> = {};

		const showPerAgent =
			!args.selectedAgentName || args.selectedAgentName === "All";
		const showPerSkill =
			args.selectedAgentName &&
			args.selectedAgentName !== "All" &&
			(!args.selectedSkillName || args.selectedSkillName === "All");

		for (const u of rawUsage) {
			// Apply filters
			if (
				args.selectedAgentName &&
				args.selectedAgentName !== "All" &&
				u.agentName !== args.selectedAgentName
			)
				continue;
			if (
				args.selectedSkillName &&
				args.selectedSkillName !== "All" &&
				u.skillName !== args.selectedSkillName
			)
				continue;

			let key = "";
			if (showPerAgent) {
				key = u.agentName;
			} else if (showPerSkill) {
				key = u.skillName;
			} else {
				// Specific agent and skill selected
				key = `${u.agentName} - ${u.skillName}`;
			}

			if (!aggregated[key]) {
				aggregated[key] = { name: key, Input: 0, Output: 0 };
			}
			aggregated[key].Input += u.inputTokens;
			aggregated[key].Output += u.outputTokens;
		}

		// Also return the unique lists for the dropdowns
		const agents = Array.from(new Set(rawUsage.map((u) => u.agentName))).sort();
		const skills = Array.from(
			new Set(
				rawUsage
					.filter(
						(u) =>
							!args.selectedAgentName ||
							args.selectedAgentName === "All" ||
							u.agentName === args.selectedAgentName,
					)
					.map((u) => u.skillName),
			),
		).sort();

		return {
			chartData: Object.values(aggregated).sort(
				(a, b) => b.Input + b.Output - (a.Input + a.Output),
			),
			agents,
			skills,
		};
	},
});

export const clearAllTokenUsage = mutation({
	args: {
		tenantId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const tenantId = args.tenantId ?? DEFAULT_TENANT_ID;
		const allUsage = await ctx.db
			.query("tokenUsage")
			.withIndex("by_tenant_timestamp", (q) => q.eq("tenantId", tenantId))
			.collect();

		for (const doc of allUsage) {
			await ctx.db.delete(doc._id);
		}
		return allUsage.length;
	},
});
