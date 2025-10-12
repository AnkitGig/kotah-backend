const Task = require("../models/Task");
const Child = require("../models/Child");
const Category = require("../models/Category");
const path = require("path");

exports.createTask = async (req, res) => {
  try {
    const parentId = req.user && req.user.userId;
    if (!parentId)
      return res.status(401).json({ status: false, message: "Unauthorized" });
    const {
      childId,
      title,
      description,
      frequency,
      coinValue,
      dueTime,
      categoryId,
      timeOfDay,
      requiresParentApproval,
      allowNextDayCompletion,
      difficulty,
    } = req.body || {};
    if (!childId || !title || !categoryId)
      return res.status(400).json({
        status: false,
        message: "childId, title and categoryId required",
      });
    const child = await Child.findOne({ _id: childId, parent: parentId });
    if (!child)
      return res
        .status(404)
        .json({ status: false, message: "Child not found" });
    const category = await Category.findById(categoryId);
    if (!category)
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    const task = new Task({
      parent: parentId,
      child: childId,
      category: category._id,
      title,
      description,
      frequency,
      coinValue: coinValue || 0,
      dueTime,
      requiresParentApproval:
        typeof requiresParentApproval === "string"
          ? ["1", "true", "yes"].includes(requiresParentApproval.toLowerCase())
          : !!requiresParentApproval,
      allowNextDayCompletion:
        typeof allowNextDayCompletion === "string"
          ? ["1", "true", "yes"].includes(allowNextDayCompletion.toLowerCase())
          : !!allowNextDayCompletion,
      difficulty: difficulty || "easy",
      timeOfDay: Array.isArray(timeOfDay)
        ? timeOfDay
        : timeOfDay
        ? String(timeOfDay)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    });

    // handle optional image upload (req.file)
    if (req.file) {
      try {
        const uploaderPath = path.join(
          __dirname,
          "..",
          "utils",
          "customUploader.js"
        );
        const uploaderModule = require(uploaderPath);
        const customUploader =
          uploaderModule && uploaderModule.default
            ? uploaderModule.default
            : uploaderModule;
        const uploadedUrl = await customUploader({
          file: req.file,
          folder: "tasks",
        });
        if (uploadedUrl) task.imageUrl = uploadedUrl;
        else task.imageUrl = req.file.path.replace(/\\/g, "/");
      } catch (e) {
        console.error("task image upload error", e);
      }
    }

    await task.save();
    const saved = await Task.findById(task._id).populate("child category");
    res.status(201).json({ status: true, data: saved });
  } catch (err) {
    console.error("createTask error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// child marks task complete (sets completed true) — awaiting parent verification
exports.markCompleteByChild = async (req, res) => {
  try {
    const childAuth = req.user && req.user.role === "child";
    if (!childAuth)
      return res.status(401).json({
        status: false,
        message: "Unauthorized - child token required",
      });

    const childId = req.user.childId;
    const taskId =
      (req.body && req.body.taskId) || (req.params && req.params.taskId);

    if (!taskId)
      return res
        .status(400)
        .json({ status: false, message: "taskId is required in request body" });

    const task = await Task.findOne({ _id: taskId, child: childId });
    if (!task)
      return res.status(404).json({ status: false, message: "Task not found" });
    if (task.completed)
      return res
        .status(400)
        .json({ status: false, message: "Already completed" });

    task.completed = true;
    task.completedAt = new Date();
    await task.save();
    res.json({ status: true, data: task });
  } catch (err) {
    console.error("markCompleteByChild error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// parent verifies completion and awards coins
exports.verifyAndAward = async (req, res) => {
  try {
    const parentId = req.user && req.user.userId;
    if (!parentId)
      return res.status(401).json({ status: false, message: "Unauthorized" });

    const taskId =
      (req.body && req.body.taskId) || (req.params && req.params.taskId);

    if (!taskId)
      return res
        .status(400)
        .json({ status: false, message: "taskId is required in request body" });

    const task = await Task.findOne({ _id: taskId, parent: parentId }).populate(
      "child category"
    );
    if (!task)
      return res.status(404).json({ status: false, message: "Task not found" });
    if (!task.completed)
      return res
        .status(400)
        .json({ status: false, message: "Task not marked completed by child" });
    if (task.verified)
      return res
        .status(400)
        .json({ status: false, message: "Already verified" });
    task.verified = true;
    await task.save();
    const child = await Child.findById(task.child._id);
    child.coins = (child.coins || 0) + (task.coinValue || 0);
    await child.save();

    res.json({ status: true, task, child });
  } catch (err) {
    console.error("verifyAndAward error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.listTasksForParent = async (req, res) => {
  try {
    const parentId = req.user && req.user.userId;
    if (!parentId)
      return res.status(401).json({ status: false, message: "Unauthorized" });
    const tasks = await Task.find({ parent: parentId }).populate(
      "child category"
    );
    res.json({ status: true, data: tasks });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.listTasksForChild = async (req, res) => {
  try {
    const childAuth = req.user && req.user.role === "child";
    if (!childAuth)
      return res.status(401).json({
        status: false,
        message: "Unauthorized - child token required",
      });
    const childId = req.user.childId;
    const tasks = await Task.find({ child: childId }).populate("category");
    res.json({ status: true, data: tasks });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};
