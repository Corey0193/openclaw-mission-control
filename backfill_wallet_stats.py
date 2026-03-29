import sqlite3
import os

DB_PATH = os.path.expanduser('~/.openclaw/workspace-radar/wallet-intel/radar-intel.db')

def backfill():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("Calculating wallet stats from trades table...")
    
    # 1. Get all wallets that have trades
    cursor.execute("SELECT DISTINCT address FROM trades")
    addresses = [row['address'] for row in cursor.fetchall()]
    print(f"Found {len(addresses)} wallets with trade history.")

    updated = 0
    for addr in addresses:
        # Calculate stats for this wallet
        # Win rate = trades with realized_pnl > 0 / total trades with realized_pnl != 0
        cursor.execute('''
            SELECT 
                COUNT(*) as total_trades,
                MIN(timestamp) as first_trade,
                SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN realized_pnl != 0 AND realized_pnl IS NOT NULL THEN 1 ELSE 0 END) as scored_trades
            FROM trades 
            WHERE address = ?
        ''', (addr,))
        
        stats = cursor.fetchone()
        if not stats or stats['total_trades'] == 0:
            continue
            
        total_trades = stats['total_trades']
        # Convert timestamp to ISO string if it's an integer
        first_trade_ts = stats['first_trade']
        first_trade_iso = None
        if first_trade_ts:
            from datetime import datetime
            first_trade_iso = datetime.fromtimestamp(first_trade_ts).isoformat()
            
        win_rate = 0
        if stats['scored_trades'] > 0:
            win_rate = stats['wins'] / stats['scored_trades']
            
        # Update wallets table
        cursor.execute('''
            UPDATE wallets 
            SET trade_count = ?, 
                win_rate = ?, 
                first_trade_at = ? 
            WHERE address = ?
        ''', (total_trades, win_rate, first_trade_iso, addr))
        updated += 1

    conn.commit()
    print(f"Successfully updated {updated} wallets in local SQLite.")
    conn.close()

if __name__ == "__main__":
    backfill()
