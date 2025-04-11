const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticate = require('../middleware/authMiddleware');
const multer = require('multer');

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'audio/mpeg', 'audio/wav'];
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
const authenticate = require('../backend/middlewares/authMiddleware');

router.get('/au', authenticate, chatController.getChatSessions);
router.get('/:sessionId', authenticate, chatController.getChatSession);
router.post('/', authenticate, chatController.createChatSession);
router.post('/:sessionId/messages', authenticate, chatController.addMessage);
router.delete('/:sessionId', authenticate, chatController.deleteChatSession);

// File handling routes
router.post('/upload', authenticate, upload.single('file'), chatController.uploadFile);
router.post('/chat/transcribe', authenticate, upload.single('audio'), chatController.transcribeAudio);

module.exports = router;