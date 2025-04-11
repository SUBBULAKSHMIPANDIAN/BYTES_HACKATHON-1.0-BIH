import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import DashboardPage from './pages/Dashboardpage';
import AuthPage from './pages/AuthPage';
import Education from './components/Onboarding/Education';
import Survey from './components/Onboarding/Survey';
import api from './api';
import '../src/styles/main.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          await api.get('/auth/verify');
          setIsAuthenticated(true);
        }
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home isAuthenticated={isAuthenticated} />} />
        <Route path="/auth/:type" element={<AuthPage setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="/dashboard" element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/education" element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <Education />
          </ProtectedRoute>
        } />
        <Route path="/survey" element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <Survey />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

function ProtectedRoute({ children, isAuthenticated }) {
  return isAuthenticated ? children : <Navigate to="/auth/login" />;
}

export default App;