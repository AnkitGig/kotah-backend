const Task = require("../models/Task");
const Child = require("../models/Child");

exports.createTask = async (req, res) => {
  try {
    const parentId = req.user && req.user.userId;
    if (!parentId) return res.status(401).json({ message: "Unauthorized" });
    const { childId, title, description, frequency, coinValue, dueTime } =
      req.body || {};
    if (!childId || !title)
      return res.status(400).json({ message: "childId and title required" });
    const child = await Child.findOne({ _id: childId, parent: parentId });
    if (!child) return res.status(404).json({ message: "Child not found" });

    const task = new Task({
      parent: parentId,
      child: childId,
      title,
      description,
      frequency,
      coinValue: coinValue || 0,
      dueTime,
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    console.error("createTask error", err);
    res.status(500).json({ message: "Server error" });
  }
};

// child marks task complete (sets completed true) — awaiting parent verification
exports.markCompleteByChild = async (req, res) => {
  try {
    const childAuth = req.user && req.user.role === "child";
    if (!childAuth)
      return res
        .status(401)
        .json({ message: "Unauthorized - child token required" });
    const childId = req.user.childId;
    const { taskId } = req.params;
    const task = await Task.findOne({ _id: taskId, child: childId });
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (task.completed)
      return res.status(400).json({ message: "Already completed" });
    task.completed = true;
    task.completedAt = new Date();
    await task.save();
    res.json(task);
  } catch (err) {
    console.error("markCompleteByChild error", err);
    res.status(500).json({ message: "Server error" });
  }
};

// parent verifies completion and awards coins
exports.verifyAndAward = async (req, res) => {
  try {
    const parentId = req.user && req.user.userId;
    if (!parentId) return res.status(401).json({ message: "Unauthorized" });
    const { taskId } = req.params;
    const task = await Task.findOne({ _id: taskId, parent: parentId }).populate(
      "child"
    );
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!task.completed)
      return res
        .status(400)
        .json({ message: "Task not marked completed by child" });
    if (task.verified)
      return res.status(400).json({ message: "Already verified" });
    task.verified = true;
    await task.save();

    // award coins to child
    const child = await Child.findById(task.child._id);
    child.coins = (child.coins || 0) + (task.coinValue || 0);
    await child.save();

    res.json({ task, child });
  } catch (err) {
    console.error("verifyAndAward error", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.listTasksForParent = async (req, res) => {
  try {
    const parentId = req.user && req.user.userId;
    if (!parentId) return res.status(401).json({ message: "Unauthorized" });
    const tasks = await Task.find({ parent: parentId }).populate("child");
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.listTasksForChild = async (req, res) => {
  try {
    const childAuth = req.user && req.user.role === "child";
    if (!childAuth)
      return res
        .status(401)
        .json({ message: "Unauthorized - child token required" });
    const childId = req.user.childId;
    const tasks = await Task.find({ child: childId });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
