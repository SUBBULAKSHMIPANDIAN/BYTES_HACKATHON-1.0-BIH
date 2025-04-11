import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import '../../styles/Onboarding.css';

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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/survey', {
        username: localStorage.getItem('username'),
        ...formData
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting survey:', error);
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <div className="onboarding-container">
      <h2>User Survey</h2>
      
      <form className="survey-form" onSubmit={handleSubmit}>
        <label>How many hours do you study per day?</label>
        <input
          type="number"
          name="studyHours"
          value={formData.studyHours}
          onChange={handleChange}
          placeholder="e.g., 3"
          min="0"
          max="24"
        />

        <label>What's your preferred study time?</label>
        <select
          name="preferredTime"
          value={formData.preferredTime}
          onChange={handleChange}
        >
          <option value="">Select time</option>
          <option value="Morning">Morning</option>
          <option value="Afternoon">Afternoon</option>
          <option value="Evening">Evening</option>
          <option value="Night">Night</option>
        </select>

        <label>Subjects you find difficult:</label>
        <input
          type="text"
          name="subjects"
          value={formData.subjects}
          onChange={handleChange}
          placeholder="e.g., Maths, Physics"
        />

        <label>Current Stress Level:</label>
        <select
          name="stressLevel"
          value={formData.stressLevel}
          onChange={handleChange}
        >
          <option value="Low">Low</option>
          <option value="Moderate">Moderate</option>
          <option value="High">High</option>
        </select>

        <div className="form-buttons">
          <button type="submit">Submit Survey</button>
          <button type="button" onClick={handleSkip} className="skip-button">
            Skip
          </button>
        </div>
      </form>
    </div>
  );
};

export default Survey;