const express = require('express');
const router = express.Router();
const { saveEducation } = require('../controllers/educationController');

router.post('/', saveEducation);

module.exports = router;