const express = require('express');
const router = express.Router();
const notesController = require('../controllers/notesController');
const authMiddleware = require('../middlewares/auth');

// Protected routes
router.post('/', authMiddleware, notesController.createNote);
router.get('/:username', authMiddleware, notesController.getNotes);

module.exports = router;