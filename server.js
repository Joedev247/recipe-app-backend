require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const recipeRoutes = require('./routes/recipes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Replace with your frontend domain
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('🎯 Connected to MongoDB successfully');
  console.log(`📊 Database: ${mongoose.connection.name}`);
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  console.log('💡 Make sure MongoDB is running on localhost:27017');
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Recipe Sharing Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler - this should be last
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      message: 'API route not found'
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  
  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large'
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
});

module.exports = app;