import React from 'react';
import { useNavigate } from 'react-router-dom';
import Calculator from './Calculator';
import Notes from './Notes';
import Reminders from './Remainders';
import Timer from './Timer';
import '../../styles/dashboard.css';
import GraphPlotter from './GraphPlotter';

const Dashboard = () => {
  const navigate = useNavigate();

  const openChatbot = () => {
    navigate('/chatbot');
  };

  const openSamplePage = () => {
    navigate('/sample-page'); // You can change this route as needed
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-panels">

        {/* Left Panel */}
        <div className="panel left-panel">
          <Calculator />
          <Notes />
        </div>

        {/* Middle Panel */}
        <div className="panel middle-panel">
          {/* New Sample Page Button */}
          <button className="sample-page-button" onClick={openSamplePage}>
            Go to Sample Page
          </button>
          
          <h2>Your Study Dashboard</h2>
          <p>
            Use this space to stay organized: Add notes, calculate, set reminders, and use timers to stay focused.
          </p>

          {/* Chatbot button with spacing */}
          <div className="chatbot-button-wrapper">
            <button className="chatbot-button" onClick={openChatbot}>
              🗨️ Open Study Buddy Chatbot
            </button>
          </div>

          {/* GraphPlotter section */}
          <div className="graph-container">
            <GraphPlotter />
          </div>
        </div>

        {/* Right Panel */}
        <div className="panel right-panel">
          <Reminders />
          <Timer />
        </div>

      </div>
    </div>
  );
};

export default Dashboard;