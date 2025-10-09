const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware..js');
const authController = require('../conteoller/authController');

router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
