import React, { useState, useEffect, useRef } from 'react';

function Timer() {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isTimeSet, setIsTimeSet] = useState(false);
  const [progress, setProgress] = useState(0);

  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const secondRef = useRef(null);

  const [totalTime, setTotalTime] = useState(0);

  useEffect(() => {
    let timer;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          setProgress((totalTime - newTime) / totalTime);
          if (newTime <= 0) {
            setIsRunning(false);
            alert('⏰ Time is up!');
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, totalTime]);

  useEffect(() => {
    const hrs = Math.floor(timeLeft / 3600);
    const mins = Math.floor((timeLeft % 3600) / 60);
    const secs = timeLeft % 60;
    setHours(hrs);
    setMinutes(mins);
    setSeconds(secs);
  }, [timeLeft]);

  const setPresetTime = (hrs) => {
    const seconds = hrs * 3600;
    setHours(hrs);
    setMinutes(0);
    setSeconds(0);
    setTimeLeft(seconds);
    setTotalTime(seconds);
    setProgress(0);
    setIsTimeSet(true);
  };

  const handleWheel = (type) => (e) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    let newHrs = hours, newMins = minutes, newSecs = seconds;

    if (type === 'hours') {
      newHrs = Math.max(0, Math.min(23, hours + direction));
      setHours(newHrs);
    } else if (type === 'minutes') {
      newMins = Math.max(0, Math.min(59, minutes + direction));
      setMinutes(newMins);
    } else if (type === 'seconds') {
      newSecs = Math.max(0, Math.min(59, seconds + direction));
      setSeconds(newSecs);
    }

    const newTime = (newHrs * 3600) + (newMins * 60) + newSecs;
    setTimeLeft(newTime);
    setTotalTime(newTime);
    setIsTimeSet(true);
  };

  const startTimer = () => {
    if (timeLeft > 0) {
      setIsRunning(true);
    }
  };

  const pauseTimer = () => setIsRunning(false);

  const resetTimer = () => {
    setIsRunning(false);
    setHours(0);
    setMinutes(0);
    setSeconds(0);
    setTimeLeft(0);
    setTotalTime(0);
    setProgress(0);
    setIsTimeSet(false);
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: 'auto',
      padding: '10px',
      fontFamily: 'Segoe UI, sans-serif',
      backgroundColor: '#f5f5f5',
    },
    timerBox: {
      background: 'linear-gradient(to right, #667eea, #764ba2)',
      padding: '40px 30px',
      borderRadius: '20px',
      color: '#fff',
      textAlign: 'center',
      boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
      width: '380px',
      minHeight: '480px', // Increased from 420px to 480px
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    },
    timeDisplay: {
      display: 'flex',
      gap: '10px',
      margin: '30px 0', // Increased margin for better spacing
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeUnit: {
      fontSize: '42px', // Slightly larger font
      width: '90px', // Slightly wider
      height: '90px', // Slightly taller
      borderRadius: '15px',
      background: 'rgba(255,255,255,0.15)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: 'ns-resize',
      userSelect: 'none',
    },
    controlButtons: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'center',
      margin: '20px 0', // Increased margin
    },
    button: {
      padding: '12px 18px', // Slightly larger buttons
      borderRadius: '10px',
      border: 'none',
      background: 'linear-gradient(45deg, #43cea2, #185a9d)',
      color: '#fff',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: '16px', // Slightly larger font
    },
    disabledButton: {
      background: '#ccc',
      cursor: 'not-allowed',
    },
    progressBar: {
      width: '100%',
      height: '30px',
      background: '#ddd',
      borderRadius: '20px',
      overflow: 'hidden',
      marginTop: '30px', // Increased margin
      position: 'relative',
    },
    toyRunner: {
      position: 'absolute',
      left: `${progress * 100}%`,
      top: '-15px',
      transition: 'left 1s linear',
      fontSize: '30px',
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.timerBox}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>🧘 Focus Timer</h2>
        <div style={styles.timeDisplay}>
          <div
            ref={hourRef}
            style={styles.timeUnit}
            onWheel={handleWheel('hours')}
          >
            {String(hours).padStart(2, '0')}
          </div>
          <span style={{ fontSize: '36px' }}>:</span>
          <div
            ref={minuteRef}
            style={styles.timeUnit}
            onWheel={handleWheel('minutes')}
          >
            {String(minutes).padStart(2, '0')}
          </div>
          <span style={{ fontSize: '36px' }}>:</span>
          <div
            ref={secondRef}
            style={styles.timeUnit}
            onWheel={handleWheel('seconds')}
          >
            {String(seconds).padStart(2, '0')}
          </div>
        </div>
        <div>
          <div style={styles.controlButtons}>
            {!isRunning && isTimeSet && (
              <button
                style={timeLeft === 0 ? { ...styles.button, ...styles.disabledButton } : styles.button}
                onClick={startTimer}
                disabled={timeLeft === 0}
              >
                ▶ Start
              </button>
            )}
            {isRunning && (
              <button style={styles.button} onClick={pauseTimer}>⏸ Pause</button>
            )}
            <button style={styles.button} onClick={resetTimer}>🔁 Reset</button>
          </div>
          <div style={styles.controlButtons}>
            <button style={styles.button} onClick={() => setPresetTime(0.5)}>30 Min</button>
            <button style={styles.button} onClick={() => setPresetTime(1)}>1 Hr</button>
          </div>
        </div>
        <div style={styles.progressBar}>
          <div style={styles.toyRunner}>🏃</div>
        </div>
      </div>
    </div>
  );
}

export default Timer;