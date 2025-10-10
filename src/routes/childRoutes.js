const express = require('express');
const router = express.Router();
const childController = require('../conteoller/childController');
const auth = require('../middleware/authMiddleware..js');
const { upload } = require('../middleware/multer');

router.post('/', auth, upload.single('avatar'), childController.createChild);
router.get('/', auth, childController.listChildren);

router.post('/login-by-code', childController.childLogin);

module.exports = router;
