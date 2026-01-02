const { spawn } = require('child_process');

const symbols = ['GOOGL', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NFLX', 'NVDA', 'BABA', 'IBM'];

console.log(`Starting workers for ${symbols.length} symbols...`);

symbols.forEach((symbol) => {
    const worker = spawn('node', ['worker.js', symbol], {
        stdio: 'inherit', // Pipe output to parent console
        shell: true
    });

    worker.on('close', (code) => {
        console.log(`Worker for ${symbol} exited with code ${code}`);
    });
});

console.log("All workers spawned.");
