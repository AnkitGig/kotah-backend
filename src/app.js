const express = require('express');
const app = express();
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const childRoutes = require('./routes/childRoutes');
const taskRoutes = require('./routes/taskRoutes');
const rewardRoutes = require('./routes/rewardRoutes');

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/children', childRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/rewards', rewardRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;
