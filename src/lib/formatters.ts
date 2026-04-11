export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "---";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function formatPnl(n: number): string {
  if (!Number.isFinite(n)) return "---";
  const sign = n >= 0 ? "+" : "";
  return sign + formatUsd(n);
}

export function timeAgo(isoOrMs: string | number): string {
  const ts =
    typeof isoOrMs === "string" ? new Date(isoOrMs).getTime() : isoOrMs;
  if (!Number.isFinite(ts)) return "unknown";
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "---";
  return `${n.toFixed(digits)}%`;
}
