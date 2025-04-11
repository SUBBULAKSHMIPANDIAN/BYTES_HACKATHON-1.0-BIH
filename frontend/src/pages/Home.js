import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import '../styles/main.css';
import DashboardPage from '../pages/Dashboardpage'
const Home = ({ isAuthenticated }) => {
  return (
    <div className="app-container">
      <Navbar isAuthenticated={isAuthenticated} />
      
      {!isAuthenticated ? (
        <div className="main-content">
          <h1>A New Way to Learn</h1>
          <p>
            AI Study Buddy helps you enhance your skills, track your growth, and get ready for tech interviews — all in one place.
          </p>
          <Link className="btn" to="/auth/signup">Create Account →</Link>
          <p className="cta-text">Start exploring now and level up! 🚀</p>
        </div>
      ) : (
        <DashboardPage />
      )}
    </div>
  );
};

export default Home;