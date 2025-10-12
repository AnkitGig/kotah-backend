const Child = require("../models/Child");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Generates a 6-character code. type can be: 'numeric' | 'alpha' | 'alnum' (default)
function generate6Digit(type = "alnum") {
  const length = 6;
  const numbers = "0123456789";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let chars = "";
  if (type === "numeric") chars = numbers;
  else if (type === "alpha") chars = letters;
  else chars = numbers + letters;

  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (type === "alnum") {
      const hasDigit = /[0-9]/.test(result);
      const hasLetter = /[A-Z]/.test(result);
      if (hasDigit && hasLetter) return result;
    } else {
      return result;
    }
  }

  let fallback = "";
  for (let i = 0; i < length; i++)
    fallback += numbers.charAt(Math.floor(Math.random() * numbers.length));
  return fallback;
}

exports.createChild = async (req, res) => {
  try {
  const parentId = req.user && req.user.userId;
  if (!parentId) return res.status(401).json({ status: false, message: "Unauthorized" });

    const { name, age } = req.body || {};
  if (!name) return res.status(400).json({ status: false, message: "Child name required" });
    const codeType = (req.body && req.body.codeType) || "alnum";
    const allowed = ["numeric", "alpha", "alnum"];
    const normalizedType = allowed.includes(codeType) ? codeType : "alnum";
    let code;
    for (let i = 0; i < 10; i++) {
      // try up to 10 times
      code = generate6Digit(normalizedType);
      const exists = await Child.findOne({ code });
      if (!exists) break;
      code = null;
    }
    if (!code)
      return res.status(500).json({ status: false, message: "Could not generate code" });

    let avatarUrl = null;
    if (req.file) {
      try {
        const uploaderModule = await import("../utils/customUploader.js");
        const customUploader = uploaderModule.default || uploaderModule;
        avatarUrl = await customUploader({
          file: req.file,
          folder: "children",
        });
      } catch (e) {
        console.error("avatar upload error", e);
      }
    }

    const child = new Child({ parent: parentId, name, age, code, avatarUrl });
    await child.save();
    res.status(201).json({ status: true, data: child });
  } catch (err) {
    console.error("createChild error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.childLogin = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ status: false, message: "Code required" });
    const child = await Child.findOne({ code }).populate(
      "parent",
      "firstName lastName email"
    );
    if (!child) return res.status(404).json({ status: false, message: "Child not found" });

    const token = jwt.sign(
      { childId: child._id, parentId: child.parent._id, role: "child" },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );
    res.json({ status: true, token, child: { id: child._id, name: child.name, age: child.age, coins: child.coins, parent: child.parent } });
  } catch (err) {
    console.error("childLogin error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.listChildren = async (req, res) => {
  try {
    const parentId = req.user && req.user.userId;
    if (!parentId) return res.status(401).json({ status: false, message: "Unauthorized" });
    const children = await Child.find({ parent: parentId }).select("-__v");
    res.json({ status: true, data: children });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};
