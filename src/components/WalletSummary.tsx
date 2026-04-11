import { Link } from "react-router-dom";
import { IconWallet, IconCurrencyDollar, IconChartBar } from "@tabler/icons-react";
import { SummaryCard } from "./SummaryCard";
import { timeAgo, formatUsd } from "../lib/formatters";
import type { WalletSnapshot } from "../types/portfolio";

interface WalletSummaryProps {
  /** Wallet balance snapshot from soft arb API. Null while loading. */
  wallet: WalletSnapshot | null;
  /** Sum of current value of all open positions (on-chain). Null while loading. */
  positionsValue: number | null;
  /** Link target and label for the cross-page nav */
  crossLink: { to: string; label: string };
}

export function WalletSummary({ wallet, positionsValue, crossLink }: WalletSummaryProps) {
  const totalValue =
    wallet != null && positionsValue != null
      ? wallet.total_wallet_value_usd + positionsValue
      : null;

  const availableCash = wallet?.deployable_bankroll_usd ?? null;

  const polSubtitle =
    wallet != null && wallet.phantom_pol_usd_value > 1
      ? `incl. ${formatUsd(wallet.phantom_pol_usd_value)} POL`
      : undefined;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Total Value"
          value={totalValue}
          icon={<IconWallet size={18} />}
          isCurrency
        />
        <SummaryCard
          label="Available Cash"
          value={availableCash}
          icon={<IconCurrencyDollar size={18} />}
          isCurrency
          subtitle={polSubtitle}
        />
        <SummaryCard
          label="In Positions"
          value={positionsValue}
          icon={<IconChartBar size={18} />}
          isCurrency
        />
      </div>
      <div className="flex items-center justify-between">
        {wallet?.updated_at ? (
          <span className="text-[10px] text-muted-foreground">
            Wallet updated {timeAgo(wallet.updated_at)}
          </span>
        ) : (
          <span />
        )}
        <Link
          to={crossLink.to}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {crossLink.label} &rarr;
        </Link>
      </div>
    </div>
  );
}
