import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/main.css';

const Navbar = ({ isAuthenticated }) => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/';
  };

  return (
    <nav className="navbar">
      <div className="logo">
        <Link to="/">⚡ AI Study Buddy</Link>
      </div>
      <div className="nav-links">
        {isAuthenticated ? (
          <>
            <Link to="/">Dashboard</Link>
            <span className="welcome-text">
              Welcome, {localStorage.getItem('username')}!
            </span>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </>
        ) : (
          <>
            <Link to="/">Home</Link>
            <Link to="/auth/login">Sign In</Link>
            <Link to="/auth/signup">Create Account</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;