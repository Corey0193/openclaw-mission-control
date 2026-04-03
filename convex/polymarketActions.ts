import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

const DATA_API = "https://data-api.polymarket.com";
const POLYGON_RPC = "https://1rpc.io/matic";
// USDC.e (Bridged USDC) on Polygon
const USDC_E_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const TRADE_CUTOFF_MS = new Date("2026-01-01").getTime();

async function fetchUsdcBalance(walletAddress: string): Promise<number | null> {
	// ERC-20 balanceOf(address) — selector 0x70a08231
	const paddedAddr = walletAddress.slice(2).toLowerCase().padStart(64, "0");
	try {
		const resp = await fetch(POLYGON_RPC, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "eth_call",
				params: [
					{ to: USDC_E_CONTRACT, data: `0x70a08231${paddedAddr}` },
					"latest",
				],
			}),
		});
		if (!resp.ok) return null;
		const result: { result?: string } = await resp.json();
		if (!result.result) return null;
		// USDC.e has 6 decimals
		return Number(BigInt(result.result)) / 1e6;
	} catch {
		return null;
	}
}

export const refreshPrices = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const data = await ctx.runQuery(internal.polymarket.getPositionsInternal, {
			tenantId: "default",
		});
		if (!data) return null;

		const walletAddress = data.walletAddress;

		// Fetch live data in parallel — all public, no auth
		const [positionsResp, tradesResp, balanceUsdc] = await Promise.all([
			fetch(
				`${DATA_API}/positions?user=${walletAddress}&sizeThreshold=0&limit=500`,
			),
			fetch(`${DATA_API}/trades?user=${walletAddress}&limit=10000`),
			fetchUsdcBalance(walletAddress),
		]);

		if (!positionsResp.ok) {
			console.error("Data API positions failed:", positionsResp.status);
			return null;
		}
		if (!tradesResp.ok) {
			console.error("Data API trades failed:", tradesResp.status);
			return null;
		}

		const rawPositions: Array<{
			conditionId: string;
			title: string;
			eventSlug: string;
			outcome: string;
			size: number;
			avgPrice: number;
			curPrice: number;
			initialValue: number;
			cashPnl: number;
			redeemable: boolean;
		}> = await positionsResp.json();

		const rawTrades: Array<{
			conditionId: string;
			title: string;
			side: string;
			outcome: string;
			size: number;
			price: number;
			timestamp: number;
			transactionHash: string;
		}> = await tradesResp.json();

		// Map positions to our schema
		let totalInvested = 0;
		let totalCurrentValue = 0;

		const positions = rawPositions.map((p) => {
			const resolved = p.redeemable || p.curPrice >= 0.99 || p.curPrice <= 0.01;
			const currentValue = p.size * p.curPrice;
			const costBasis = p.initialValue;
			const payout = p.size;

			totalInvested += Math.max(costBasis, 0);
			totalCurrentValue += currentValue;

			const position: {
				market: string;
				marketQuestion: string;
				marketSlug: string;
				outcome: string;
				shares: number;
				entryPrice: number;
				currentPrice: number;
				costBasis: number;
				currentValue: number;
				payout: number;
				unrealizedPnl: number;
				marketClosed: boolean;
				marketResolved: boolean;
				winner?: boolean;
			} = {
				market: p.conditionId,
				marketQuestion: p.title,
				marketSlug: p.eventSlug,
				outcome: p.outcome,
				shares: p.size,
				entryPrice: p.avgPrice,
				currentPrice: p.curPrice,
				costBasis: Math.round(costBasis * 100) / 100,
				currentValue: Math.round(currentValue * 100) / 100,
				payout: Math.round(payout * 100) / 100,
				unrealizedPnl: Math.round(p.cashPnl * 100) / 100,
				marketClosed: resolved,
				marketResolved: resolved,
			};

			if (resolved) {
				position.winner = p.cashPnl > 0;
			}

			return position;
		});

		// Map trades to our schema, filtering to recent trades only
		const trades = rawTrades
			.filter((t) => t.timestamp * 1000 >= TRADE_CUTOFF_MS)
			.map((t) => ({
				id: t.transactionHash || `${t.conditionId}-${t.timestamp}`,
				market: t.conditionId,
				marketQuestion: t.title,
				side: t.side,
				outcome: t.outcome,
				shares: t.size,
				price: t.price,
				cost: Math.round(t.size * t.price * 100) / 100,
				payout: Math.round(t.size * 100) / 100,
				timestamp: t.timestamp * 1000,
				txHash: t.transactionHash,
				status: "CONFIRMED",
			}));

		const totalPnl =
			Math.round((totalCurrentValue - totalInvested) * 100) / 100;

		// Full sync via the existing syncPositions mutation
		await ctx.runMutation(api.polymarket.syncPositions, {
			walletAddress,
			balanceUsdc: balanceUsdc ?? data.balanceUsdc,
			openOrders: data.openOrders ?? [],
			positions,
			trades,
			totalInvested: Math.round(totalInvested * 100) / 100,
			totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
			totalPnl,
			lastSyncedAt: Date.now(),
			tenantId: "default",
		});

		return null;
	},
});
