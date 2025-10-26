const Reward = require("../models/Reward");
const Child = require("../models/Child");
const RewardClaim = require("../models/RewardClaim");

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
      return res.status(400).json({ status: false, message: "rewardId is required" });

    const reward = await Reward.findById(rewardId);
    if (!reward || !reward.active)
      return res.status(404).json({ status: false, message: "Reward not found" });

    const targets = reward.targetChildren || [];
    if (Array.isArray(targets) && targets.length > 0) {
      const allowed = targets.map((t) => String(t));
      if (!allowed.includes(String(childId))) {
        return res.status(403).json({ status: false, message: "Reward not available for this child" });
      }
    }

    const child = await Child.findById(childId);
    if (!child) return res.status(404).json({ status: false, message: "Child not found" });

    // Prevent claim if child doesn't have enough coins at claim time
    if ((child.coins || 0) < reward.cost) {
      return res.status(400).json({ status: false, message: "Not enough coins to claim reward" });
    }

    // Create a pending claim. Parent will approve later which will deduct coins.
    const claim = new RewardClaim({ reward: reward._id, child: child._id, status: "pending" });
    await claim.save();
    res.status(201).json({ status: true, message: "Reward claim created (pending approval)", data: claim });
  } catch (err) {
    console.error("claimReward error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.approveClaim = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role === "child")
      return res.status(401).json({ status: false, message: "Unauthorized - parent token required" });

    const parentId = user.userId;
    const { claimId } = req.body && req.body.claimId ? req.body : req.params;
    if (!claimId) return res.status(400).json({ status: false, message: "claimId is required" });

    const claim = await RewardClaim.findById(claimId).populate("reward child");
    if (!claim) return res.status(404).json({ status: false, message: "Claim not found" });
    if (claim.status !== "pending") return res.status(400).json({ status: false, message: "Claim is not pending" });

    const child = await Child.findById(claim.child._id || claim.child);
    if (!child) return res.status(404).json({ status: false, message: "Child not found" });
    // verify parent owns the child
    if (String(child.parent) !== String(parentId)) {
      return res.status(403).json({ status: false, message: "You do not own this child" });
    }

    const reward = await Reward.findById(claim.reward._id || claim.reward);
    if (!reward) return res.status(404).json({ status: false, message: "Reward not found" });

    if ((child.coins || 0) < reward.cost) {
      claim.status = "rejected";
      await claim.save();
      return res.status(400).json({ status: false, message: "Child does not have enough coins; claim rejected" });
    }

    // Deduct coins and approve
    child.coins -= reward.cost;
    await child.save();

    claim.status = "approved";
    claim.approver = parentId;
    claim.approvedAt = new Date();
    await claim.save();

    res.json({ status: true, message: "Claim approved", data: { claim, child } });
  } catch (err) {
    console.error("approveClaim error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.listClaims = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ status: false, message: "Unauthorized" });

    const statusFilter = req.query && req.query.status;

    if (user.role === "child") {
      const childId = user.childId;
      if (!childId) return res.status(400).json({ status: false, message: "Child id missing in token" });
      const q = { child: childId };
      if (statusFilter) q.status = statusFilter;
      const claims = await RewardClaim.find(q).populate("reward approver");
      return res.json({ status: true, data: claims });
    }

    // parent
    const parentId = user.userId;
    if (!parentId) return res.status(401).json({ status: false, message: "Unauthorized" });

    // find children
    const children = await Child.find({ parent: parentId }).select("_id");
    const childIds = children.map((c) => c._id);
    const q = { child: { $in: childIds } };
    if (statusFilter) q.status = statusFilter;
    const claims = await RewardClaim.find(q).populate("reward child approver");
    res.json({ status: true, data: claims });
  } catch (err) {
    console.error("listClaims error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
