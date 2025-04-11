const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

module.exports = async (req, res, next) => {
  try {
    // Check for token in both header and cookies (more flexible)
    let token = req.header('Authorization')?.replace('Bearer ', '') || 
                req.cookies?.token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required: No token provided' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user and attach to request
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    let message = 'Not authorized';
    if (error.name === 'TokenExpiredError') {
      message = 'Session expired. Please login again';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid token';
    }
    
    res.status(401).json({ 
      success: false,
      message 
    });
  }
};