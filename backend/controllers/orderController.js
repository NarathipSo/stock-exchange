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

        const [users] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [user_id]);
        if (users.length === 0) throw new Error('User not found');
        const user = users[0];
        const totalValue = price * quantity;

        if (order_type === 'BUY') {
            if (parseFloat(user.balance_fiat) < totalValue) throw new Error('Insufficient funds');
            await connection.execute('UPDATE users SET balance_fiat = balance_fiat - ? WHERE id = ?', [totalValue, user_id]);
        } else {
            // SELL: Check Stock Balance in NEW TABLE
            const [stocks] = await connection.execute(
                'SELECT quantity FROM user_stocks WHERE user_id = ? AND stock_symbol = ? FOR UPDATE', 
                [user_id, stock_symbol]
            );
            
            const currentStock = stocks.length > 0 ? parseFloat(stocks[0].quantity) : 0;

            if (currentStock < quantity) throw new Error(`Insufficient ${stock_symbol} stock`);

            // Deduct Stock
            await connection.execute(
                'UPDATE user_stocks SET quantity = quantity - ? WHERE user_id = ? AND stock_symbol = ?', 
                [quantity, user_id, stock_symbol]
            );
        }

        await connection.commit();
        const rawId = await redis.incr('global_order_id');
        const orderId = rawId.toString().padStart(12, '0');

        const orderData = {
            id: orderId,
            user_id,
            stock_symbol,
            order_type,
            price: parseFloat(price),
            quantity: parseFloat(quantity),
            timestamp: Date.now()
        };

        await redis.hset(`order:${orderId}`, orderData);
        // 5. Push to Matching Engine (Sharded Stream)
        // Stream Key: orders_stream:GOOGL, orders_stream:AAPL, etc.
        const streamKey = `orders_stream:${stock_symbol}`;
        await redis.xadd(streamKey, '*', 'data', JSON.stringify(orderData));

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