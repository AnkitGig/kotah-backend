const express = require('express');
const router = express.Router();
const rewardController = require('../conteoller/rewardController');
const auth = require('../middleware/authMiddleware..js');

router.get('/', auth, rewardController.listRewards);
router.get('/for-child', auth, rewardController.listRewards);
router.post('/', auth, rewardController.createReward);
router.post('/claim', auth, rewardController.claimReward);

module.exports = router;
