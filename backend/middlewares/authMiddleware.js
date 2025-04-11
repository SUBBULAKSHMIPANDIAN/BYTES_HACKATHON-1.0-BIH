// authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Add debug logging
    console.log('Received token:', token);
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Exists' : 'Missing');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT Verification Failed:', err.message); // Critical debug info
    return res.status(403).json({ 
      error: 'Invalid token',
      details: err.message // Include specific error
    });
  }
};