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
            position: "top-right",
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

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>📝 Set Your Reminders</h2>
      <div style={styles.form}>
        <input
          type="date"
          value={reminder.date}
          onChange={(e) => setReminder({ ...reminder, date: e.target.value })}
          style={styles.input}
        />
        <input
          type="time"
          value={reminder.time}
          onChange={(e) => setReminder({ ...reminder, time: e.target.value })}
          style={styles.input}
        />
        <input
          type="text"
          placeholder="Reminder note"
          value={reminder.note}
          onChange={(e) => setReminder({ ...reminder, note: e.target.value })}
          style={styles.input}
        />
        <button onClick={handleAddReminder} style={styles.button}>
          ➕ Add Reminder
        </button>
      </div>

      <div style={styles.list}>
        {reminders.map((rem, idx) => (
          <div key={idx} style={styles.card}>
            <div>📅 {rem.date}</div>
            <div>⏰ {rem.time}</div>
            <div>📝 {rem.note}</div>
            {rem.notified && <div style={styles.notified}>✅ Notified</div>}
            <button
              onClick={() => handleDeleteReminder(idx)}
              style={styles.deleteButton}
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

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Segoe UI, sans-serif',
    backgroundColor: '#f0f4f8',
    borderRadius: '12px',
    maxWidth: '600px',
    margin: 'auto',
  },
  heading: {
    textAlign: 'center',
    color: '#333',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  },
  input: {
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    fontSize: '16px',
  },
  button: {
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(to right, #43cea2, #185a9d)',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  card: {
    backgroundColor: '#fff',
    padding: '12px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    position: 'relative',
  },
  notified: {
    marginTop: '8px',
    color: 'green',
    fontWeight: 'bold',
  },
  deleteButton: {
    marginTop: '10px',
    padding: '6px 12px',
    border: 'none',
    backgroundColor: '#ff4d4f',
    color: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

export default Reminders;
