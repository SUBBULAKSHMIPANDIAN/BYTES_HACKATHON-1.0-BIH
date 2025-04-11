import React from 'react';
import Calculator from './Calculator';
import Notes from './Notes';
import Reminders from './Remainders';
import Timer from './Timer';


const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-panels">
        <div className="panel left-panel">
          <Calculator />
          <Notes />
        </div>
        
        <div className="panel middle-panel">
          <h2>Your Study Dashboard</h2>
          <p>
            Use this space to stay organized: Add notes, calculate, set reminders, and use timers to stay focused.
          </p>
        </div>
        
        <div className="panel right-panel">
          <Reminders />
          <Timer />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;