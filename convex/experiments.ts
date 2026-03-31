import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("experiments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

export const pending = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("experiments")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", args.tenantId).eq("status", "pending")
      )
      .collect();
  },
});

export const syncExperiment = internalMutation({
  args: {
    tenantId: v.string(),
    experimentId: v.string(),
    hypothesis: v.string(),
    status: v.string(),
    completedAt: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    frozenParams: v.optional(v.any()),
    bestTrial: v.optional(v.any()),
    summary: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("experiments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("experimentId"), args.experimentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        hypothesis: args.hypothesis,
        status: args.status,
        completedAt: args.completedAt,
        durationSeconds: args.durationSeconds,
        frozenParams: args.frozenParams,
        bestTrial: args.bestTrial,
        summary: args.summary,
        error: args.error,
      });
    } else {
      await ctx.db.insert("experiments", {
        tenantId: args.tenantId,
        experimentId: args.experimentId,
        hypothesis: args.hypothesis,
        status: args.status,
        completedAt: args.completedAt,
        durationSeconds: args.durationSeconds,
        frozenParams: args.frozenParams,
        bestTrial: args.bestTrial,
        summary: args.summary,
        error: args.error,
      });
    }
  },
});
