const express = require('express');
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
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));