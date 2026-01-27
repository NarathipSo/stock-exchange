const autocannon = require('autocannon');

console.log("\n=== RANDOMIZED STRESS TEST ===");
console.log("Simulating 100 Concurrent Users (IDs 1-50)...");

const instance = autocannon({
  url: 'http://localhost:3001/api/orders',
  connections: 100, // Concurrent Connections
  duration: 10,     // Seconds
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  requests: [
    {
      setupRequest: (req) => {
        // Randomize User ID (1-50) to avoid Row Locking
        const randomUser = Math.floor(Math.random() * 50) + 1;
        
        req.body = JSON.stringify({
           user_id: randomUser,
           stock_symbol: 'BENCH',
           order_type: 'BUY',
           price: 150,
           quantity: 1
        });
        return req;
      }
    }
  ]
});

autocannon.track(instance, { renderProgressBar: true });

instance.on('done', (result) => {
    console.log("\n\n=== RESULTS ===");
    console.log(`Requests/Sec: ${result.requests.average}`);
    console.log(`Latency (Avg): ${result.latency.average} ms`);
    console.log(`Errors:       ${result.errors}`);
});
