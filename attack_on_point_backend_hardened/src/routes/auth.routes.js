const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/userAuth.middleware');

// User provisioning is an internal company operation; public registration is disabled.
router.post('/login', login);
router.get('/me', protect, getMe);  // logged-in user ka profile fetch karne ke liye

module.exports = router;
