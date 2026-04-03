import { query, mutation } from "./_generated/server";

export const getRawPositions = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("copyTradePositions").collect();
	},
});

export const clearAll = mutation({
	args: {},
	handler: async (ctx) => {
		const positions = await ctx.db.query("copyTradePositions").collect();
		for (const p of positions) {
			await ctx.db.delete(p._id);
		}
		return positions.length;
	},
});
