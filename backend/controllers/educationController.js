const Education = require('../models/Education');

exports.saveEducation = async (req, res) => {
  const { username, educationLevel, classOrYear, institution, course, semester, skipped } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    const educationData = new Education({
      username,
      educationLevel,
      classOrYear,
      institution,
      course,
      semester,
      skipped: skipped || false
    });

    await educationData.save();
    res.status(200).json({ message: skipped ? 'Education skipped' : 'Education details saved successfully' });
  } catch (err) {
    console.error('Error saving education:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};