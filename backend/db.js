const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

// Create a connection pool (better performance than single connection)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Export the promise-based wrapper
module.exports = pool.promise();