const express = require('express');
const { register, login, getProfile, updateProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Authentication routes
router.post('/login', login);
router.post('/register', register);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

module.exports = router;