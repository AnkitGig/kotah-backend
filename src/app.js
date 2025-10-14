const express = require("express");
const path = require("path");
const app = express();
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const childRoutes = require("./routes/childRoutes");
const taskRoutes = require("./routes/taskRoutes");
const rewardRoutes = require("./routes/rewardRoutes");
const categoryRoutes = require("./routes/categoryRoutes");

app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/children", childRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/categories", categoryRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "about.html"));
});
app.get("/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "terms.html"));
});

module.exports = app;
