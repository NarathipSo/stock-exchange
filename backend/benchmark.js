const axios = require('axios');
const http = require('http'); // HTTP Agent for Keep-Alive
const db = require('./db');
const redis = require('./queue');

const API_URL = 'http://localhost:3001/api/orders';
const TOTAL_ORDERS = 1000; // Increased Load
const CONCURRENCY = 50;    // Increased Concurrency

// Helper: Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function setupUser() {
    console.log("--- Setting up 50 Test Users ---");
    for (let i = 1; i <= 50; i++) {
        // Creates user if missing, or resets balance if exists.
        // 100% thread safe.
        await db.query(`
            INSERT INTO users (id, username, password_hash, balance_fiat, balance_stock_symbol) 
            VALUES (${i}, 'user${i}', 'password', 10000000, 10000000)
            ON DUPLICATE KEY UPDATE balance_fiat = 10000000, balance_stock_symbol = 10000000
        `);
    }
}

async function runBenchmark() {
    await setupUser();
    
    // Create Agent
    const httpAgent = new http.Agent({ keepAlive: true });

    // 1. Connect a Listener
    const subscriber = redis.duplicate();
    // ioredis connects automatically, no need for .connect() usually, but to be safe:
    if (subscriber.status === 'wait') await subscriber.connect();
    let processedCount = 0;
    const startTime = Date.now();
    // Correct IORedis Syntax:
    await subscriber.subscribe('trade_notifications');
    
    subscriber.on('message', (channel, message) => {
        if (channel === 'trade_notifications') {
            processedCount++;
            if (processedCount % 100 === 0) process.stdout.write('.');
        }
    });

    // 2. Blast the API
    console.log(`\n\n--- Starting Attack: ${TOTAL_ORDERS} Orders ---`);
    console.log(`--- Concurrency: ${CONCURRENCY} ---`);

    try {
        let sentCount = 0;
        
        while (sentCount < TOTAL_ORDERS) {
            const batch = [];
            for (let i = 0; i < CONCURRENCY; i++) {
                if (sentCount >= TOTAL_ORDERS) break;
                
                // Distribute load across Users 1 to 50
                const userId = (i % 50) + 1; 
                
                // Distribute load across 5 Symbols to allow parallel processing
                // const symbols = ['GOOGL', 'AAPL', 'MSFT', 'TSLA', 'AMZN'];
                // const symbol = symbols[Math.floor(Math.random() * symbols.length)];

                const type = sentCount % 2 === 0 ? 'BUY' : 'SELL';
                const price = 100 + (Math.random() * 5); 
                
                batch.push(
                    axios.post(API_URL, {
                        user_id: userId, 
                        stock_symbol: 'GOOGL', // <--- Random Symbol
                        order_type: type,
                        price: price.toFixed(2),
                        quantity: 1
                    }, { httpAgent }).catch(e => { /* Ignore errors */ }) // Use Agent
                );
                sentCount++;
            }
            await Promise.all(batch);
        }
        console.log(`\nAll ${sentCount} requests sent! Waiting for Worker...`);

    } catch (err) {
        console.error("Benchmark Error:", err);
    }

    // 3. Wait for Worker to finish
    // We poll until we get 1000 confirmations or timeout
    while (processedCount < TOTAL_ORDERS) {
        await sleep(100);

        // Timeout protection
        if (Date.now() - startTime > 60000) {
            console.log("\nTimeout waiting for worker!");
            break;
        }
    }

    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;
    const ops = TOTAL_ORDERS / durationSeconds;

    console.log(`\n\n================================`);
    console.log(` RESULTS`);
    console.log(`================================`);
    console.log(`Total Orders:    ${TOTAL_ORDERS}`);
    console.log(`Time Taken:      ${durationSeconds.toFixed(2)}s`);
    console.log(`Throughput:      ${ops.toFixed(0)} Orders/Sec`);
    console.log(`================================`);
    
    process.exit();
}

runBenchmark();