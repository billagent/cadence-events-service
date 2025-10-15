const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const app = require('./src/app');
const errorHandler = require('./src/middleware/errorHandler');

const PORT = process.env.API_PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`DAG Management API server running on port ${PORT}`);
});

module.exports = app;
