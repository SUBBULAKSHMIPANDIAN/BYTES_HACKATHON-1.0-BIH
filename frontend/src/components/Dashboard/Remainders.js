import React, { useState } from 'react';


const Reminders = () => {
  const [reminder, setReminder] = useState({ date: '', time: '', note: '' });
  const [reminders, setReminders] = useState([]);

  const handleAddReminder = () => {
    if (reminder.date && reminder.time && reminder.note.trim()) {
      setReminders([...reminders, reminder]);
      setReminder({ date: '', time: '', note: '' });
    }
  };

  return (
    <div className="reminders-section">
      <h3>Reminders</h3>
      <input
        type="date"
        value={reminder.date}
        onChange={(e) => setReminder({ ...reminder, date: e.target.value })}
      />
      <input
        type="time"
        value={reminder.time}
        onChange={(e) => setReminder({ ...reminder, time: e.target.value })}
      />
      <input
        type="text"
        placeholder="Reminder note"
        value={reminder.note}
        onChange={(e) => setReminder({ ...reminder, note: e.target.value })}
      />
      <button onClick={handleAddReminder}>Set Reminder</button>
      <div className="items-list">
        {reminders.map((rem, idx) => (
          <div key={idx} className="card">
            📅 {rem.date} ⏰ {rem.time} - {rem.note}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reminders;