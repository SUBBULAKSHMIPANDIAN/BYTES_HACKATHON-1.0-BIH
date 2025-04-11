const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    ref: 'User'
  },
  studyHours: {
    type: Number,
    required: true,
    min: 0,
    max: 24
  },
  preferredTime: {
    type: String,
    required: true,
    enum: ['Morning', 'Afternoon', 'Evening', 'Night']
  },
  subjects: {
    type: [String],
    default: []
  },
  stressLevel: {
    type: String,
    required: true,
    enum: ['Low', 'Moderate', 'High']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add index for faster queries by username
surveySchema.index({ username: 1 });

module.exports = mongoose.model('Survey', surveySchema);