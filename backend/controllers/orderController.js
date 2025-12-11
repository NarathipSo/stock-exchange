const db = require('../db');
const matchOrder = require('../services/matchingEngine');

exports.placeOrder = async (req, res) => {
    // 1. Destructure the request body
    const { user_id, stock_symbol, order_type, price, quantity } = req.body;

    // 2. Basic Validation (Don't trust the client!)
    if (!user_id || !stock_symbol || !price || !quantity || !order_type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // connection from the pool
    const connection = await db.getConnection();

    try {
        // 3. Start a Transaction (Good habit for finance, even if simple now)
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

        req.io.emit('orderbook_update', { message: 'New order placed' });

        res.status(201).json({
            message: 'Order placed successfully',
            orderId: result.insertId
        });

        // 6. Trigger the Matching Engine
        const matchedFlag = await matchOrder(result.insertId);

        if (matchedFlag) {
            req.io.emit('orderbook_update', { message: 'Order matched' });
        }

    } catch (error) {
        // If anything goes wrong, roll back changes
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    } finally {
        // Always release the connection back to the pool
        connection.release();
    }
};