// src/types/portfolio.ts

export type PositionCategory = "tracked" | "manual" | "legacy";
export type PortfolioSource = "polymarket-api" | "convex-fallback";
export type TradeDirection = "BUY_YES" | "BUY_NO";

export type AlertType =
  | "orphaned_trade"
  | "unclaimed_payout"
  | "share_mismatch"
  | "stale_data";

export interface OnChainPosition {
  conditionId: string;
  slug: string;
  eventSlug: string;
  title: string;
  /** Exact string from API: "Yes", "No", or team name e.g. "Lightning" */
  outcome: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  initialValue: number;
  unrealizedPnl: number;
  resolved: boolean;
  redeemable: boolean;
  endDate: string | null;
}

export interface PipelineMetadata {
  tradeId: string;
  opportunityId: string | null;
  signalFamily: string | null;
  edgePct: number | null;
  direction: TradeDirection;
  entryPrice: number | null;
  positionSizeUsd: number;
  /** Shares as recorded at trade entry — may differ from on-chain if fills partial */
  loggedShares: number;
  entryTimestamp: string | null;
  orderId: string | null;
  paperOrLive: "paper" | "live";
}

export interface PortfolioPosition {
  slug: string;
  title: string;
  outcome: string;
  category: PositionCategory;
  onChain: OnChainPosition;
  /** null for manual/legacy positions */
  pipeline: PipelineMetadata | null;
}

export interface PortfolioAlert {
  type: AlertType;
  message: string;
  tradeId?: string;
  slug?: string;
  amountUsd?: number;
  shareMismatch?: { pipeline: number; onChain: number };
}

export interface PortfolioResponse {
  source: PortfolioSource;
  fetchedAt: string;
  positions: PortfolioPosition[];
  alerts: PortfolioAlert[];
}
