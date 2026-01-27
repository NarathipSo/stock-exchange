const db = require('./db');
const redis = require('./queue');

const STREAM_KEY = 'trades_persistence';
const GROUP_NAME = 'persistence_group';
const CONSUMER_NAME = 'persister_1';

async function setup() {
    try {
        await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM');
        console.log("Persistence Consumer Group Created");
    } catch (err) {
        // Ignore if exists
    }
}

async function processMessages(messages) {
    for (const msg of messages) {
        const id = msg[0];
        const rawData = msg[1][1];
        const trade = JSON.parse(rawData);

        try {
            // 1. Save Trade to DB
            await db.query(
                `INSERT INTO trades (buyer_id, seller_id, stock_symbol, price, quantity) VALUES (?, ?, ?, ?, ?)`,
                [trade.buyer_id, trade.seller_id, trade.symbol, trade.price, trade.quantity]
            );

            // 2. Credit the Seller (Cash)
            const totalValue = trade.price * trade.quantity;
            await db.query(`UPDATE users SET balance_fiat = balance_fiat + ? WHERE id = ?`, [totalValue, trade.seller_id]);

            // 3. Credit the Buyer (Stock)
            await db.query(`UPDATE user_stocks SET quantity = quantity + ? WHERE user_id = ? AND stock_symbol = ?`, [trade.quantity, trade.buyer_id, trade.symbol]);

            // 4. Refund Buyer (Price Improvement)
            if (trade.buyer_refund > 0) {
                await db.query(`UPDATE users SET balance_fiat = balance_fiat + ? WHERE id = ?`, [trade.buyer_refund, trade.buyer_id]);
            }

            await redis.xack(STREAM_KEY, GROUP_NAME, id);
            // console.log(`Persisted trade ${id}`);
        } catch (err) {
            console.error(`Failed to process trade ${id}:`, err);
            // We do NOT ack here, so it remains in PEL for retry
        }
    }
}

async function run() {
    await setup();
    console.log("Persistence Worker Running...");

    // 1. Crash Recovery: Check for Pending Messages (ID '0')
    try {
        const pendingResponse = await redis.xreadgroup('GROUP', GROUP_NAME, CONSUMER_NAME, 'STREAMS', STREAM_KEY, '0');
        if (pendingResponse) {
            const messages = pendingResponse[0][1];
            if (messages.length > 0) {
                console.log(`Recovering ${messages.length} pending messages...`);
                await processMessages(messages);
            }
        }
    } catch (err) {
        console.error("Error during recovery:", err);
    }

    // 2. Main Loop: Process New Messages (ID '>')
    while (true) {
        try {
            const response = await redis.xreadgroup('GROUP', GROUP_NAME, CONSUMER_NAME, 'BLOCK', '0', 'STREAMS', STREAM_KEY, '>');
            
            if (response) {
                const messages = response[0][1];
                await processMessages(messages);
            }
        } catch (err) {
            console.error(err);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

run();