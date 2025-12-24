const db = require('../db');
const queue = require('../queue');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.placeOrder = async (req, res) => {
    const { user_id, stock_symbol, order_type, price, quantity } = req.body;

    if (!user_id || !stock_symbol || !price || !quantity || !order_type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (parseFloat(price) <= 0 || parseFloat(quantity) <= 0) {
        return res.status(400).json({ error: 'Price and quantity must be positive' });
    }

    let attempts = 0;
    const MAX_RETRIES = 20;

    while (attempts < MAX_RETRIES) {
        // connection from the pool
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const [users] = await connection.execute(
                `SELECT * FROM users WHERE id = ? FOR UPDATE`,
                [user_id]
            );

            if (users.length === 0) {
                throw new Error('User not found');
            }

            const user = users[0];
            const totalValue = price * quantity;

            if (order_type === 'BUY') {
                if (parseFloat(user.balance_fiat) < totalValue) {
                    throw new Error('Insufficient funds');
                }
                // DEDUCT CASH NOW
                await connection.execute(
                    `UPDATE users SET balance_fiat = balance_fiat - ? WHERE id = ?`,
                    [totalValue, user_id]
                );
            } else if (order_type === 'SELL') {
                if (parseFloat(user.balance_stock_symbol) < quantity) {
                    throw new Error('Insufficient stock');
                }
                // DEDUCT STOCK NOW
                await connection.execute(
                    `UPDATE users SET balance_stock_symbol = balance_stock_symbol - ? WHERE id = ?`,
                    [quantity, user_id]
                );
            }

            // 4. Insert the Order into the Order Book
            const [result] = await connection.execute(
                `INSERT INTO order_book (user_id, stock_symbol, order_type, price, quantity) 
                VALUES (?, ?, ?, ?, ?)`,
                [user_id, stock_symbol, order_type, price, quantity]
            );

            // 5. Commit the transaction (Save changes)
            await connection.commit();

            // Add to stream 'orders_stream' with auto-ID ('*'). Field 'orderId' = value
            await queue.xadd('orders_stream', '*', 'orderId', JSON.stringify(result.insertId));
            // console.log(`Order ${result.insertId} added to orders_stream`);

            return res.status(201).json({
                message: 'Order placed successfully',
                orderId: result.insertId
            });

        } catch (error) {
            // If anything goes wrong, roll back changes
            await connection.rollback();

             if (error.errno === 1213) {
                attempts++;
                // Exponential backoff + Jitter to reduce collisions
                const backoff = (attempts * 20) + Math.floor(Math.random() * 50);
                await sleep(backoff); 
                continue;        // Restart the loop
            }

            console.error(error);
            return res.status(500).json({ error: 'Database error' });
        } finally {
            // Always release the connection back to the pool
            connection.release();
        }
    }

    console.log("Fail deadlock");
    return res.status(503).json({ error: 'Server busy, please try again (Deadlock)' });
};