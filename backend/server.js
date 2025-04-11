require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Models
const Chat = require('./models/chatModel');

// Routes
const authRoutes = require('./routes/authRoutes');
const educationRoutes = require('./routes/educationRoutes');
const notesRoutes = require('./routes/notesRoutes');
const surveyRoutes = require('./routes/survey');

// Init app
const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const connectDB = require('./config/db');
connectDB();

// JWT Auth Middleware (improved)
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Unauthorized - No token provided' });

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Forbidden - Invalid token' });
    
    req.user = decoded;
    next();
  });
};

// File upload setup (improved)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
});

// Route logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Chat Routes (improved error handling)
app.get('/api/chats', authenticate, async (req, res) => {
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
});

app.get('/api/chats/:sessionId', authenticate, async (req, res) => {
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
});

app.post('/api/chats', authenticate, async (req, res) => {
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
});

app.post('/api/chats/:sessionId/messages', authenticate, async (req, res) => {
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

    if (sender === 'user') {
      try {
        // Forward to Flask with proper error handling
        const flaskResponse = await axios.post('http://localhost:8000/api/chat', {
          query: content,
          file: metadata?.fileUrl
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${req.headers['authorization']?.split(' ')[1]}`
          },
          timeout: 10000 // 10 second timeout
        });

        const botMessage = {
          content: flaskResponse.data?.response || "I didn't get a response",
          sender: 'bot',
          timestamp: new Date()
        };

        await Chat.findOneAndUpdate(
          { sessionId, userId: req.user.id },
          { $push: { messages: botMessage } }
        );

        return res.json({
          userMessage: updatedChat.messages[updatedChat.messages.length - 1],
          botMessage
        });
      } catch (flaskError) {
        console.error('Flask communication error:', flaskError);
        
        const errorMessage = {
          content: "I'm having trouble connecting to the AI service. Please try again later.",
          sender: 'bot',
          timestamp: new Date()
        };

        await Chat.findOneAndUpdate(
          { sessionId, userId: req.user.id },
          { $push: { messages: errorMessage } }
        );

        return res.status(502).json({
          error: 'Failed to get AI response',
          botMessage: errorMessage
        });
      }
    }

    res.json(updatedChat);
  } catch (err) {
    console.error('Error adding message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload', authenticate, upload.single('file'), async (req, res) => {
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
});

app.delete('/api/chats/:sessionId', authenticate, async (req, res) => {
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
        const filePath = path.join(__dirname, message.metadata.fileUrl);
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
});

// Modular Routes (keep both as requested)
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); 
app.use('/api/education', educationRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/survey', surveyRoutes);

// Improved error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      error: 'File upload error',
      message: err.message 
    });
  }
  
  res.status(500).json({ 
    message: 'Something broke!', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
  });
});

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});


/* const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const educationRoutes = require('./routes/educationRoutes');
const notesRoutes = require('./routes/notesRoutes');
const surveyRoutes = require('./routes/survey');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); 
app.use('/api/education', educationRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/survey', surveyRoutes);
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)); */