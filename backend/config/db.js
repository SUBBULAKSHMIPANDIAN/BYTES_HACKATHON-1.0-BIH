const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://vikymahendiran123:12345@aistudybuddy.mpbcgh4.mongodb.net/?retryWrites=true&w=majority&appName=AIstudybuddy/study-buddy');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;