import React from 'react';
import { useParams } from 'react-router-dom';
import Login from '../components/Auth/Login';
import Signup from '../components/Auth/Signup';
import '../styles/auth.css';

const AuthPage = ({ setIsAuthenticated }) => {
  const { type } = useParams();
  
  return (
    <div className="auth-page">
      {type === 'login' ? 
        <Login setIsAuthenticated={setIsAuthenticated} /> : 
        <Signup setIsAuthenticated={setIsAuthenticated} />
      }
    </div>
  );
};

export default AuthPage;