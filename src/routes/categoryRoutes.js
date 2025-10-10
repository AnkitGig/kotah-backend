const express = require('express');
const router = express.Router();
const categoryController = require('../conteoller/categoryController');
const { uploadSingle } = require('../middleware/multer');

router.get('/', categoryController.getCategories);
router.post('/', uploadSingle('image'), categoryController.createCategory);

module.exports = router;
