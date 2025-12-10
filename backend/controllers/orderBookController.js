const db = require('../db');

exports.getOrderBook = async (req, res) => {
    const { symbol } = req.params;

    try {
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

        res.json({ bids, offers, currentPrice });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching order book' });
    }
};