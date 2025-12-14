const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const redisClient = require('./queue'); // Reuse our connection config
const redisSubscriber = redisClient.duplicate(); // Create a dedicated connection for listening

const orderRoutes = require('./routes/orderRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app); // Wrap Express
const io = new Server(server, {        // Attach Socket.io
    cors: {
        origin: "http://localhost:5173", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

// Pass 'io' to every request so controllers can use it
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api', orderRoutes);

app.get('/', (req, res) => {
    res.send('High Frequency Trading Engine is running!');
});

// Socket Connection Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
    });
});

// Subscribe to the Redis channel
redisSubscriber.subscribe('trade_notifications', (err, count) => {
    if (err) console.error("Failed to subscribe: %s", err.message);
    else console.log(`Subscribed to ${count} channel(s).`);
});
// When a message arrives from the Worker...
redisSubscriber.on('message', (channel, message) => {
    console.log(`Received ${message} from ${channel}`);
    const data = JSON.parse(message);
    
    // Broadcast to all connected mechanisms (Frontend)
    io.emit('orderbook_update', data); 
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});