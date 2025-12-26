const redis = require('./queue');
const matchOrder = require('./services/matchingEngine');
const db = require('./db');

const STREAM_KEY = 'orders_stream';
const GROUP_NAME = 'matching_group';
const CONSUMER_NAME = process.argv[2] || 'matcher_1';

console.log(`Worker Service Started as ${CONSUMER_NAME}...`);

// helper function 
const fieldsToObject = (fields) => {
    const obj = {};
    for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
    }
    return obj;
};

async function getOrderBookSnapshot(symbol) {
    const buyIds = await redis.zrange(`orderbook:${symbol}:bids`, 0, 9); 
    const askIds = await redis.zrange(`orderbook:${symbol}:asks`, 0, 9);
    const lastPrice = await redis.get(`last_price:${symbol}`) || 0;

    const buildAndAggregate = async (ids, isBuy) => {
        const pipeline = redis.pipeline();
        for (const id of ids) {
            pipeline.hgetall(`order:${id}`);
        }
        
        const results = await pipeline.exec(); // [[err, result], [err, result]]
        
        const priceMap = new Map();
        for (const [err, data] of results) {
            if (data && data.price) {
                const p = parseFloat(data.price);
                const q = parseFloat(data.quantity);
                if (priceMap.has(p)) priceMap.set(p, priceMap.get(p) + q);
                else priceMap.set(p, q);
            }
        }
        
        const result = [];
        priceMap.forEach((qty, price) => result.push({ price, quantity: qty }));
        return result.sort((a, b) => isBuy ? b.price - a.price : a.price - b.price).slice(0, 10);
    };

    return {
        bids: await buildAndAggregate(buyIds, true),
        offers: await buildAndAggregate(askIds, false),
        currentPrice: [{ price: parseFloat(lastPrice) }]
    };
}

async function processQueue() {

    // 1. Create Consumer Group (idempotent check)
    try {
        await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM');
        console.log("Matching Consumer Group Created");
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

                    const rawData = fieldsToObject(message[1]);
                    const orderData = JSON.parse(rawData.data);

                    // Run the CPU-heavy matching logic
                    // Run the CPU-heavy matching logic
                    const { matched, symbol, trades } = await matchOrder(orderData);

                    // PIPELINE SIDE EFFECTS (Reduce RTT)
                    const pipeline = redis.pipeline();

                    if (symbol) {
                        const snapshot = await getOrderBookSnapshot(symbol);
                        pipeline.publish('trade_notifications', JSON.stringify(snapshot));
                    }

                    if (trades && trades.length > 0) {
                        for (const trade of trades) {
                            pipeline.xadd('trades_persistence', '*', 'data', JSON.stringify(trade));
                            pipeline.xadd('market_events', '*', 'data', JSON.stringify(trade));
                            
                            pipeline.publish('public_market_ticks', JSON.stringify({
                                type: 'TRADE_TICK',
                                symbol: trade.symbol,
                                price: trade.price,
                                quantity: trade.quantity,
                                timestamp: Date.now()
                            }));
                        }
                    }

                    // ACK
                    pipeline.xack(STREAM_KEY, GROUP_NAME, id);
                    
                    // Execute all writes in ONE Round Trip
                    await pipeline.exec();
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

        // await redis.set(`orderbook:${symbol}`, JSON.stringify(responseData));
        // console.log(`[Worker] Cache updated for ${symbol}`);
    }

    catch (err) {
        console.error("Failed to update cache:", err);
    }
}

processQueue();