
const express = require('express');
const http = require('http');
const config = require('./src/config');
const logger = require('./src/logger');
const { initializeWebSocketServer } = require('./src/webSocketServer');

const app = express();
const server = http.createServer(app);

// Initialize the WebSocket server and attach it to the HTTP server
initializeWebSocketServer(server);

// A simple HTTP endpoint for health checks
app.get('/', (req, res) => {
    res.send(`Jules WebSocket Service is running on port ${config.port}.`);
});

server.listen(config.port, () => {
    logger.info(`Jules Service with WebSocket listening at http://localhost:${config.port}`);
});
