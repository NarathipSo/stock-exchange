const db = require('../db');
const redis = require('../queue');

let currentCandles = {}; 

const INTERVAL = 60 * 1000; // 1 Minute

// Helper to get the start time of the current minute
const getMinuteStart = (date) => {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d.getTime();
};

const processTrade = async (trade) => {
    const symbol = trade.symbol;
    const price = parseFloat(trade.price);
    const volume = parseFloat(trade.quantity);
    const timestamp = new Date(trade.timestamp).getTime();

    const candleStartTime = getMinuteStart(timestamp);
    
    // Check if we have a candle in memory for this symbol
    if (!currentCandles[symbol]) {
        currentCandles[symbol] = {
            symbol: symbol,
            startTime: candleStartTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: volume
        };
    } else {
        const candle = currentCandles[symbol];

        if (candleStartTime > candle.startTime) {
            await saveCandle(candle); 
            
            // Start new candle
            currentCandles[symbol] = {
                symbol: symbol,
                startTime: candleStartTime,
                open: price,
                high: price,
                low: price,
                close: price,
                volume: volume
            };
        } else {
            // Update existing candle
            candle.high = Math.max(candle.high, price);
            candle.low = Math.min(candle.low, price);
            candle.close = price;
            candle.volume += volume;
        }
    }

    await redis.set(
        `partial_candle:${symbol}`, 
        JSON.stringify(currentCandles[symbol])
    );
    // console.log(`Partial candle saved for ${symbol}`);
};

const saveCandle = async (candle) => {
    try {
        const sql = `INSERT INTO candlesticks (stock_symbol, interval_type, open_price, high_price, low_price, close_price, volume, start_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const values = [
             candle.symbol, 
             '1m', 
             candle.open, 
             candle.high, 
             candle.low, 
             candle.close, 
             candle.volume, 
             new Date(candle.startTime)
        ];
        
        await db.query(sql, values);
        // console.log(`[Aggregator] Saved 1m candle for ${candle.symbol}`);
    } catch (err) {
        console.error("Failed to save candle:", err);
    }
};

// Function to force-save all candles
const flushRawCandles = async () => {
    const symbols = Object.keys(currentCandles);
    for (const sym of symbols) {
        await saveCandle(currentCandles[sym]);
        delete currentCandles[sym];
    }
};

module.exports = { processTrade };
