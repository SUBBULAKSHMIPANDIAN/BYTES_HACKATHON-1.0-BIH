import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';


const Education = () => {
  const navigate = useNavigate();
  const [education, setEducation] = useState({
    educationLevel: '',
    classOrYear: '',
    institution: '',
    course: '',
    semester: ''
  });

  const getClassOptions = () => {
    switch (education.educationLevel) {
      case 'Secondary School':
        return ['3rd Std', '4th Std', '5th Std'];
      case 'High School':
        return ['6th Std', '7th Std', '8th Std', '9th Std', '10th Std', '11th Std', '12th Std'];
      case 'UG':
        return ['1st Year (BE/BTech)', '2nd Year (BE/BTech)', '3rd Year (BE/BTech)', '4th Year (BE/BTech)', '1st Year (BSc)', '2nd Year (BSc)', '3rd Year (BSc)'];
      case 'PG':
        return ['1st Year (ME/MTech)', '2nd Year (ME/MTech)', '1st Year (MBA/MSc)', '2nd Year (MBA/MSc)'];
      default:
        return [];
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/education', {
        username: localStorage.getItem('username'),
        ...education
      });
      navigate('/survey');
    } catch (error) {
      console.error('Error saving education:', error);
      alert('Failed to save education details');
    }
  };

  const handleSkip = async () => {
    try {
      await api.post('/education', {
        username: localStorage.getItem('username'),
        skipped: true
      });
      navigate('/survey');
    } catch (error) {
      console.error('Error skipping education:', error);
    }
  };

  return (
    <div className="onboarding-container">
      <h2>Hi {localStorage.getItem('username')}, please fill your education details 👇</h2>
      
      <form className="education-form" onSubmit={handleSubmit}>
        <select
          value={education.educationLevel}
          onChange={(e) => setEducation({ ...education, educationLevel: e.target.value, classOrYear: '' })}
          required
        >
          <option value="">🎓 Select Education Level</option>
          <option value="Secondary School">Secondary School</option>
          <option value="High School">High School</option>
          <option value="UG">Undergraduate (UG)</option>
          <option value="PG">Postgraduate (PG)</option>
        </select>

        {education.educationLevel && (
          <select
            value={education.classOrYear}
            onChange={(e) => setEducation({ ...education, classOrYear: e.target.value })}
            required
          >
            <option value="">📘 Select Class/Year</option>
            {getClassOptions().map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        )}

        <input
          type="text"
          placeholder="🏫 Institution/College Name"
          value={education.institution}
          onChange={(e) => setEducation({ ...education, institution: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="📚 Course Name"
          value={education.course}
          onChange={(e) => setEducation({ ...education, course: e.target.value })}
        />
        <input
          type="text"
          placeholder="📅 Semester"
          value={education.semester}
          onChange={(e) => setEducation({ ...education, semester: e.target.value })}
        />

        <button type="submit">Submit</button>
        <button type="button" onClick={handleSkip} className="skip-button">Skip</button>
      </form>
    </div>
  );
};

export default Education;