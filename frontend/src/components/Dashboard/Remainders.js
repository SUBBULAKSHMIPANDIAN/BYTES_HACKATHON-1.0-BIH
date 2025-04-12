import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Reminders = () => {
  const [userId, setUserId] = useState(null);
  const [reminder, setReminder] = useState({ date: '', time: '', note: '' });
  const [reminders, setReminders] = useState([]);

  const remindersRef = useRef(reminders);

  useEffect(() => {
    const uid = localStorage.getItem('username');
    if (uid) {
      setUserId(uid);

      const stored = localStorage.getItem(`reminders-${uid}`);
      if (stored) {
        setReminders(JSON.parse(stored));
      }
    }
  }, []);

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    if (userId) {
      localStorage.setItem(`reminders-${userId}`, JSON.stringify(reminders));
    }
  }, [reminders, userId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5);

      remindersRef.current.forEach((rem, index) => {
        if (rem.date === currentDate && rem.time === currentTime && !rem.notified) {
          toast.info(`🔔 Reminder: ${rem.note}`, {
            position: window.innerWidth > 768 ? "top-right" : "top-center",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });

          setReminders((prev) => {
            const updated = [...prev];
            updated[index].notified = true;
            return updated;
          });
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleAddReminder = () => {
    if (reminder.date && reminder.time && reminder.note.trim()) {
      setReminders([...reminders, { ...reminder, notified: false }]);
      setReminder({ date: '', time: '', note: '' });
    }
  };

  const handleDeleteReminder = (indexToDelete) => {
    setReminders(reminders.filter((_, index) => index !== indexToDelete));
  };

  // Responsive styles
  const isMobile = window.innerWidth <= 768;

  const responsiveStyles = {
    container: {
      padding: isMobile ? '15px' : '20px',
      fontFamily: 'Segoe UI, sans-serif',
      backgroundColor: '#f0f4f8',
      borderRadius: '12px',
      maxWidth: isMobile ? '100%' : '600px',
      margin: 'auto',
      boxSizing: 'border-box',
      background: 'linear-gradient(to right, rgb(102, 126, 234), rgb(118, 75, 162))',
    },
    heading: {
      textAlign: 'center',
      color: '#333',
      fontSize: isMobile ? '1.5rem' : '2rem',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '8px' : '10px',
      marginBottom: '20px',
    },
    input: {
      padding: isMobile ? '8px' : '10px',
      borderRadius: '8px',
      border: '1px solid #ccc',
      fontSize: isMobile ? '14px' : '16px',
    },
    button: {
      padding: isMobile ? '8px' : '10px',
      borderRadius: '8px',
      border: 'none',
      background: 'linear-gradient(to right, #43cea2, #185a9d)',
      color: '#fff',
      fontSize: isMobile ? '14px' : '16px',
      cursor: 'pointer',
    },
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '8px' : '10px',
    },
    card: {
      backgroundColor: '#fff',
      padding: isMobile ? '10px' : '12px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'relative',
      fontSize: isMobile ? '14px' : '16px',
    },
    notified: {
      marginTop: '8px',
      color: 'green',
      fontWeight: 'bold',
      fontSize: isMobile ? '12px' : '14px',
    },
    deleteButton: {
      marginTop: '8px',
      padding: isMobile ? '5px 10px' : '6px 12px',
      border: 'none',
      backgroundColor: '#ff4d4f',
      color: '#fff',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: isMobile ? '12px' : '14px',
    },
  };

  return (
    <div style={responsiveStyles.container}>
      <h2 style={responsiveStyles.heading}>📝 Set Your Reminders</h2>
      <div style={responsiveStyles.form}>
        <input
          type="date"
          value={reminder.date}
          onChange={(e) => setReminder({ ...reminder, date: e.target.value })}
          style={responsiveStyles.input}
        />
        <input
          type="time"
          value={reminder.time}
          onChange={(e) => setReminder({ ...reminder, time: e.target.value })}
          style={responsiveStyles.input}
        />
        <input
          type="text"
          placeholder="Reminder note"
          value={reminder.note}
          onChange={(e) => setReminder({ ...reminder, note: e.target.value })}
          style={responsiveStyles.input}
        />
        <button onClick={handleAddReminder} style={responsiveStyles.button}>
          ➕ Add Reminder
        </button>
      </div>

      <div style={responsiveStyles.list}>
        {reminders.map((rem, idx) => (
          <div key={idx} style={responsiveStyles.card}>
            <div>📅 {rem.date}</div>
            <div>⏰ {rem.time}</div>
            <div>📝 {rem.note}</div>
            {rem.notified && <div style={responsiveStyles.notified}>✅ Notified</div>}
            <button
              onClick={() => handleDeleteReminder(idx)}
              style={responsiveStyles.deleteButton}
            >
              ❌ Delete
            </button>
          </div>
        ))}
      </div>

      <ToastContainer />
    </div>
  );
};

export default Reminders;