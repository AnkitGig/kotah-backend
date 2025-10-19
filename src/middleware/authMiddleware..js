const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res.status(401).json({ message: 'No token, authorization denied' });
	}
	const token = authHeader.split(' ')[1];
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		if (decoded && decoded.parentId && !decoded.userId) {
			decoded.userId = decoded.parentId;
		}
		if (decoded && decoded.role === 'family') {
			if (!decoded.userId && decoded.parentId) decoded.userId = decoded.parentId;
		}
		req.user = decoded;
		next();
	} catch (err) {
		res.status(401).json({ message: 'Token is not valid' });
	}
};
