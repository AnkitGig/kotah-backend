const Category = require('../models/Category');
const path = require('path');

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: 1 });
    res.json(categories);
  } catch (err) {
    console.error('getCategories error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { title, description } = req.body || {};
    const file = req.file;
    const imageFromBody = req.body && req.body.image;

    let image;
    if (file) {
      try {
        const uploaderPath = path.join(__dirname, '..', 'utils', 'customUploader.js');
        const uploaderModule = require(uploaderPath);
        const customUploader = uploaderModule && uploaderModule.default ? uploaderModule.default : uploaderModule;
        const uploadedUrl = await customUploader({ file: req.file, folder: 'categories' });
        if (uploadedUrl) image = uploadedUrl;
        else image = req.file.path ? req.file.path.replace(/\\/g, '/') : `/uploads/${file.filename}`;
      } catch (e) {
        console.error('category image upload error', e);
        image = req.file.path ? req.file.path.replace(/\\/g, '/') : `/uploads/${file.filename}`;
      }
    } else {
      image = imageFromBody;
    }

    if (!title || !image)
      return res.status(400).json({ message: 'title and image required' });

    const category = new Category({ title, image, description });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    console.error('createCategory error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
