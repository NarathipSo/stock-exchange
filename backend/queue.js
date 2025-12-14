const Redis = require('ioredis');

// Connect to Redis running in Docker
// standard port is 6379, host is 'localhost' (since we are outside docker calling in)
const redis = new Redis({
    host: 'localhost', 
    port: 6379,
});

redis.on('connect', () => {
    console.log('Redis connected');
});

redis.on('error', (err) => {
    console.error('Redis error:', err);
});

module.exports = redis;