const redis = require('./queue');

async function debug() {
    const cmd = process.argv[2];

    try {
        if (cmd === 'clear') {
            console.log("⚠️  Clearing ALL Redis Data...");
            await redis.flushall();
            console.log("✅ Redis Flushed.");
        } 
        else if (cmd === 'list') {
            const keys = await redis.keys('*');
            console.log("🔑 Keys in Redis:", keys.length);
            keys.forEach(k => console.log(` - ${k}`));
        }
        else if (cmd === 'get') {
            const key = process.argv[3];
            if (!key) return console.log("Usage: node debug_helper.js get <key>");
            
            const type = await redis.type(key);
            console.log(`Type: ${type}`);

            if (type === 'string') console.log(await redis.get(key));
            if (type === 'hash') console.table(await redis.hgetall(key));
            if (type === 'zset') console.log(await redis.zrange(key, 0, -1, 'WITHSCORES'));
            if (type === 'stream') console.log("Stream data too large to dump. Use redis-cli.");
        }
        else {
            console.log(`
Usage:
  node debug_helper.js list        -> List all keys
  node debug_helper.js get <key>   -> Show content of boolean/hash/zset
  node debug_helper.js clear       -> DELETE EVERYTHING
`);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

debug();
