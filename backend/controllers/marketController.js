const db = require('../db');
const redis = require('../queue');

exports.getMarketHistory = async (req, res) => {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    try {
        const [rows] = await db.query(
            `SELECT * FROM candlesticks WHERE stock_symbol = ? ORDER BY start_time ASC`,
            [symbol]
        );

        const partialData = await redis.get(`partial_candle:${symbol}`);

        if (partialData) {
            const partial = JSON.parse(partialData);
            // Append it to the list
            rows.push({
                start_time: new Date(partial.startTime), // Ensure format matches MySQL return
                open_price: partial.open,
                high_price: partial.high,
                low_price: partial.low,
                close_price: partial.close,
                volume: partial.volume
            });
        }

        res.json(rows);
    } catch (error) {
        console.error("Error fetching market history:", error);
        res.status(500).json({ error: 'Server error' });
    }
};