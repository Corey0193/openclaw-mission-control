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
        payload = {
            "address": w['address'],
            "username": username,
            "totalPnl": w['pnl'] or 0,
            "performanceScore": w['insider_confidence_score'] or 0,
            "winRate": w['win_rate'],
            "tradeCount": w['trade_count'],
            "firstTradeAt": w['first_trade_at'],
            "isInsider": True if w['classification'] == 'insider_suspect' else False,
            "tags": [w['classification']] if w['classification'] else [],
            "tenantId": "default",
            # CTS fields
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
                print(f"Failed to sync {w['address']}: {resp.status_code}")
                print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Error syncing {w['address']}: {e}")
            break
            
        if (i + 1) % 100 == 0:
            print(f"Synced {i + 1}/{len(wallets)} wallets...")

    print(f"Done! Synced {synced} wallets.")
    conn.close()

if __name__ == "__main__":
    sync()
