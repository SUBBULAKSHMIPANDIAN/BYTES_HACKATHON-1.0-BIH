import React, { useState, useEffect } from 'react';
import api from '../../api';
import '../../styles/dashboard.css';

const Notes = () => {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount

    const fetchNotes = async () => {
      try {
        const username = localStorage.getItem('username');
        if (!username) {
          throw new Error('Username not found in local storage');
        }

        const response = await api.get(`/notes/${username}`);
        
        if (isMounted) {
          setNotes(response.data?.notes || []);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch notes:', error);
        if (isMounted) {
          setError('Failed to load notes. Please try again.');
          setIsLoading(false);
        }
      }
    };

    fetchNotes();

    return () => {
      isMounted = false; // Cleanup function
    };
  }, []);

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      setError('Note cannot be empty');
      return;
    }
    
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        throw new Error('Username not found in local storage');
      }

      const response = await api.post('/notes', {
        username,
        content: newNote
      });
      
      if (response.data?.note) {
        setNotes([response.data.note, ...notes]);
        setNewNote('');
        setError('');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
      setError(error.response?.data?.message || error.message || 'Failed to add note');
    }
  };

  if (isLoading) {
    return (
      <div className="notes-section">
        <h3>Notes</h3>
        <div className="loading-message">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="notes-section">
      <h3>Notes</h3>
      {error && <div className="error-message">{error}</div>}
      <div className="input-group">
        <input
          type="text"
          placeholder="Enter a note"
          value={newNote}
          onChange={(e) => {
            setNewNote(e.target.value);
            setError('');
          }}
          onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
        />
        <button onClick={handleAddNote}>Add Note</button>
      </div>
      <div className="items-list">
        {notes.length > 0 ? (
          notes.map((note) => (
            <div key={note._id || Math.random()} className="card">
              <span className="note-content">📝 {note.content}</span>
              {note.createdAt && (
                <span className="note-date">
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="empty-message">No notes yet. Add your first note!</div>
        )}
      </div>
    </div>
  );
};

export default Notes;