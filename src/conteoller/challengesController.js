const Challenge = require('../models/Challenge');

// GET /challenges - return all challenges
exports.getChallenges = async (req, res) => {
  try {
    const challenges = await Challenge.find().sort({ createdAt: -1 }).lean();
    return res.json({ status: true, challenges });
  } catch (err) {
    console.error('getChallenges error', err);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
};

// POST /challenges - create a new challenge (expects multipart/form-data)
exports.createChallenge = async (req, res) => {
  try {
    // multer places file info on req.file when using uploadSingle('image')
    const { title, description, categories, daysRemaining } = req.body || {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ status: false, message: 'title is required' });
    }

    // dynamic import because utils/customUploader is an ES module
    let uploadedUrl = null;
    if (req.file) {
      try {
        const { default: customUploader } = await import('../utils/customUploader.js');
        uploadedUrl = await customUploader({ file: req.file, folder: 'challenges' });
      } catch (e) {
        console.error('upload error', e);
        return res.status(500).json({ status: false, message: 'Image upload failed' });
      }
    }

    const toCreate = {
      title,
      description,
      categories: Array.isArray(categories) ? categories : (categories ? String(categories).split(',').map(s=>s.trim()) : []),
      daysRemaining: daysRemaining ? Number(daysRemaining) : 0,
      image: uploadedUrl,
    };

    const created = await Challenge.create(toCreate);
    return res.status(201).json({ status: true, challenge: created });
  } catch (err) {
    console.error('createChallenge error', err);
    // Duplicate title -> 11000 code from MongoDB
    if (err && err.code === 11000) {
      return res.status(409).json({ status: false, message: 'Challenge with this title already exists' });
    }
    return res.status(500).json({ status: false, message: 'Server error' });
  }
};
