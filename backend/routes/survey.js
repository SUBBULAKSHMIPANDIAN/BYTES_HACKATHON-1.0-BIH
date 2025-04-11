const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const authMiddleware = require('../middlewares/auth');

// Submit survey (protected route)
router.post('/', authMiddleware, surveyController.submitSurvey);

// Get user's survey (protected route)
router.get('/:username', authMiddleware, surveyController.getUserSurvey);

// Skip survey (protected route)
router.post('/skip', authMiddleware, surveyController.skipSurvey);

module.exports = router;