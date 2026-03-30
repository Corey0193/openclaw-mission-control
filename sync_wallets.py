import sqlite3
import os
import httpx
import json

DB_PATH = os.path.expanduser('~/.openclaw/workspace-radar/wallet-intel/radar-intel.db')
UPSERT_URL = "http://127.0.0.1:3211/wallet/upsert" # Mission Control endpoint

def sync():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get wallets that have been classified
    cursor.execute("SELECT * FROM wallets WHERE classification != 'uncategorized'")
    wallets = cursor.fetchall()
    print(f"Found {len(wallets)} classified wallets. Syncing...")

    synced = 0
    for i, w in enumerate(wallets):
        # Use full address if username is missing to ensure valid URLs
        username = w['address']
        
        wd = dict(w)
        # Use inferred win rate from CTS if the primary win_rate (from API) is empty
        # cts_win_rate is 0-100, we need 0.0-1.0
        win_rate = wd.get('win_rate')
        if (win_rate is None or win_rate == 0) and (wd.get('cts_win_rate') or 0) > 0:
            win_rate = wd['cts_win_rate'] / 100.0

        payload = {
            "address": wd['address'],
            "username": username,
            "totalPnl": wd['pnl'] or 0,
            "performanceScore": wd.get('copy_trading_score') or wd.get('insider_confidence_score') or 0,
            "winRate": win_rate,
            "tradeCount": wd['trade_count'],
            "firstTradeAt": wd['first_trade_at'],
            "isInsider": True if wd['classification'] == 'insider_suspect' else False,
            "tags": [wd['classification']] if wd['classification'] else [],
            "tenantId": "default",
            # Extra stats for detail view
            "copyTradingScore": wd.get('copy_trading_score') or 0,
            "ctsConsistency": wd.get('cts_consistency') or 0,
            "ctsWinRate": wd.get('cts_win_rate') or 0,
            "pnl7d": wd.get('pnl_7d') or 0,
            "pnl30d": wd.get('pnl_30d') or 0,
            "pnl90d": wd.get('pnl_90d') or 0,
            "maxDrawdownPct": wd.get('max_drawdown_pct') or 0,
            "profitableWeeksRatio": wd.get('profitable_weeks_ratio') or 0,
            "computedWinRate": (wd.get('cts_win_rate') or 0) / 100,
        }
        
        try:
            resp = httpx.post(UPSERT_URL, json=payload, timeout=5.0)
            if resp.status_code == 200:
                synced += 1
            else:
                print(f"Failed to sync {wd['address']}: {resp.status_code}")
                print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Error syncing {wd['address']}: {e}")
            break
            
        if (i + 1) % 100 == 0:
            print(f"Synced {i + 1}/{len(wallets)} wallets...")

    print(f"Done! Synced {synced} wallets.")
    conn.close()

if __name__ == "__main__":
    sync()
