const Note = require('../models/Note');

exports.createNote = async (req, res) => {
  try {
    const { username, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ 
        success: false,
        message: 'Note content cannot be empty'
      });
    }

    const note = new Note({
      username,
      content: content.trim()
    });

    await note.save();

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      note
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create note',
      error: error.message
    });
  }
};

exports.getNotes = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    const notes = await Note.find({ username })
      .sort({ createdAt: -1 }) // Newest first
      .lean();

    res.status(200).json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notes',
      error: error.message
    });
  }
};