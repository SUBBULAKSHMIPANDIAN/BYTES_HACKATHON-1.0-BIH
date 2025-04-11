const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true },
  password: { type: String, required: true },
  surveyCompleted: {
    type: Boolean,
    default: false
  },
  surveySkipped: {
    type: Boolean,
    default: false
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);