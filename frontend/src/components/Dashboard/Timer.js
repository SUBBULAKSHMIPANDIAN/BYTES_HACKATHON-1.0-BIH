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
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchEndY, setTouchEndY] = useState(0);

  const [totalTime, setTotalTime] = useState(0);

  useEffect(() => {
    let timer;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          setProgress(1 - (newTime / totalTime)); // Inverted progress calculation
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
    updateTime(type, direction);
  };

  const handleTouchStart = (e) => {
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (type) => (e) => {
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = (type) => (e) => {
    if (touchStartY - touchEndY > 15) {
      updateTime(type, 1);
    } else if (touchEndY - touchStartY > 15) {
      updateTime(type, -1);
    }
    setTouchStartY(0);
    setTouchEndY(0);
  };

  const updateTime = (type, direction) => {
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
      minHeight: '480px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    },
    timeDisplay: {
      display: 'flex',
      gap: '10px',
      margin: '30px 0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeUnit: {
      fontSize: '42px',
      width: '90px',
      height: '90px',
      borderRadius: '15px',
      background: 'rgba(255,255,255,0.15)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: 'ns-resize',
      userSelect: 'none',
      touchAction: 'none',
    },
    controlButtons: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'center',
      margin: '20px 0',
    },
    button: {
      padding: '12px 18px',
      borderRadius: '10px',
      border: 'none',
      background: 'linear-gradient(45deg, #43cea2, #185a9d)',
      color: '#fff',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: '16px',
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
      marginTop: '30px',
      position: 'relative',
    },
    toyRunner: {
      position: 'absolute',
      left: `${progress * 100}%`,
      top: '-15px',
      transition: 'left 1s linear',
      fontSize: '30px',
      transform: isRunning ? 'scaleX(-1)' : 'none',
    },
  };

  // Apply responsive styles
  const responsiveStyles = {
    ...styles,
    timerBox: {
      ...styles.timerBox,
      ...(window.innerWidth <= 480 ? {
        width: '90vw',
        padding: '30px 20px',
        minHeight: 'auto',
      } : {})
    },
    timeUnit: {
      ...styles.timeUnit,
      ...(window.innerWidth <= 480 ? {
        fontSize: '32px',
        width: '70px',
        height: '70px',
      } : {})
    },
    button: {
      ...styles.button,
      ...(window.innerWidth <= 480 ? {
        padding: '10px 15px',
        fontSize: '14px',
      } : {})
    }
  };

  return (
    <div style={responsiveStyles.container}>
      <div style={responsiveStyles.timerBox}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>🧘 Focus Timer</h2>
        <div style={responsiveStyles.timeDisplay}>
          <div
            ref={hourRef}
            style={responsiveStyles.timeUnit}
            onWheel={handleWheel('hours')}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove('hours')}
            onTouchEnd={handleTouchEnd('hours')}
          >
            {String(hours).padStart(2, '0')}
          </div>
          <span style={{ fontSize: '36px' }}>:</span>
          <div
            ref={minuteRef}
            style={responsiveStyles.timeUnit}
            onWheel={handleWheel('minutes')}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove('minutes')}
            onTouchEnd={handleTouchEnd('minutes')}
          >
            {String(minutes).padStart(2, '0')}
          </div>
          <span style={{ fontSize: '36px' }}>:</span>
          <div
            ref={secondRef}
            style={responsiveStyles.timeUnit}
            onWheel={handleWheel('seconds')}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove('seconds')}
            onTouchEnd={handleTouchEnd('seconds')}
          >
            {String(seconds).padStart(2, '0')}
          </div>
        </div>
        <div>
          <div style={responsiveStyles.controlButtons}>
            {!isRunning && isTimeSet && (
              <button
                style={timeLeft === 0 ? { ...responsiveStyles.button, ...responsiveStyles.disabledButton } : responsiveStyles.button}
                onClick={startTimer}
                disabled={timeLeft === 0}
              >
                ▶ Start
              </button>
            )}
            {isRunning && (
              <button style={responsiveStyles.button} onClick={pauseTimer}>⏸ Pause</button>
            )}
            <button style={responsiveStyles.button} onClick={resetTimer}>🔁 Reset</button>
          </div>
          <div style={responsiveStyles.controlButtons}>
            <button style={responsiveStyles.button} onClick={() => setPresetTime(0.5)}>30 Min</button>
            <button style={responsiveStyles.button} onClick={() => setPresetTime(1)}>1 Hr</button>
          </div>
        </div>
        <div style={responsiveStyles.progressBar}>
          <div style={responsiveStyles.toyRunner}>🏃</div>
        </div>
      </div>
    </div>
  );
}

export default Timer;