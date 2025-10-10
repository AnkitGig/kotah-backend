const Child = require('../models/Child');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

function generate6Digit() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.createChild = async (req, res) => {
  try {
    const parentId = req.user && req.user.userId;
    if (!parentId) return res.status(401).json({ message: 'Unauthorized' });

    const { name, age } = req.body || {};
    if (!name) return res.status(400).json({ message: 'Child name required' });

    // ensure unique 6-digit code
    let code;
    for (let i = 0; i < 5; i++) {
      code = generate6Digit();
      const exists = await Child.findOne({ code });
      if (!exists) break;
      code = null;
    }
    if (!code) return res.status(500).json({ message: 'Could not generate code' });

    const child = new Child({ parent: parentId, name, age, code });
    await child.save();
    res.status(201).json(child);
  } catch (err) {
    console.error('createChild error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.childLogin = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ message: 'Code required' });
    const child = await Child.findOne({ code }).populate('parent', 'firstName lastName email');
    if (!child) return res.status(404).json({ message: 'Child not found' });

    // sign a JWT token for child with limited scope
    const token = jwt.sign({ childId: child._id, parentId: child.parent._id, role: 'child' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
    res.json({ token, child: { id: child._id, name: child.name, age: child.age, coins: child.coins, parent: child.parent } });
  } catch (err) {
    console.error('childLogin error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.listChildren = async (req, res) => {
  try {
    const parentId = req.user && req.user.userId;
    if (!parentId) return res.status(401).json({ message: 'Unauthorized' });
    const children = await Child.find({ parent: parentId }).select('-__v');
    res.json(children);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
