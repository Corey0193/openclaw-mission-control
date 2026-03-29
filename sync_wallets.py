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
    for w in wallets:
        # Use full address if username is missing to ensure valid URLs
        username = w['address']
        
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
            "tenantId": "default"
        }
        
        try:
            resp = httpx.post(UPSERT_URL, json=payload, timeout=5.0)
            if resp.status_code == 200:
                synced += 1
            else:
                print(f"Failed to sync {w['address']}: {resp.status_code}")
        except Exception as e:
            print(f"Error syncing {w['address']}: {e}")
            break

    print(f"Done! Synced {synced} wallets.")
    conn.close()

if __name__ == "__main__":
    sync()
