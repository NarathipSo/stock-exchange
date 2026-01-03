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
        
        // Ensure Tables Exist
        await db.query(`CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE,
            password_hash VARCHAR(255),
            balance_fiat DECIMAL(20, 2) DEFAULT 0
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS user_stocks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            stock_symbol VARCHAR(10),
            quantity DECIMAL(20, 2) DEFAULT 0,
            UNIQUE KEY unique_stock (user_id, stock_symbol),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS trades (
            id INT AUTO_INCREMENT PRIMARY KEY,
            buyer_id INT,
            seller_id INT,
            stock_symbol VARCHAR(10),
            price DECIMAL(20, 2),
            quantity DECIMAL(20, 2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS candlesticks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            stock_symbol VARCHAR(10),
            interval_type VARCHAR(10),
            open_price DECIMAL(20, 2),
            high_price DECIMAL(20, 2),
            low_price DECIMAL(20, 2),
            close_price DECIMAL(20, 2),
            volume DECIMAL(20, 2),
            start_time TIMESTAMP
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS order_book (
            id INT AUTO_INCREMENT PRIMARY KEY
        )`);

        
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