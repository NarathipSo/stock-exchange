const db = require('../db');

const matchOrder = async (orderId) => {
    const connection = await db.getConnection(); // Get one connection for the whole process

    try {
        await connection.beginTransaction();

        // 1. Get the Incoming Order
        // "FOR UPDATE" locks this row so no one else can touch it while we calculate
        const [rows] = await connection.execute(
            `SELECT * FROM order_book WHERE id = ? FOR UPDATE`,
            [orderId]
        );

        // If order vanished (rare race condition), stop
        if (rows.length === 0) {
            await connection.rollback();
            return;
        }

        const incomingOrder = rows[0];
        let remainingQty = parseFloat(incomingOrder.quantity); // Track memory state

        // 2. Find Matchable Orders
        // Logic: If BUY, find cheap SELLS. If SELL, find expensive BUYS.
        let matchSql = '';
        if (incomingOrder.order_type === 'BUY') {
            matchSql = `SELECT * FROM order_book WHERE stock_symbol = ? AND order_type = 'SELL' AND price <= ? AND (status = 'OPEN' OR status = 'PARTIAL') ORDER BY price ASC, created_at ASC FOR UPDATE`;
        } else {
            matchSql = `SELECT * FROM order_book WHERE stock_symbol = ? AND order_type = 'BUY' AND price >= ? AND (status = 'OPEN' OR status = 'PARTIAL') ORDER BY price DESC, created_at ASC FOR UPDATE`;
        }

        const [matchableOrders] = await connection.execute(matchSql, [incomingOrder.stock_symbol, incomingOrder.price]);

        // 3. The Matching Loop
        for (const match of matchableOrders) {
            if (remainingQty <= 0) break; // Stop if we are full

            // Calculate the trade amount
            const currentMatchQty = parseFloat(match.quantity);
            const delta = Math.min(remainingQty, currentMatchQty);

            // Validation: Don't trade 0
            if (delta <= 0) continue;

            const price = parseFloat(match.price); // Trade executes at MAKER price (FIFO rule)

            // --- A. CREATE TRADE RECORD ---
            await connection.execute(
                `INSERT INTO trades (buyer_id, seller_id, stock_symbol, price, quantity) VALUES (?, ?, ?, ?, ?)`,
                [
                    incomingOrder.order_type === 'BUY' ? incomingOrder.user_id : match.user_id,
                    incomingOrder.order_type === 'BUY' ? match.user_id : incomingOrder.user_id,
                    incomingOrder.stock_symbol,
                    price,
                    delta
                ]
            );

            // --- B. UPDATE MATCHED ORDER (MAKER) ---
            const newMatchQty = currentMatchQty - delta;
            const matchStatus = newMatchQty === 0 ? 'FILLED' : 'PARTIAL';

            await connection.execute(
                `UPDATE order_book SET quantity = ?, status = ? WHERE id = ?`,
                [newMatchQty, matchStatus, match.id]
            );

            // --- C. UPDATE INCOMING ORDER (TAKER) ---
            remainingQty -= delta; // Update local tracker
            const incomingStatus = remainingQty === 0 ? 'FILLED' : 'PARTIAL';

            await connection.execute(
                `UPDATE order_book SET quantity = ?, status = ? WHERE id = ?`,
                [remainingQty, incomingStatus, incomingOrder.id]
            );

            // --- D. UPDATE BALANCES (The Money) ---
            // Buyer: -Cash, +Stock
            // Seller: +Cash, -Stock

            const buyerId = incomingOrder.order_type === 'BUY' ? incomingOrder.user_id : match.user_id;
            const sellerId = incomingOrder.order_type === 'BUY' ? match.user_id : incomingOrder.user_id;
            const totalValue = delta * price;

            // Update Buyer
            await connection.execute(
                `UPDATE users SET balance_fiat = balance_fiat - ?, balance_stock_symbol = balance_stock_symbol + ? WHERE id = ?`,
                [totalValue, delta, buyerId]
            );

            // Update Seller
            await connection.execute(
                `UPDATE users SET balance_fiat = balance_fiat + ?, balance_stock_symbol = balance_stock_symbol - ? WHERE id = ?`,
                [totalValue, delta, sellerId]
            );

            console.log(`Matched ${delta} shares @ ${price} ${incomingOrder.stock_symbol} Buyer: ${buyerId} Seller: ${sellerId}`);
        }

        await connection.commit(); // SAVE EVERYTHING
        console.log("Matching complete.");

    } catch (error) {
        await connection.rollback(); // UNDO EVERYTHING if error
        console.error("Matching Engine Error:", error);
    } finally {
        connection.release(); // Close connection
    }
};

module.exports = matchOrder;