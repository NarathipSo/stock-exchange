const db = require('../db');

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
        res.json(rows);
    } catch (error) {
        console.error("Error fetching market history:", error);
        res.status(500).json({ error: 'Server error' });
    }
};