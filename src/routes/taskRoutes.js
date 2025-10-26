const express = require('express');
const router = express.Router();
const taskController = require('../conteoller/taskController');
const auth = require('../middleware/authMiddleware..js');
const upload = require('../middleware/multer.js');

// parent creates and lists
router.post('/', auth, upload.uploadSingle('image'), taskController.createTask);
router.get('/parent', auth, taskController.listTasksForParent);

// parent verifies and awards
router.post('/verify', auth, taskController.verifyAndAward);

// child routes
router.get('/child', auth, taskController.listTasksForChild);
router.post('/complete', auth, taskController.markCompleteByChild);
router.get('/dashboard', auth, taskController.dashboard);  

module.exports = router;
