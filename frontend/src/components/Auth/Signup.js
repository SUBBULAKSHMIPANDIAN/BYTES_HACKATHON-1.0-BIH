import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import '../../styles/auth.css';

const Signup = ({ setIsAuthenticated }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  });
  const [passwordStrength, setPasswordStrength] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const evaluatePasswordStrength = (pwd) => {
    if (pwd.length < 8) return 'Weak';
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) return 'Strong';
    if ((/[A-Z]/.test(pwd) || /[0-9]/.test(pwd)) && pwd.length >= 8) return 'Medium';
    return 'Weak';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'password') {
      setPasswordStrength(evaluatePasswordStrength(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    try {
      const response = await api.post('/auth/signup', {
        username: formData.username,
        email: formData.email,
        mobile: formData.mobile,
        password: formData.password
      });
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', formData.username);
      setIsAuthenticated(true);
      navigate('/education');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength) {
      case 'Strong': return 'limegreen';
      case 'Medium': return 'gold';
      default: return 'crimson';
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-heading">🚀 Create Your Account</h2>
      <p className="auth-subheading">Start your journey with us!</p>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="👤 Username"
          value={formData.username}
          onChange={handleChange}
          className="auth-input"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="📧 Email"
          value={formData.email}
          onChange={handleChange}
          className="auth-input"
          required
        />
        <input
          type="text"
          name="mobile"
          placeholder="📱 Mobile Number"
          value={formData.mobile}
          onChange={handleChange}
          className="auth-input"
        />
        <input
          type="password"
          name="password"
          placeholder="🔒 Password (min 8 characters)"
          value={formData.password}
          onChange={handleChange}
          className="auth-input"
          required
        />
        <div className="password-strength" style={{ color: getStrengthColor() }}>
          Password Strength: {passwordStrength}
        </div>
        <input
          type="password"
          name="confirmPassword"
          placeholder="🔐 Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          className="auth-input"
          required
        />
        <button type="submit" className="auth-button">Sign Up</button>
      </form>
      
      <p className="auth-link-text">
        Already have an account? <a href="/auth/login" className="auth-link">Login</a>
      </p>
    </div>
  );
};

export default Signup;