const redis = require('../queue');

exports.getOrderBook = async (req, res) => {
    const { symbol } = req.params;
    
    try {
        // Fetch ALL IDs (or lots of them)
        const buyIds = await redis.zrange(`orderbook:${symbol}:bids`, 0, -1);
        const askIds = await redis.zrange(`orderbook:${symbol}:asks`, 0, -1);

        const buildAndAggregate = async (ids, isBuy) => {
            const priceMap = new Map();
            
            for (const id of ids) {
                const data = await redis.hgetall(`order:${id}`);
                if (data.price) {
                    const p = parseFloat(data.price);
                    const q = parseFloat(data.quantity);
                    
                    if (priceMap.has(p)) {
                        priceMap.set(p, priceMap.get(p) + q);
                    } else {
                        priceMap.set(p, q);
                    }
                }
            }
            
            // Convert Map to Array
            const result = [];
            priceMap.forEach((qty, price) => {
                result.push({ price, quantity: qty });
            });

            // Sort: Bids (Desc), Asks (Asc)
            return result.sort((a, b) => isBuy ? b.price - a.price : a.price - b.price);
        };

        const bids = await buildAndAggregate(buyIds, true);
        const offers = await buildAndAggregate(askIds, false);
        const lastPrice = await redis.get(`last_price:${symbol}`) || 0;
        
        res.json({ bids, offers, currentPrice: [{ price: parseFloat(lastPrice) }] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};