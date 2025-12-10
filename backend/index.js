const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const orderRoutes = require('./routes/orderRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', orderRoutes);

app.get('/', (req, res) => {
    res.send('High-Frequency Trading Engine API is running...');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});