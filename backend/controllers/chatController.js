const Chat = require('../models/chatModel');
const fs = require('fs');
const path = require('path');

// Get all chat sessions for a user
exports.getChatSessions = async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .select('-messages')
      .lean();
    res.json(chats);
  } catch (err) {
    console.error('Error fetching chats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a specific chat session
exports.getChatSession = async (req, res) => {
  try {
    const chat = await Chat.findOne({ 
      userId: req.user.id, 
      sessionId: req.params.sessionId 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json(chat);
  } catch (err) {
    console.error('Error fetching chat:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new chat session
exports.createChatSession = async (req, res) => {
  try {
    const newChat = new Chat({
      userId: req.user.id,
      username: req.user.username,
      messages: [],
      sessionId: Date.now().toString(),
      title: 'New Chat'
    });
    
    await newChat.save();
    res.status(201).json(newChat);
  } catch (err) {
    console.error('Error creating chat:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add a message to a chat session
exports.addMessage = async (req, res) => {
  try {
    const { content, sender, metadata } = req.body;
    const sessionId = req.params.sessionId;
    
    if (!content && !metadata?.fileUrl) {
      return res.status(400).json({ error: 'Message content or file is required' });
    }

    const chat = await Chat.findOne({ sessionId, userId: req.user.id });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const update = {
      $push: { messages: { content, sender, metadata: metadata || {} } },
      $set: { updatedAt: Date.now() }
    };

    if (sender === 'user' && chat.messages.length === 0) {
      update.$set.title = content.substring(0, 50) || 'New Chat';
    }

    const updatedChat = await Chat.findOneAndUpdate(
      { sessionId, userId: req.user.id },
      update,
      { new: true }
    );

    res.json(updatedChat);
  } catch (err) {
    console.error('Error adding message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a chat session
exports.deleteChatSession = async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({ 
      userId: req.user.id, 
      sessionId: req.params.sessionId 
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Clean up files
    chat.messages.forEach(message => {
      if (message.metadata?.fileUrl) {
        const filePath = path.join(__dirname, '..', message.metadata.fileUrl);
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, err => {
            if (err) console.error('Error deleting file:', err);
          });
        }
      }
    });

    res.json({ message: 'Chat deleted successfully' });
  } catch (err) {
    console.error('Error deleting chat:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Handle file upload
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      fileUrl, 
      fileType: req.file.mimetype, 
      originalName: req.file.originalname 
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ 
      error: err.message || 'File upload failed' 
    });
  }
};

// Transcribe audio
// Transcribe audio by forwarding to Flask
exports.transcribeAudio = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }
  
      // Forward the audio file to Flask
      const formData = new FormData();
      formData.append('audio', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
  
      const flaskResponse = await axios.post(`${process.env.FLASK_BASE_URL || 'http://localhost:8000'}/api/chat`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': req.headers['authorization']
        }
      });
  
      res.json({
        transcribed: flaskResponse.data.transcribed || "Could not transcribe audio"
      });
    } catch (err) {
      console.error('Audio transcription error:', err);
      res.status(500).json({ 
        error: err.message || 'Failed to process audio' 
      });
    }
  };

  exports.getChatSessions = async (req, res) => {
    try {
      const chats = await Chat.find({ userId: req.user.id })
        .sort({ updatedAt: -1 })
        .select('-messages')
        .lean();
        
      // Return empty array if no chats (not an error)
      res.json(chats || []);
    } catch (err) {
      console.error('Error fetching chats:', err);
      res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
      });
    }
  };