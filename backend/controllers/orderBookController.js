const db = require('../db');
const redis = require('../queue');

exports.getOrderBook = async (req, res) => {
    const { symbol } = req.params;
    const cacheKey = `orderbook:${symbol}`;

    try {
         // 1. FAST PATH: Check Redis Cache first
        const cachedData = await redis.get(cacheKey);
        
        if (cachedData) {
            console.log(`Cache Hit for ${symbol}`);
            return res.json(JSON.parse(cachedData));
        }

        // 2. SLOW PATH: Database Query (Cache Miss)
        
        // Get Buy Orders (Bids) - High prices on top
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
        // 3. SAVE to Redis with 5 Second Expiry (TTL)
        // 'ex' means expire, 3 is seconds.

        await redis.set(cacheKey, JSON.stringify(responseData));
        console.log(`Cache Set for ${symbol}`);
        
        res.json(responseData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching order book' });
    }
};