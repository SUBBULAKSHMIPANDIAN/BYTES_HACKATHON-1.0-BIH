import React, { useState, useEffect } from 'react';
/* import '../../styles/dashboard.css'; */

const Timer = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let timer;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      alert('⏰ Time is up!');
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const formatTime = (seconds) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const startTimer = (minutes) => {
    setTimeLeft(minutes * 60);
    setIsRunning(true);
  };

  return (
    <div className="timer-section">
      <h3>Quick Timer</h3>
      <div className="round-timer">
        <div className="timer-display">{formatTime(timeLeft)}</div>
        <div className="timer-options">
          <button onClick={() => startTimer(1)}>1 Min</button>
          <button onClick={() => startTimer(5)}>5 Min</button>
          <button onClick={() => {
            const hour = prompt('Enter number of hours:');
            if (hour && !isNaN(hour)) startTimer(parseInt(hour) * 60);
          }}>Set Hourly Timer</button>
          <button onClick={() => {
            const hours = prompt('Enter hours (0 if none):');
            const minutes = prompt('Enter minutes (0 if none):');
            const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
            if (totalMinutes > 0) startTimer(totalMinutes);
            else alert('Please enter a valid time!');
          }}>Set Custom Timer</button>
        </div>
      </div>
    </div>
  );
};

export default Timer;