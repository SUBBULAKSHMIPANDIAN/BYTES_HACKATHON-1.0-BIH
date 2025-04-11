const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    ref: 'User'
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries by username
noteSchema.index({ username: 1 });

module.exports = mongoose.model('Note', noteSchema);