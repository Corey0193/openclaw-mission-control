import { useEffect, useState } from "react";
import type { WalletSnapshot } from "../types/portfolio";

/**
 * Polls /api/soft-arb/trades every 30s and extracts the wallet snapshot.
 * Returns null while loading or if the endpoint is unavailable.
 */
export function useWalletSnapshot(): WalletSnapshot | null {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWallet() {
      try {
        const res = await fetch("/api/soft-arb/trades");
        if (!res.ok) return;
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) return;
        const json = await res.json();
        if (!cancelled && json?.wallet) {
          setWallet({
            total_wallet_value_usd: Number(json.wallet.total_wallet_value_usd ?? 0),
            deployable_bankroll_usd: Number(json.wallet.deployable_bankroll_usd ?? 0),
            magic_usdc: Number(json.wallet.magic_usdc ?? 0),
            phantom_usdc: Number(json.wallet.phantom_usdc ?? 0),
            phantom_pol: Number(json.wallet.phantom_pol ?? 0),
            phantom_pol_usd_value: Number(json.wallet.phantom_pol_usd_value ?? 0),
            updated_at: json.wallet.updated_at,
          });
        }
      } catch {
        // Wallet is optional — page still works without it
      }
    }

    void fetchWallet();
    const interval = setInterval(() => void fetchWallet(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return wallet;
}
