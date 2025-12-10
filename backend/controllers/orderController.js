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

        // 4. Insert the Order into the Order Book
        const [result] = await connection.execute(
            `INSERT INTO order_book (user_id, stock_symbol, order_type, price, quantity) 
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, stock_symbol, order_type, price, quantity]
        );

        // 5. Commit the transaction (Save changes)
        await connection.commit();

        res.status(201).json({
            message: 'Order placed successfully',
            orderId: result.insertId
        });

        // 6. Trigger the Matching Engine
        await matchOrder(result.insertId);

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