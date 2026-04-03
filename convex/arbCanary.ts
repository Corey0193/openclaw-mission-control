"use node";

import fs from "fs";
import { action } from "./_generated/server";
import { v } from "convex/values";

const CANARY_JOURNAL_PATH =
	"/home/cburroughs/.openclaw/workspace-hustle/canary-trades.jsonl";

type CanaryJournalRow = {
	timestamp: string;
	event: string;
	mode: string;
	pair_name?: string;
	maker_exchange?: string;
	taker_exchange?: string;
	maker_price?: number;
	taker_price?: number;
	viable_size?: number;
	estimated_profit?: number;
	trade_value?: number;
	token_id?: string;
	lmts_slug?: string;
	expiration_ts?: number;
	reason?: string;
	maker_order_id?: string;
	taker_tx?: string;
	realized_profit?: number;
	estimated_loss?: number;
	dump_type?: string;
	order_id?: string;
};

export const getRecentCanaryTradesAction = action({
	args: {
		tenantId: v.string(),
		limit: v.optional(v.number()),
	},
	returns: v.array(v.any()),
	handler: async (_ctx, args) => {
		const limit = Math.max(1, Math.min(args.limit ?? 25, 100));
		if (!fs.existsSync(CANARY_JOURNAL_PATH)) {
			return [];
		}

		try {
			const content = fs.readFileSync(CANARY_JOURNAL_PATH, "utf-8");
			if (!content.trim()) {
				return [];
			}

			return content
				.trim()
				.split("\n")
				.map((line) => {
					try {
						return JSON.parse(line) as CanaryJournalRow;
					} catch {
						return null;
					}
				})
				.filter((row): row is CanaryJournalRow => row !== null)
				.slice(-limit)
				.reverse();
		} catch (error) {
			console.error("Failed to read canary journal", error);
			return [];
		}
	},
});
