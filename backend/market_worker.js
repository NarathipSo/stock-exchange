const redis = require('./queue'); 
const { processTrade } = require('./services/candlestickService');

const STREAM_KEY = 'market_events';
const GROUP_NAME = 'aggregator_group';
const CONSUMER_NAME = 'worker_1'; // unique per instance in production
async function setup() {
    try {
        // Create consumer group
        // '$' means start reading only NEW messages. Use '0' to read all history.
        await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM');
        // console.log("Aggregator Consumer Group created");
    } catch (err) {
        if (!err.message.includes('BUSYGROUP')) throw err;
    }
}
async function run() {
    await setup();
    
    console.log(`Waiting for stream events...`);
    
    while (true) {
        try {
            // BLOCK 0 = wait forever
            // '>' = verify messages that have never been delivered to other consumers in this group
            const response = await redis.xreadgroup(
                'GROUP', GROUP_NAME, CONSUMER_NAME,
                'BLOCK', '0',
                'STREAMS', STREAM_KEY, '>'
            );
            if (response) {
                const [streamName, messages] = response[0];
                
                for (const message of messages) {
                    const id = message[0];
                    const rawData = message[1][1]; // Field is at index 0, Value at index 1. We used key 'data'
                    
                    try {
                        const tradeData = JSON.parse(rawData);
                        await processTrade(tradeData);
                        
                        // ACK
                        await redis.xack(STREAM_KEY, GROUP_NAME, id);
                        // console.log(`Processed & Acked ${id}`);
                    } catch (err) {
                        console.error(`Failed to process ${id}:`, err);
                        // Do NOT ack. It will be retried later (requires a retry mechanism loop, omitted for brevity)
                    }
                }
            }
        } catch (error) {
            console.error("Stream Error:", error);
            // Wait a bit before retrying loop to avoid tight failure loops
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}
run();