const Survey = require('../models/Survey');
const User = require('../models/User');

exports.submitSurvey = async (req, res) => {
  try {
    const { username, studyHours, preferredTime, subjects, stressLevel } = req.body;

    // Check if user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Convert subjects string to array if needed
    const subjectsArray = typeof subjects === 'string' ? 
      subjects.split(',').map(s => s.trim()) : 
      subjects;

    // Create new survey
    const survey = new Survey({
      username,
      studyHours,
      preferredTime,
      subjects: subjectsArray,
      stressLevel
    });

    await survey.save();

    // Update user's survey completion status
    user.surveyCompleted = true;
    await user.save();

    res.status(201).json({ 
      success: true, 
      message: 'Survey submitted successfully',
      survey
    });
  } catch (error) {
    console.error('Error submitting survey:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit survey',
      error: error.message 
    });
  }
};

exports.getUserSurvey = async (req, res) => {
  try {
    const { username } = req.params;

    const survey = await Survey.findOne({ username })
      .sort({ createdAt: -1 }) // Get the most recent survey
      .lean();

    if (!survey) {
      return res.status(404).json({ 
        success: false, 
        message: 'No survey found for this user' 
      });
    }

    res.status(200).json({ 
      success: true, 
      survey 
    });
  } catch (error) {
    console.error('Error fetching survey:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch survey',
      error: error.message 
    });
  }
};

exports.skipSurvey = async (req, res) => {
  try {
    const { username } = req.body;

    // Check if user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Mark survey as skipped
    user.surveyCompleted = true;
    user.surveySkipped = true;
    await user.save();

    res.status(200).json({ 
      success: true, 
      message: 'Survey skipped successfully' 
    });
  } catch (error) {
    console.error('Error skipping survey:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to skip survey',
      error: error.message 
    });
  }
};