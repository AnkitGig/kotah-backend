require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/chat/socket');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

async function start() {
	try {
		await connectDB();
		const server = http.createServer(app);
		initSocket(server);
		server.listen(PORT, () => {
			console.log(`Server + WebSocket running on port ${PORT}`);
		});
	} catch (err) {
		console.error('Failed to start server due to DB error:', err);
		process.exit(1);
	}
}

start();
