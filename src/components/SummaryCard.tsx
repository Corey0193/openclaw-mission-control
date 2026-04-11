import { PnlBadge } from "./PnlBadge";
import { formatUsd } from "../lib/formatters";

export function SummaryCard({
  label,
  value,
  icon,
  isPnl,
  isPercent,
  isCurrency,
  subtitle,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  isPnl?: boolean;
  isPercent?: boolean;
  isCurrency?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-white border border-border rounded-xl px-3 py-3 shadow-sm min-w-0">
      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-semibold text-muted-foreground tracking-wide uppercase truncate">
          {label}
        </div>
        <div className="text-sm font-bold text-foreground truncate">
          {value == null ? (
            "---"
          ) : isPnl ? (
            <PnlBadge value={value} />
          ) : isPercent ? (
            `${value.toFixed(1)}%`
          ) : isCurrency ? (
            formatUsd(value)
          ) : (
            value
          )}
        </div>
        {subtitle && (
          <div className="text-[9px] text-muted-foreground truncate">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
