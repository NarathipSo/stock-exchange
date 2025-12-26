const db = require('../db');
const redis = require('../queue');

exports.placeOrder = async (req, res) => {
    const { user_id, stock_symbol, order_type, price, quantity } = req.body;

    if (!user_id || !stock_symbol || !price || !quantity || !order_type) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    if (parseFloat(price) <= 0 || parseFloat(quantity) <= 0) {
        return res.status(400).json({ error: 'Positive numbers only' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Lock User & Check Balance (Keep SQL for safety)
        const [users] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [user_id]);
        if (users.length === 0) throw new Error('User not found');
        const user = users[0];
        const totalValue = price * quantity;

        if (order_type === 'BUY') {
            if (parseFloat(user.balance_fiat) < totalValue) throw new Error('Insufficient funds');
            await connection.execute('UPDATE users SET balance_fiat = balance_fiat - ? WHERE id = ?', [totalValue, user_id]);
        } else {
            if (parseFloat(user.balance_stock_symbol) < quantity) throw new Error('Insufficient stock');
            await connection.execute('UPDATE users SET balance_stock_symbol = balance_stock_symbol - ? WHERE id = ?', [quantity, user_id]);
        }

        await connection.commit();

        const rawId = await redis.incr('global_order_id');
        // PAD ID: "1" -> "000000000001" (Ensures String Sort == Integer Sort)
        const orderId = rawId.toString().padStart(12, '0');

        // 3. Create Order Object
        const orderData = {
            id: orderId,
            user_id,
            stock_symbol,
            order_type,
            price: parseFloat(price),
            quantity: parseFloat(quantity),
            timestamp: Date.now()
        };

        // 4. Save Order Details to Redis Hash (for lookup)
        await redis.hset(`order:${orderId}`, orderData);

        // 5. Push to Matching Engine
        await redis.xadd('orders_stream', '*', 'data', JSON.stringify(orderData));

        res.status(201).json({ message: 'Order Queued', orderId });
        // console.log(`Order ${orderId} added to orders_stream`);

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};