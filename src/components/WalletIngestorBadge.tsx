import React, { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { IconDatabaseImport } from "@tabler/icons-react";

const STALE_MS = 300_000; // 5 min

const WalletIngestorBadge = () => {
        const status = useQuery(api.walletIngestor.getStatus, {
                tenantId: DEFAULT_TENANT_ID,
        });
        const [now, setNow] = useState(Date.now());

        useEffect(() => {
                const id = setInterval(() => setNow(Date.now()), 30_000);
                return () => clearInterval(id);
        }, []);

        if (!status) return null;

        const isLive = status.running && now - status.lastHeartbeatAt < STALE_MS;

        const tooltip = `Wallets: ${status.walletCount} | Trades: ${status.tradeCount} | Status: ${status.status.toUpperCase()} | PID: ${status.pid || "N/A"} | Last seen: ${new Date(status.lastHeartbeatAt).toLocaleTimeString()}`;

        return (
                <div
                        title={tooltip}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider border shadow-sm cursor-help transition-colors ${
                                isLive
                                        ? "bg-blue-50 text-blue-600 border-blue-200"
                                        : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}
                >
                        <IconDatabaseImport
                                size={14}
                                className={isLive ? "animate-pulse" : ""}
                        />
                        INGESTOR: {isLive ? "LIVE" : "STALLED"}
                </div>
        );
};

export default WalletIngestorBadge;
