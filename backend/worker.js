const redis = require('./queue');
const matchOrder = require('./services/matchingEngine');
const db = require('./db');

const STREAM_KEY = 'orders_stream';
const GROUP_NAME = 'matching_group';
const CONSUMER_NAME = process.argv[2] || 'matcher_1';

console.log(`Worker Service Started as ${CONSUMER_NAME}...`);

async function processQueue() {

    // 1. Create Consumer Group (idempotent check)
    try {
        await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM');
        // console.log("Matching Consumer Group Created");
    } catch (err) {
        if (!err.message.includes('BUSYGROUP')) console.error(err);
    }

    while (true) {
        try {
            // 2. Read from Stream (Consumer Group)
            const response = await redis.xreadgroup(
                'GROUP', GROUP_NAME, CONSUMER_NAME,
                'BLOCK', '0',
                'STREAMS', STREAM_KEY, '>' // '>' means new messages
            );
            if (response) {
                const [stream, messages] = response[0];
                for (const message of messages) {
                    const id = message[0];
                    const orderId = JSON.parse(message[1][1]); // value is at index 1

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
                            await redis.xadd('market_events', '*', 'data', JSON.stringify(trade));
                            // console.log(`Added trade for ${trade.symbol} to market_events stream`);

                            await redis.publish('public_market_ticks', JSON.stringify({
                                type: 'TRADE_TICK',
                                symbol: trade.symbol,
                                price: trade.price,
                                quantity: trade.quantity,
                                timestamp: new Date().getTime()
                            }));
                        }
                    }

                    // ACK
                    await redis.xack(STREAM_KEY, GROUP_NAME, id);
                    // console.log(`Processed and Acked Order ${orderId} (Stream ID: ${id})`);
                }
            }

        } catch (error) {
            console.error("Worker Error:", error);

            // Wait a bit before retrying loop to avoid tight failure loops
            await new Promise(r => setTimeout(r, 2000));
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
        // console.log(`[Worker] Cache updated for ${symbol}`);
    }

    catch (err) {
        console.error("Failed to update cache:", err);
    }
}

processQueue();