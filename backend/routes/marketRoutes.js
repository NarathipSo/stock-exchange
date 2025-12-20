const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');

router.get('/market/history', marketController.getMarketHistory);

module.exports = router;
