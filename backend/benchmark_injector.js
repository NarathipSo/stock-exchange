const Redis = require('ioredis');

const SYMBOL = process.argv[2] || 'BENCH'; 
const TOTAL_ORDERS = 1000;
const BATCH_SIZE = 100; 

const redis = new Redis({ host: 'localhost', port: 6379 });

async function injectOrders() {
    console.log(`\n=== INJECTOR STARTED ===`);
    console.log(`Target: ${TOTAL_ORDERS} orders for ${SYMBOL}`);
    
    const streamKey = `orders_stream:${SYMBOL}`;
    
    // SAFE CLEAR: Trim to 0 instead of deleting the key (preserves Consumer Groups)
    await redis.xtrim(streamKey, 'MAXLEN', 0); 

    let pipeline = redis.pipeline();
    const startTime = Date.now();

    for (let i = 0; i < TOTAL_ORDERS; i++) {
        const order = {
            id: `bench_${i}`,
            user_id: 1,
            stock_symbol: SYMBOL,
            order_type: i % 2 === 0 ? 'BUY' : 'SELL',
            price: 100 + (Math.random() * 5),
            quantity: 1
        };

        pipeline.xadd(streamKey, '*', 'data', JSON.stringify(order));

        if ((i + 1) % BATCH_SIZE === 0) {
            await pipeline.exec();
            pipeline = redis.pipeline();
            process.stdout.write('.');
        }
    }
    await pipeline.exec();
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n\nInjection Complete: ${(TOTAL_ORDERS / duration).toFixed(0)} ops routed to Redis`);
    process.exit(0);
}

injectOrders();