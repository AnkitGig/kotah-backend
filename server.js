require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');
const http = require('http');
const { initSocket } = require('./src/chat/socket');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kotah';

mongoose.connect(MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
})
	.then(() => {
		console.log('MongoDB connected');
		const server = http.createServer(app);
		// initialize socket.io
		initSocket(server);
		server.listen(PORT, () => {
			console.log(`Server + WebSocket running on port ${PORT}`);
		});
	})
	.catch((err) => {
		console.error('MongoDB connection error:', err);
	});
