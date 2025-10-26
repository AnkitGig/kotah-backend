const express = require('express');
const router = express.Router();
const rewardController = require('../conteoller/rewardController');
const auth = require('../middleware/authMiddleware..js');
const multerMiddleware = require('../middleware/multer');

router.get('/', auth, rewardController.listRewards);
router.get('/for-child', auth, rewardController.listRewards);
router.post('/', auth, multerMiddleware.uploadSingle('image'), rewardController.createReward);
router.post('/claim', auth, rewardController.claimReward);

module.exports = router;
