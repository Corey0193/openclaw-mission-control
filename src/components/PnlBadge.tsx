import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { formatPnl } from "../lib/formatters";

export function PnlBadge({ value }: { value: number | null }) {
  if (value == null)
    return <span className="text-muted-foreground">---</span>;
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold ${
        isPositive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {isPositive ? (
        <IconTrendingUp size={14} />
      ) : (
        <IconTrendingDown size={14} />
      )}
      {formatPnl(value)}
    </span>
  );
}
