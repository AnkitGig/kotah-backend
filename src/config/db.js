const mongoose = require('mongoose');

const DEFAULT_URI = 'mongodb://localhost:27017/kotah';

/**
 * Return a validated MongoDB URI. If the environment value doesn't look
 * like a MongoDB connection string, warn and fall back to the default.
 */
function getMongoUri() {
  const raw = process.env.MONGO_URI;
  if (!raw) return DEFAULT_URI;
  const uri = String(raw).trim();
  // Basic validation: must start with mongodb:// or mongodb+srv://
  if (/^mongodb(\+srv)?:\/\//i.test(uri)) return uri;
  console.warn('Warning: MONGO_URI does not look like a MongoDB URI. Falling back to default. Received:', uri);
  return DEFAULT_URI;
}

const connectDB = async () => {
  const uri = getMongoUri();
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // rethrow so caller (server startup) can decide how to handle it
    throw err;
  }
};

module.exports = connectDB;
