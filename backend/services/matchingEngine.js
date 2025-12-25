const redis = require('../queue');

const matchOrder = async (order) => {
    const { id, user_id, stock_symbol, order_type, price, quantity } = order;
    let remainingQty = parseFloat(quantity);
    let trades = [];
    let matched = false;
    
    // ZSETS: Bids = High Score, Asks = Low Score
    const isBuy = order_type === 'BUY';
    const oppositeBookKey = `orderbook:${stock_symbol}:${isBuy ? 'asks' : 'bids'}`;
    const myBookKey = `orderbook:${stock_symbol}:${isBuy ? 'bids' : 'asks'}`;
    
    try {
        // Loop until filled or no match
        while (remainingQty > 0) {
            // Get Best Price from Opposite Book
            const bestOrders = await redis.zrange(oppositeBookKey, 0, 0);

            if (bestOrders.length === 0) break; // No counter orders

            const bestOrderId = bestOrders[0];
            const bestOrderData = await redis.hgetall(`order:${bestOrderId}`);
            
            if (!bestOrderData || !bestOrderData.price) {
                await redis.zrem(oppositeBookKey, bestOrderId); // Cleanup bad data
                continue;
            }

            const bestPrice = parseFloat(bestOrderData.price);
            const bestQty = parseFloat(bestOrderData.quantity);

            // Price Check
            if (isBuy && bestPrice > price) break; // Too expensive
            if (!isBuy && bestPrice < price) break; // Too cheap

            // Execute Match
            const tradeQty = Math.min(remainingQty, bestQty);
            
            // Update Amounts
            remainingQty -= tradeQty;
            const remainingBestQty = bestQty - tradeQty;

            // Persist Trade Request (Async)
            const tradeEvent = {
                buyer_id: isBuy ? user_id : bestOrderData.user_id,
                seller_id: isBuy ? bestOrderData.user_id : user_id,
                symbol: stock_symbol,
                price: bestPrice,
                quantity: tradeQty,
                buyer_refund: isBuy ? (price - bestPrice) * tradeQty : 0,
                timestamp: Date.now()
            };

            await redis.set(`last_price:${stock_symbol}`, bestPrice);
            trades.push(tradeEvent);
            matched = true;

            // Update Opposite Order
            if (remainingBestQty > 0) {
                await redis.hset(`order:${bestOrderId}`, 'quantity', remainingBestQty);
                // No need to update ZScore
            } else {
                await redis.del(`order:${bestOrderId}`);
                await redis.zrem(oppositeBookKey, bestOrderId);
            }
        }

        // Add Remaining to Book
        if (remainingQty > 0) {
            await redis.hset(`order:${id}`, 'quantity', remainingQty);

            // Buy = -Price (so ZRANGE gives Highest Price first)
            // Sell = +Price (so ZRANGE gives Lowest Price first)
            const score = isBuy ? -price : price;
            
            await redis.zadd(myBookKey, score, id);
        }
    } catch (error) {
        console.error("Matching Error:", error);
    }

    return { matched, symbol: stock_symbol, trades };
};

module.exports = matchOrder;