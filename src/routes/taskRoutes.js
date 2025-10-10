const express = require('express');
const router = express.Router();
const taskController = require('../conteoller/taskController');
const auth = require('../middleware/authMiddleware..js');

// parent creates and lists
router.post('/', auth, taskController.createTask);
router.get('/parent', auth, taskController.listTasksForParent);

// parent verifies and awards
router.post('/:taskId/verify', auth, taskController.verifyAndAward);

// child routes
router.get('/child', auth, taskController.listTasksForChild);
router.post('/:taskId/complete', auth, taskController.markCompleteByChild);

module.exports = router;
