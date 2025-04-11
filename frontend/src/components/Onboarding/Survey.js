import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const Survey = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    studyHours: '',
    preferredTime: '',
    subjects: '',
    stressLevel: 'Low'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/survey', {
        username: localStorage.getItem('username'),
        ...formData
      });
      navigate('/');
    } catch (error) {
      console.error('Error submitting survey:', error);
    }
  };

  const handleSkip = () => {
    navigate('/');
  };

  return (
    <div className="auth-page">
      <style>{`
        .auth-page {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
          padding: 2rem;
        }

        .auth-card {
          background: rgba(0, 0, 0, 0.4);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 2.5rem;
          text-align: center;
          color: #ffffff;
          width: 100%;
          max-width: 400px;
        }

        .auth-heading {
          margin-bottom: 1.5rem;
          font-size: 1.8rem;
          font-weight: bold;
        }

        .auth-input {
          width: 100%;
          padding: 0.8rem;
          margin: 0.5rem 0;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          background: #1e2a38;
          color: #fff;
        }

        .auth-input:focus {
          outline: 2px solid #00b4db;
        }

        .auth-button {
          width: 100%;
          padding: 0.8rem;
          margin-top: 1rem;
          background-color: #00b4db;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .auth-button:hover {
          background-color: #009ac6;
        }

        .skip-button {
          background-color: #e2e8f0;
          color: #1a202c;
          margin-top: 0.5rem;
        }

        @media (max-width: 480px) {
          .auth-card {
            padding: 1.5rem;
            width: 90%;
            border-radius: 16px;
          }

          .auth-heading {
            font-size: 1.5rem;
          }

          .auth-input {
            font-size: 0.95rem;
            padding: 0.7rem;
          }

          .auth-button {
            font-size: 0.95rem;
            padding: 0.7rem;
          }
        }
      `}</style>

      <div className="auth-card">
        <h2 className="auth-heading">Study Preferences</h2>
        <form onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="number"
            name="studyHours"
            placeholder="Hours studied per day"
            value={formData.studyHours}
            onChange={handleChange}
            min="0"
            max="24"
          />

          <select
            className="auth-input"
            name="preferredTime"
            value={formData.preferredTime}
            onChange={handleChange}
          >
            <option value="">Preferred Study Time</option>
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Evening">Evening</option>
            <option value="Night">Night</option>
          </select>

          <input
            className="auth-input"
            type="text"
            name="subjects"
            placeholder="Subjects you find difficult"
            value={formData.subjects}
            onChange={handleChange}
          />

          <select
            className="auth-input"
            name="stressLevel"
            value={formData.stressLevel}
            onChange={handleChange}
          >
            <option value="Low">Stress Level: Low</option>
            <option value="Moderate">Stress Level: Moderate</option>
            <option value="High">Stress Level: High</option>
          </select>

          <button type="submit" className="auth-button">Submit Survey</button>
          <button type="button" className="auth-button skip-button" onClick={handleSkip}>
            Skip
          </button>
        </form>
      </div>
    </div>
  );
};

export default Survey;
