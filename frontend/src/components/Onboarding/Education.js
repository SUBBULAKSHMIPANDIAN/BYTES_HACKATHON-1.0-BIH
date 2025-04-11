import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api'; // Ensure correct path

const EducationForm = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    year: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/education', {
        username: localStorage.getItem('username'),
        ...formData
      });
      navigate('/survey');
    } catch (error) {
      console.error('Error submitting education:', error);
    }
  };

  const handleSkip = () => {
    navigate('/survey');
  };

  return (
    <div className="auth-page">
      <style jsx>{`
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
          margin-bottom: 1rem;
          font-size: 1.8rem;
          font-weight: bold;
        }

        .auth-subheading {
          font-size: 0.9rem;
          margin-bottom: 1.5rem;
          color: #ccc;
        }

        .form-group {
          margin-bottom: 1.2rem;
          text-align: left;
        }

        label {
          display: block;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
          color: #eee;
        }

        input {
          width: 100%;
          padding: 0.8rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          background: #1e2a38;
          color: #fff;
        }

        input:focus {
          outline: 2px solid #00b4db;
        }

        .submit-btn,
        .skip-btn {
          width: 100%;
          padding: 0.8rem;
          margin-top: 1rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .submit-btn {
          background-color: #00b4db;
          color: #fff;
        }

        .submit-btn:hover {
          background-color: #009ac6;
        }

        .skip-btn {
          background-color: #e5e7eb;
          color: #333;
        }

        .skip-btn:hover {
          background-color: #d1d5db;
        }

        .form-footer {
          margin-top: 1.5rem;
          font-size: 0.9rem;
          color: #ccc;
        }

        .form-footer a {
          color: #00b4db;
          text-decoration: none;
          font-weight: bold;
        }

        .form-footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          .auth-page {
            padding: 1rem;
            flex-direction: column;
          }

          .auth-card {
            padding: 1.5rem;
            width: 90%;
            max-width: none;
            border-radius: 16px;
          }

          .auth-heading {
            font-size: 1.5rem;
          }

          .auth-subheading {
            font-size: 0.85rem;
          }

          input {
            font-size: 0.95rem;
            padding: 0.7rem;
          }

          .submit-btn,
          .skip-btn {
            font-size: 0.95rem;
            padding: 0.7rem;
          }

          .form-footer {
            font-size: 0.85rem;
          }
        }
      `}</style>

      <div className="auth-card">
        <div className="auth-heading">Education Details</div>
        <div className="auth-subheading">Fill in your academic information below</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              name="name"
              id="name"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              name="email"
              id="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="department">Department</label>
            <input
              type="text"
              name="department"
              id="department"
              placeholder="e.g. Computer Science"
              value={formData.department}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="year">Year of Study</label>
            <input
              type="text"
              name="year"
              id="year"
              placeholder="e.g. 3rd Year"
              value={formData.year}
              onChange={handleChange}
            />
          </div>

          <button type="submit" className="submit-btn">Submit</button>
          <button type="button" className="skip-btn" onClick={handleSkip}>Skip</button>
        </form>
      </div>
    </div>
  );
};

export default EducationForm;
