const Note = require('../models/Note');

exports.createNote = async (req, res) => {
  try {
    const { username, title, content } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false,
        message: 'Note title cannot be empty'
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ 
        success: false,
        message: 'Note content cannot be empty'
      });
    }

    const note = new Note({
      username,
      title: title.trim(),
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

exports.updateNote = async (req, res) => {
  try {
    const { title, content } = req.body;
    const { id } = req.params;

    if (!title || !title.trim() || !content || !content.trim()) {
      return res.status(400).json({ 
        success: false,
        message: 'Title and content cannot be empty'
      });
    }

    const note = await Note.findByIdAndUpdate(
      id,
      { title: title.trim(), content: content.trim() },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      note
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update note',
      error: error.message
    });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    const note = await Note.findByIdAndDelete(id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete note',
      error: error.message
    });
  }
};