import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import '../../styles/auth.css';

const Login = ({ setIsAuthenticated }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.user.username);
      setIsAuthenticated(true);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-heading">🔐 Welcome Back</h2>
      <p className="auth-subheading">Login to continue</p>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="👤 Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="auth-input"
          required
        />
        <input
          type="password"
          placeholder="🔒 Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
          required
        />
        <button type="submit" className="auth-button">Login</button>
      </form>
      
      <p className="auth-link-text">
        Don't have an account? <a href="/auth/signup" className="auth-link">Sign up</a>
      </p>
    </div>
  );
};

export default Login;