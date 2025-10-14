const express = require('express');
const router = express.Router();
const holidayController = require('../conteoller/holidayController');

// GET /api/holidays
router.get('/', holidayController.getHolidays);

module.exports = router;
