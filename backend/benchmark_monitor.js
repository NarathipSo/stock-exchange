const Redis = require('ioredis');

// Take symbol from Argument or default to BENCH
const SYMBOL = process.argv[2] || 'BENCH';
const TOTAL_ORDERS = 1000;

console.log(`\n=== MONITOR STARTED ===`);
console.log(`Target Symbol:   ${SYMBOL}`);
console.log(`Target Count:    ${TOTAL_ORDERS}`);
console.log(`------------------------`);

async function monitor() {
    const subscriber = new Redis({ host: 'localhost', port: 6379 });

    await subscriber.subscribe('trade_notifications');

    let processedCount = 0;
    let startTime = 0;

    subscriber.on('message', (channel, message) => {
        if (channel !== 'trade_notifications') return;

        // Smart Filter: Only count trades for our target symbol
        const data = JSON.parse(message);
        if (data.symbol !== SYMBOL) return;

        processedCount++;

        // Start timer on FIRST processed message
        if (processedCount === 1) {
            startTime = Date.now();
            console.log(`\n[First '${SYMBOL}' Order Detected] Timer Started...`);
        }

        if (processedCount % 5000 === 0) process.stdout.write('#');

        // Stop timer on LAST processed message
        if (processedCount >= TOTAL_ORDERS) {
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            const ops = TOTAL_ORDERS / duration;

            console.log(`\n\n=== RESULTS for ${SYMBOL} ===`);
            console.log(`Processed:   ${processedCount}`);
            console.log(`Duration:    ${duration.toFixed(4)} s`);
            console.log(`Throughput:  ${ops.toFixed(0)} orders/sec`);
            console.log(`================`);
            process.exit(0);
        }
    });
}

monitor();