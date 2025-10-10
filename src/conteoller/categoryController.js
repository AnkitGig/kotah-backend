const Category = require('../models/Category');

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: 1 });
    res.json(categories);
  } catch (err) {
    console.error('getCategories error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// public - create category, only image and title required
exports.createCategory = async (req, res) => {
  try {
    const { title, description } = req.body || {};
    const file = req.file;
    const imageFromBody = req.body && req.body.image;
    const image = file ? `/uploads/${file.filename}` : imageFromBody;
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
