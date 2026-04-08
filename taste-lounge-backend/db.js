// config/db.js — MongoDB connection via Mongoose
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // These options silence deprecation warnings
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS:          45000,
    });

    console.log(`\n✅  MongoDB connected → ${conn.connection.host}`);
    console.log(`    Database: ${conn.connection.name}\n`);

  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    console.error('    Check your MONGODB_URI in the .env file.\n');
    process.exit(1);   // crash fast — app is useless without DB
  }
};

// Re-emit Mongoose events so we can see drops & reconnects in the log
mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => console.log('♻️  MongoDB reconnected'));

module.exports = connectDB;
