import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Education() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [classOrYear, setClassOrYear] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (!storedUsername) {
      alert('No user found. Please login.');
      navigate('/login');
    } else {
      setUsername(storedUsername);
    }
  }, [navigate]);

  const getClassOptions = () => {
    switch (educationLevel) {
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

  const handleSubmit = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/education", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          educationLevel,
          classOrYear,
          institution,
          course,
          semester
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error saving education");
      alert("Education saved!");
      navigate('/survey');
    } catch (err) {
      alert("Error saving education.");
    }
  };

  const handleSkip = async () => {
    try {
      await axios.post('http://localhost:5000/api/education', {
        username,
        skipped: true
      });
      alert("Skipped education!");
      navigate('/survey');
    } catch (err) {
      console.error(err);
      alert("Error skipping education.");
    }
  };

  return (
    <>
      <style>{`
        body {
          margin: 0;
          padding: 0;
          height: 100vh;
          background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          font-family: 'Segoe UI', sans-serif;
        }
        .greeting {
          color: white;
          font-size: 22px;
          margin-bottom: 20px;
          font-weight: bold;
        }
        .form-container {
          background: rgba(0, 0, 0, 0.4);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          text-align: center;
          color: #ffffff;
          width: 350px;
        }
        input, select {
          width: 100%;
          padding: 12px;
          margin: 10px 0;
          border-radius: 8px;
          border: none;
          outline: none;
          font-size: 16px;
          background: #1e2a38;
          color: #fff;
        }
        button {
          width: 100%;
          padding: 12px;
          margin-top: 10px;
          background-color: #00b4db;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          color: white;
          font-weight: bold;
          font-size: 16px;
          transition: 0.3s;
        }
        button:hover {
          background-color: #009ac6;
        }
      `}</style>

      <div className="greeting">Hi {username}, please fill your education details 👇</div>

      <div className="form-container">
        <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
          <option value="">🎓 Select Education Level</option>
          <option value="Secondary School">Secondary School</option>
          <option value="High School">High School</option>
          <option value="UG">Undergraduate (UG)</option>
          <option value="PG">Postgraduate (PG)</option>
        </select>

        {educationLevel && (
          <select value={classOrYear} onChange={(e) => setClassOrYear(e.target.value)}>
            <option value="">📘 Select Class/Year</option>
            {getClassOptions().map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        )}

        <input type="text" placeholder="🏫 Institution/College Name" value={institution} onChange={(e) => setInstitution(e.target.value)} />
        <input type="text" placeholder="📚 Course Name" value={course} onChange={(e) => setCourse(e.target.value)} />
        <input type="text" placeholder="📅 Semester" value={semester} onChange={(e) => setSemester(e.target.value)} />

        <button onClick={handleSubmit}>Submit</button>
        <button onClick={handleSkip}>Skip</button>
      </div>
    </>
  );
}

export default Education;
