const redis = require('./queue');
const db = require('./db');

async function resetSystem() {
    console.log("--- STARTING SYSTEM RESET ---");

    try {
        // 1. Flush Redis (Delete specific keys to be safe)
        const keys = await redis.keys('*');
        if (keys.length > 0) {
            await redis.del(keys); // CAREFUL: This deletes EVERYTHING in Redis DB 0
            console.log(`[REDIS] Deleted ${keys.length} keys (Streams, Cache, etc.)`);
        } else {
            console.log("[REDIS] Already empty.");
        }

        // 2. Truncate MySQL Tables
        // Order matters due to Foreign Keys
        // We might need to disable FK checks temporarily
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        
        await db.query('TRUNCATE TABLE trades');
        console.log("[MYSQL] Truncated 'trades'");
        
        await db.query('TRUNCATE TABLE candlesticks');
        console.log("[MYSQL] Truncated 'candlesticks'");
        
        await db.query('TRUNCATE TABLE order_book');
        console.log("[MYSQL] Truncated 'order_book'");

        // 3. Reset User Balances (Optional, but good for benchmark consistency)
        await db.query(`UPDATE users SET balance_fiat = 10000000, balance_stock_symbol = 10000000 WHERE id = 1`);
        console.log("[MYSQL] Reset User 1 Balance");

        await db.query('SET FOREIGN_KEY_CHECKS = 1');

    } catch (err) {
        console.error("Reset Failed:", err);
    } finally {
        console.log("--- SYSTEM RESET COMPLETE ---");
        process.exit();
    }
}

resetSystem();
