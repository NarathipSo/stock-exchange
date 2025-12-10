const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const orderBookController = require('../controllers/orderBookController');

router.post('/orders', orderController.placeOrder);
router.get('/orderbook/:symbol', orderBookController.getOrderBook);

module.exports = router;