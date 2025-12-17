const redis = require('./queue');
const matchOrder = require('./services/matchingEngine');
const db = require('./db');

console.log("Worker Service Started...");

async function processQueue() {
    while (true) {
        try {
            // BRPOP: Blocking Right Pop. It waits forever (0) until an item arrives.
            // It returns an array: [key, value]
            const result = await redis.brpop('matching_queue', 0);
            const orderId = JSON.parse(result[1]);

            console.log(`Received Job: Order ID ${orderId}`);

            // Run the CPU-heavy matching logic
            const { matched, symbol, trades } = await matchOrder(orderId);
            
            if (symbol) {
                await updateOrderBookCache(symbol);
            }

            await redis.publish('trade_notifications', JSON.stringify({ 
                message: matched ? `Order ${orderId} matched` : `Order ${orderId} added`,
                orderId: orderId,
                symbol: symbol
            }));

            if (trades && trades.length > 0) {
                for (const trade of trades) {
                    await redis.publish('market_data', JSON.stringify(trade));
                    console.log(`[Event] Published trade for ${trade.symbol} @ ${trade.price}`);
                }
            }
            
        } catch (error) {
            console.error("Worker Error:", error);
        }
    }
}

async function updateOrderBookCache(symbol) {
    try {
        const [bids] = await db.query(
            `SELECT price, SUM(quantity) as quantity 
            FROM order_book 
            WHERE stock_symbol = ? AND order_type = 'BUY' AND (status = 'OPEN' OR status = 'PARTIAL')
            GROUP BY price 
            ORDER BY price DESC`,
            [symbol]
        );

        // Get Sell Orders (Asks) - Low prices on top
        const [offers] = await db.query(
            `SELECT price, SUM(quantity) as quantity 
            FROM order_book 
            WHERE stock_symbol = ? AND order_type = 'SELL' AND (status = 'OPEN' OR status = 'PARTIAL')
            GROUP BY price 
            ORDER BY price ASC`,
            [symbol]
        );

        const [currentPrice] = await db.query(
            `SELECT price 
            FROM trades 
            WHERE stock_symbol = ?
            ORDER BY executed_at DESC, id DESC
            LIMIT 1`,
            [symbol]
        );

        const responseData = { bids, offers, currentPrice };

        await redis.set(`orderbook:${symbol}`, JSON.stringify(responseData));
        console.log(`[Worker] Cache updated for ${symbol}`);
    }

    catch (err) {
        console.error("Failed to update cache:", err);
    }
}

processQueue();