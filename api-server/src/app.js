const express = require('express');
const dagController = require('./controllers/dagController');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'dagu-dag-management-api'
  });
});

// API routes
app.use('/api/cadence-event', dagController);

module.exports = app;
