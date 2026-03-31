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

export const syncExperiment = mutation({
  args: {
    tenantId: v.string(),
    experimentId: v.string(),
    hypothesis: v.string(),
    status: v.string(),
    completedAt: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    frozenParams: v.optional(v.any()),
    bestTrial: v.optional(v.any()),
    summary: v.optional(
      v.object({
        total_trials: v.number(),
        completed_trials: v.number(),
        pruned_trials: v.number(),
      })
    ),
    error: v.optional(v.union(v.string(), v.null())),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("experiments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("experimentId"), args.experimentId))
      .first();

    const data = {
      hypothesis: args.hypothesis,
      status: args.status,
      completedAt: args.completedAt,
      durationSeconds: args.durationSeconds,
      frozenParams: args.frozenParams,
      bestTrial: args.bestTrial,
      summary: args.summary,
      error: args.error,
      lastSyncedAt: args.lastSyncedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("experiments", {
        tenantId: args.tenantId,
        experimentId: args.experimentId,
        ...data,
      });
    }
  },
});
