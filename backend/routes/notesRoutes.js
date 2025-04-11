const express = require('express');
const router = express.Router();
const noteController = require('../controllers/notesController');

router.post('/', noteController.createNote);
router.get('/:username', noteController.getNotes);
router.put('/:id', noteController.updateNote);
router.delete('/:id', noteController.deleteNote);

module.exports = router;