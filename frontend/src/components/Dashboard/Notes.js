import React, { useState, useEffect } from 'react';
import api from '../../api';
import '../../styles/dashboard.css';
import { FaTimes, FaSave ,FaTrash} from 'react-icons/fa';

const Notes = () => {
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeNote, setActiveNote] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

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
      isMounted = false;
    };
  }, []);

  const handleAddNote = async () => {
    if (!activeNote?.title?.trim()) {
      setError('Title cannot be empty');
      return;
    }
    if (!activeNote?.content?.trim()) {
      setError('Content cannot be empty');
      return;
    }
    
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        throw new Error('Username not found in local storage');
      }

      const response = await api.post('/notes', {
        username,
        title: activeNote.title.trim(),
        content: activeNote.content.trim()
      });
      
      if (response.data?.note) {
        setNotes([response.data.note, ...notes]);
        setActiveNote(null);
        setError('');
        setIsModalOpen(false);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
      setError(error.response?.data?.message || error.message || 'Failed to add note');
    }
  };

  const handleUpdateNote = async () => {
    if (!activeNote?.title?.trim()) {
      setError('Title cannot be empty');
      return;
    }
    if (!activeNote?.content?.trim()) {
      setError('Content cannot be empty');
      return;
    }
    
    try {
      const response = await api.put(`/notes/${activeNote._id}`, {
        title: activeNote.title.trim(),
        content: activeNote.content.trim()
      });
      
      if (response.data?.note) {
        setNotes(notes.map(note => 
          note._id === activeNote._id ? response.data.note : note
        ));
        setActiveNote(null);
        setIsModalOpen(false);
        setError('');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Failed to update note:', error);
      setError(error.response?.data?.message || error.message || 'Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.delete(`/notes/${noteId}`);
      setNotes(notes.filter(note => note._id !== noteId));
      if (activeNote?._id === noteId) {
        setActiveNote(null);
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      setError(error.response?.data?.message || error.message || 'Failed to delete note');
    }
  };

  const openNoteModal = (note = null) => {
    setActiveNote(note || { title: '', content: '' });
    setIsModalOpen(true);
    setError('');
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
      {error && !isModalOpen && <div className="error-message">{error}</div>}
      
      <div className="items-list">
        {notes.length > 0 ? (
          notes.map((note) => (
            <div 
              key={note._id} 
              className="note-card"
              onClick={() => openNoteModal(note)}
            >
              <div className="note-header">
                <h4 className="note-title">{note.title}</h4>
                <button 
                  className="icon-button delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(note._id);
                  }}
                >
                  <FaTrash />
                </button>
              </div>
              <p className="note-preview">
                {note.content.length > 50 
                  ? `${note.content.substring(0, 50)}...` 
                  : note.content}
              </p>
              {note.createdAt && (
                <span className="note-date">
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="empty-notes">
            <p>No notes yet.</p>
            <button 
              className="add-note-button"
              onClick={() => openNoteModal()}
            >
              Add New Note
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="note-modal-overlay">
          <div className="note-modal">
            <div className="modal-header">
              <h3>{activeNote?._id ? 'Edit Note' : 'Add New Note'}</h3>
              <button 
                className="icon-button close-button"
                onClick={() => setIsModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="modal-body">
              <input
                type="text"
                placeholder="Note title"
                value={activeNote?.title || ''}
                onChange={(e) => setActiveNote({
                  ...activeNote,
                  title: e.target.value
                })}
                className="modal-input"
              />
              <textarea
                placeholder="Note content"
                value={activeNote?.content || ''}
                onChange={(e) => setActiveNote({
                  ...activeNote,
                  content: e.target.value
                })}
                className="modal-textarea"
              />
              {error && <div className="error-message">{error}</div>}
            </div>
            
            <div className="modal-footer">
              {activeNote?._id && (
                <button 
                  className="delete-button"
                  onClick={() => handleDeleteNote(activeNote._id)}
                >
                  <FaTrash /> Delete
                </button>
              )}
              <button 
                className="save-button"
                onClick={activeNote?._id ? handleUpdateNote : handleAddNote}
              >
                <FaSave /> {activeNote?._id ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <button 
          className="add-note-button floating-button"
          onClick={() => openNoteModal()}
        >
          + Add Note
        </button>
      )}
    </div>
  );
};

export default Notes;