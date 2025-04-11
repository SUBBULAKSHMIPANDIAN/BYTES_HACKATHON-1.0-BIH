const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  username: { type: String, required: true },
  educationLevel: { type: String, default: '' },
  classOrYear: { type: String, default: '' },
  institution: { type: String, default: '' },
  course: { type: String, default: '' },
  semester: { type: String, default: '' },
  skipped: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Education', educationSchema);