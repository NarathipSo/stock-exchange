const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const redisClient = require('./queue'); // Reuse our connection config
const redisSubscriber = redisClient.duplicate(); // Create a dedicated connection for listening

const orderRoutes = require('./routes/orderRoutes');
const marketRoutes = require('./routes/marketRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app); // Wrap Express
const io = new Server(server, {        // Attach Socket.io
    cors: {
        origin: "http://localhost:5173", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Pass 'io' to every request so controllers can use it
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api', orderRoutes);
app.use('/api', marketRoutes);

app.get('/', (req, res) => {
    res.send('High Frequency Trading Engine is running!');
});

// Socket Connection Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_stock', (symbol) => {
        socket.join(symbol);
        console.log(`Socket ${socket.id} joined ${symbol}`);
    });
    socket.on('leave_stock', (symbol) => {
        socket.leave(symbol);
        console.log(`Socket ${socket.id} left ${symbol}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
    });
});

redisSubscriber.subscribe('trade_notifications', 'public_market_ticks', (err, count) => {
    if (err) console.error("Failed to subscribe: %s", err.message);
});

redisSubscriber.on('message', (channel, message) => {
    const data = JSON.parse(message);
    if (channel === 'trade_notifications') {
        if (data.symbol) {
            io.to(data.symbol).emit('orderbook_update', data); 
        }
    } 
    else if (channel === 'public_market_ticks') {
         if (data.symbol) {
            io.to(data.symbol).emit('market_tick', data); 
        }
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});