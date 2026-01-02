const redis = require('./queue');
const db = require('./db');

async function resetSystem() {
    console.log("--- STARTING SYSTEM RESET ---");

    try {
        const keys = await redis.keys('*');
        if (keys.length > 0) {
            await redis.del(keys);
            console.log(`[REDIS] Deleted ${keys.length} keys`);
        }

        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        
        await db.query('TRUNCATE TABLE trades');
        await db.query('TRUNCATE TABLE candlesticks');
        await db.query('TRUNCATE TABLE order_book');
        // NEW: Truncate user_stocks
        await db.query('TRUNCATE TABLE user_stocks');

        // Reset User 1 Balance
        await db.query(`UPDATE users SET balance_fiat = 10000000 WHERE id = 1`);
        
        // NEW: Give User 1 some stocks
        const symbols = ['GOOGL', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NFLX', 'NVDA', 'BABA', 'IBM'];
        for (const sym of symbols) {
             await db.query(`INSERT INTO user_stocks (user_id, stock_symbol, quantity) VALUES (1, ?, 10000000)`, [sym]);
        }
        
        console.log("[MYSQL] Tables truncated and User 1 reset");

        await db.query('SET FOREIGN_KEY_CHECKS = 1');

    } catch (err) {
        console.error("Reset Failed:", err);
    } finally {
        console.log("--- SYSTEM RESET COMPLETE ---");
        process.exit();
    }
}

resetSystem();