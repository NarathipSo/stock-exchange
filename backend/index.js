const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');


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

// Socket Connection Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});