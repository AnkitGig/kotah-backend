const Reward = require("../models/Reward");
const Child = require("../models/Child");

exports.listRewards = async (req, res) => {
  try {
    const user = req.user;
    if (!user)
      return res.status(401).json({ status: false, message: "Unauthorized" });
    if (user.role === "child") {
      const childId = user.childId;
      if (!childId)
        return res
          .status(400)
          .json({ status: false, message: "Child id missing in token" });
      const rewards = await Reward.find({
        active: true,
        $or: [
          { targetChildren: { $exists: false } },
          { targetChildren: { $size: 0 } },
          { targetChildren: childId },
        ],
      });
      return res.json({ status: true, data: rewards });
    }

    const parentId = user.userId;
    if (!parentId)
      return res.status(401).json({ status: false, message: "Unauthorized" });

    const filterChildId = req.query && req.query.childId;
    if (filterChildId) {
      const child = await Child.findOne({
        _id: filterChildId,
        parent: parentId,
      });
      if (!child)
        return res.status(404).json({
          status: false,
          message: "Child not found or not owned by you",
        });
      const rewards = await Reward.find({
        active: true,
        $or: [
          { targetChildren: { $exists: false } },
          { targetChildren: { $size: 0 } },
          { targetChildren: child._id },
        ],
      });
      return res.json({ status: true, data: rewards });
    }

    // find all children of this parent
    const children = await Child.find({ parent: parentId }).select("_id");
    const childIds = children.map((c) => c._id);

    const orClauses = [
      { targetChildren: { $exists: false } },
      { targetChildren: { $size: 0 } },
    ];
    if (childIds.length) orClauses.push({ targetChildren: { $in: childIds } });

    const rewards = await Reward.find({ active: true, $or: orClauses });
    res.json({ status: true, data: rewards });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.createReward = async (req, res) => {
  try {
    const { title, description, cost, type, metadata, targetChildren } =
      req.body || {};
    if (!title || !cost)
      return res
        .status(400)
        .json({ status: false, message: "title and cost required" });
    const rewardData = { title, description, cost, type, metadata };
    try {
      if (req.file && req.file.path) {
        const uploaderModule = await import("../utils/customUploader.js");
        const customUploader =
          uploaderModule && (uploaderModule.default || uploaderModule);
        if (typeof customUploader === "function") {
          const uploadedUrl = await customUploader({
            file: req.file,
            folder: "rewards",
          });
          if (uploadedUrl) rewardData.imageUrl = uploadedUrl;
        }
      }
    } catch (e) {
      console.error("createReward image upload error", e);
    }
    if (targetChildren) {
      let ids = [];
      try {
        const parsed = Array.isArray(targetChildren)
          ? targetChildren
          : JSON.parse(targetChildren);
        for (const v of parsed) {
          if (!v) continue;
          if (/^\d{6}$/.test(String(v))) {
            const c = await Child.findOne({ code: String(v) });
            if (c) ids.push(c._id);
          } else {
            ids.push(v);
          }
        }
      } catch (e) {
        if (typeof targetChildren === "string") {
          const parts = targetChildren
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
          for (const p of parts) {
            if (/^\d{6}$/.test(p)) {
              const c = await Child.findOne({ code: String(p) });
              if (c) ids.push(c._id);
            } else {
              ids.push(p);
            }
          }
        }
      }
      if (ids.length) rewardData.targetChildren = ids;
    }
    const reward = new Reward(rewardData);
    await reward.save();
    res.status(201).json({ status: true, data: reward });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// child claims reward: deduct coins and return reward metadata
exports.claimReward = async (req, res) => {
  try {
    const childAuth = req.user && req.user.role === "child";
    if (!childAuth)
      return res.status(401).json({
        status: false,
        message: "Unauthorized - child token required",
      });
    const childId = req.user.childId;
    const { rewardId } = req.body && req.body.rewardId ? req.body : req.params;
    if (!rewardId)
      return res.status(400).json({
        status: false,
        message: "rewardId is required in request body",
      });
    const reward = await Reward.findById(rewardId);
    if (!reward || !reward.active)
      return res
        .status(404)
        .json({ status: false, message: "Reward not found" });
    const targets = reward.targetChildren || [];
    if (Array.isArray(targets) && targets.length > 0) {
      // compare ids as strings
      const allowed = targets.map((t) => String(t));
      if (!allowed.includes(String(childId))) {
        return res.status(403).json({
          status: false,
          message: "Reward not available for this child",
        });
      }
    }
    const child = await Child.findById(childId);
    if (!child)
      return res
        .status(404)
        .json({ status: false, message: "Child not found" });
    if ((child.coins || 0) < reward.cost)
      return res
        .status(400)
        .json({ status: false, message: "Not enough coins" });
    child.coins -= reward.cost;
    await child.save();
    res.json({ status: true, message: "Reward claimed", reward, child });
  } catch (err) {
    console.error("claimReward error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
