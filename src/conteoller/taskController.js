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

    try {
      if (req.user && req.user.role === "family") {
        const assignerChild = await Child.findById(req.user.childId);
        if (assignerChild) {
          task.assignedBy = {
            id: String(assignerChild._id),
            role: "family",
            name: assignerChild.name,
          };
        }
      } else if (req.user && req.user.userId) {
        // assigner is parent user
        const User = require("../models/User");
        const assignerUser = await User.findById(req.user.userId).select(
          "firstName lastName"
        );
        if (assignerUser) {
          task.assignedBy = {
            id: String(assignerUser._id),
            role: "user",
            name: `${assignerUser.firstName || ""} ${
              assignerUser.lastName || ""
            }`.trim(),
          };
        }
      }
    } catch (e) {
      console.error("assignedBy population error", e);
    }
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
    const saved = await Task.findById(task._id)
      .populate("child category")
      .populate({ path: "parent", select: "firstName lastName email" });
    res.status(201).json({ status: true, data: saved });
  } catch (err) {
    console.error("createTask error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

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
    const populated = await Task.findById(task._id)
      .populate("child category")
      .populate({ path: "parent", select: "firstName lastName email" });
    res.json({ status: true, data: populated });
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

    let task = await Task.findOne({ _id: taskId, parent: parentId })
      .populate("child category")
      .populate({ path: "parent", select: "firstName lastName email" });
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
    const populatedTask = await Task.findById(task._id)
      .populate("child category")
      .populate({ path: "parent", select: "firstName lastName email" });
    const child = await Child.findById(task.child._id);
    child.coins = (child.coins || 0) + (task.coinValue || 0);
    await child.save();

    res.json({ status: true, task: populatedTask, child });
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
    const tasks = await Task.find({ parent: parentId })
      .populate("child category")
      .populate({ path: "parent", select: "firstName lastName email" });
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
    const tasks = await Task.find({ child: childId })
      .populate("category")
      .populate({ path: "parent", select: "firstName lastName email" });
    res.json({ status: true, data: tasks });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// dashboard counts for parent or child
exports.dashboard = async (req, res) => {
  try {
    // If child token
    if (req.user && req.user.role === "child") {
      const childId = req.user.childId;
      if (!childId)
        return res
          .status(401)
          .json({
            status: false,
            message: "Unauthorized - child token required",
          });

      const todoCount = await Task.countDocuments({
        child: childId,
        completed: false,
      });
      const inProgressCount = await Task.countDocuments({
        child: childId,
        completed: true,
        verified: false,
      });
      // Completed: verified by parent
      const completedCount = await Task.countDocuments({
        child: childId,
        verified: true,
      });

      return res.json({
        status: true,
        data: {
          todo: todoCount,
          inProgress: inProgressCount,
          completed: completedCount,
        },
      });
    }

    // Parent token
    const parentId = req.user && req.user.userId;
    if (!parentId)
      return res.status(401).json({ status: false, message: "Unauthorized" });

    const todoCount = await Task.countDocuments({
      parent: parentId,
      completed: false,
    });
    const inProgressCount = await Task.countDocuments({
      parent: parentId,
      completed: true,
      verified: false,
    });
    const completedCount = await Task.countDocuments({
      parent: parentId,
      verified: true,
    });

    res.json({
      status: true,
      data: {
        todo: todoCount,
        inProgress: inProgressCount,
        completed: completedCount,
      },
    });
  } catch (err) {
    console.error("dashboard error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
