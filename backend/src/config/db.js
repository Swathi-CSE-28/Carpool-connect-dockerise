const mongoose = require('mongoose');
const dns = require('dns');

// On Windows, local ISP DNS often fails SRV lookups for mongodb+srv:// with ECONNREFUSED
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

// Connects to MongoDB using MONGO_URI from the environment.
// Kept as its own module so server.js and utils/seed.js can both reuse it.
const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/carpool_connect';
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log(`[db] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
