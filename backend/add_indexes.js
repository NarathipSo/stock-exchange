const db = require('./db');

async function addIndexes() {
    try {
        console.log("Adding Indexes to order_book...");
        
        // Composite index for Matching Engine lookups
        // Matches: WHERE stock_symbol = ? AND order_type = '...' AND price ...
        await db.query(`
            CREATE INDEX idx_matching ON order_book (stock_symbol, order_type, price, status, created_at);
        `);
        console.log("Index 'idx_matching' created.");

        // Index for finding user orders (if needed) or simple lookups
        await db.query(`
            CREATE INDEX idx_user_stock ON order_book (user_id, stock_symbol);
        `);
        console.log("Index 'idx_user_stock' created.");

    } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME') {
            console.log("Indexes already exist.");
        } else {
            console.error("Error adding indexes:", err);
        }
    } finally {
        process.exit();
    }
}

addIndexes();
