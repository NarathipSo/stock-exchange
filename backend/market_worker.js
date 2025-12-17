const redis = require('./queue'); 
const { processTrade } = require('./services/candlestickService');
const subscriber = redis.duplicate();
console.log("Market Data Aggregator Service Started...");

subscriber.subscribe('market_data', (err) => {
    if (err) console.error("Failed to subscribe:", err);
    else console.log(`Listening for trades on 'market_data'...`);
});
subscriber.on('message', async (channel, message) => {
    if (channel === 'market_data') {
        try {
            const trade = JSON.parse(message);
            await processTrade(trade);
        } catch (e) {
            console.error("Aggregation Error:", e);
        }
    }
});