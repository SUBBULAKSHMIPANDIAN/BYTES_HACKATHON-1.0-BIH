import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPaperclip, FaMicrophone, FaStop, FaArrowLeft, FaTrash } from 'react-icons/fa';
import io from 'socket.io-client';
import api from '../../api'; // Make sure this import exists
import '../../styles/Chatbot.css';

const Chatbot = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState('⏳ Timer: Not Set');
  const socketRef = useRef(null);
  const chatContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const verifyToken = async () => {
    try {
      await api.get('/auth/verify');
      return true;
    } catch (err) {
      localStorage.removeItem('token');
      localStorage.removeItem('jwtToken');
      return false;
    }
  };
  // Initialize socket and user data
  useEffect(() => {
    const initializeChat = async () => {
      const token = localStorage.getItem('jwtToken') || localStorage.getItem('token');
      
      if (!token || !(await verifyToken())) {
        navigate('/auth/login');
        return;
      }
  
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUser(payload.username);
        
        // Initialize Socket.IO connection
        socketRef.current = io('http://127.0.0.1:8000', {
          extraHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
  
        // Socket listeners
        socketRef.current.on('start_timer', (data) => {
          if (data.username === payload.username) {
            updateTimerDisplay(data.seconds);
          }
        });
  
        socketRef.current.on('timer_finished', (data) => {
          if (data.username === payload.username) {
            setShowAlert(true);
            playAlarmSound();
          }
        });
  
        // Move fetchConversations definition here
        const fetchConversations = async () => {
          try {
            const response = await fetch('/api/conversations', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            const data = await response.json();
            setConversations(data);
            
            if (data.length > 0 && !activeConversation) {
              loadConversation(data[0].id);
            }
          } catch (error) {
            console.error('Error fetching conversations:', error);
          }
        };
  
        // Call it
        await fetchConversations();
  
      } catch (error) {
        console.error('Error initializing chat:', error);
        navigate('/auth/login');
      }
    };
  
    initializeChat();
  
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [navigate]); // Now we don't need fetchConversations in dependencies

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Alert state
  const [showAlert, setShowAlert] = useState(false);
  const alarmSoundRef = useRef(null);

  const playAlarmSound = () => {
    if (alarmSoundRef.current) {
      alarmSoundRef.current.play();
    }
  };

  const dismissAlert = () => {
    setShowAlert(false);
    if (alarmSoundRef.current) {
      alarmSoundRef.current.pause();
      alarmSoundRef.current.currentTime = 0;
    }
  };

  // Fetch user conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
      const data = await response.json();
      setConversations(data);
      
      // If there are conversations but none active, set the first one as active
      if (data.length > 0 && !activeConversation) {
        loadConversation(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Load a specific conversation
  const loadConversation = async (conversationId) => {
    try {
      const response = await fetch(`/api/conversation/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
      const data = await response.json();
      setMessages(data.messages);
      setActiveConversation(conversationId);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  // Delete a conversation
  const deleteConversation = async (conversationId) => {
    try {
      await fetch(`/api/conversation/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
      
      // Refresh conversations
      await fetchConversations();
      
      // If we deleted the active conversation, clear the messages
      if (activeConversation === conversationId) {
        setMessages([]);
        setActiveConversation(null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  // Send a message
  const sendMessage = async () => {
    const msg = message.trim();
    if (!msg) return;

    // Add user message to UI immediately
    const userMessage = { query: msg, response: '', timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('query', msg);
      if (activeConversation) {
        formData.append('conversation_id', activeConversation);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        body: formData
      });

      const data = await response.json();
      
      // Update with AI response
      setMessages(prev => [...prev.slice(0, -1), {
        ...userMessage,
        response: data.response
      }]);

      // If this started a new conversation, refresh the list
      if (data.conversation_id && !activeConversation) {
        setActiveConversation(data.conversation_id);
        await fetchConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev.slice(0, -1), {
        ...userMessage,
        response: "Sorry, I encountered an error. Please try again."
      }]);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (message) formData.append('query', message);
    if (activeConversation) formData.append('conversation_id', activeConversation);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        body: formData
      });

      const data = await response.json();
      
      // Add to messages
      setMessages(prev => [...prev, {
        query: message || `File: ${file.name}`,
        response: data.response,
        timestamp: new Date().toLocaleTimeString()
      }]);

      // Clear input
      setMessage('');
      e.target.value = '';

      // If new conversation, refresh list
      if (data.conversation_id && !activeConversation) {
        setActiveConversation(data.conversation_id);
        await fetchConversations();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessages(prev => [...prev, {
        query: message || `File: ${file.name}`,
        response: "Failed to process the file. Please try again.",
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  };

  // Audio recording
  const toggleAudioRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/m4a' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.m4a');
          if (activeConversation) formData.append('conversation_id', activeConversation);

          try {
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
              },
              body: formData
            });

            const data = await response.json();
            setMessages(prev => [...prev, {
              query: '[Voice Message]',
              response: data.response,
              timestamp: new Date().toLocaleTimeString()
            }]);

            if (data.conversation_id && !activeConversation) {
              setActiveConversation(data.conversation_id);
              await fetchConversations();
            }
          } catch (error) {
            console.error('Error sending audio:', error);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    } else {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      }
    }
  };

  // Timer functions
  const updateTimerDisplay = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    setTimer(`⏳ Timer: ${mins}m ${secs}s`);
  };

  const cancelTimer = () => {
    if (socketRef.current) {
      socketRef.current.emit('cancel_timer');
      setTimer('⏳ Timer: Not Set');
    }
  };

  const addTime = (seconds) => {
    if (socketRef.current) {
      socketRef.current.emit('add_time', { seconds });
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="chatbot-container">
      <div className="sidebar">
        <div className="user-info">
          <button className="back-button" onClick={() => navigate('/')}>
            <FaArrowLeft /> Back to Dashboard
          </button>
          {currentUser && <span id="username-display">Welcome, {currentUser}</span>}
        </div>
        <div className="chat-history">
          <h3>Chat History</h3>
          <div id="chat-list">
            {conversations.map(conv => (
              <div 
                key={conv.id} 
                className={`chat-item ${activeConversation === conv.id ? 'active' : ''}`}
                onClick={() => loadConversation(conv.id)}
              >
                <div className="chat-header">
                  <div className="chat-preview">{conv.title}</div>
                  <button 
                    className="delete-chat-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                  >
                    <FaTrash />
                  </button>
                </div>
                <div className="chat-time">{conv.last_updated}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="main-content">
        <h1>AI Study Buddy</h1>
        <div id="chat-container" ref={chatContainerRef}>
          {messages.map((msg, index) => (
            <React.Fragment key={index}>
              <div className="message user">
                <p>{msg.query}</p>
                <span className="timestamp">{msg.timestamp}</span>
              </div>
              {msg.response && (
                <div className="message assistant">
                  <p>{msg.response}</p>
                  <span className="timestamp">{msg.timestamp}</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="input-area">
          <input 
            type="text" 
            id="user-input" 
            placeholder="Type your message..." 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button 
            id="attachment-btn" 
            className="icon-btn" 
            onClick={() => document.getElementById('file-input').click()}
            title="Attach file"
          >
            <FaPaperclip />
          </button>
          <input 
            type="file" 
            id="file-input" 
            style={{ display: 'none' }} 
            onChange={handleFileUpload}
            accept=".pdf,.docx,.txt,image/*"
          />
          <button 
            id="audio-btn" 
            className={`icon-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleAudioRecording} 
            title={isRecording ? "Stop recording" : "Voice message"}
          >
            {isRecording ? <FaStop /> : <FaMicrophone />}
          </button>
          <button id="send-btn" onClick={sendMessage}>Send</button>
        </div>
        <div id="timer-controls">
          <div id="timer">{timer}</div>
          <div className="timer-buttons">
            <button onClick={cancelTimer}>Cancel</button>
            <button onClick={() => addTime(60)}>+1 min</button>
            <button onClick={() => addTime(300)}>+5 min</button>
          </div>
        </div>
      </div>
      
      {showAlert && (
        <div id="alert-overlay" className="alert-overlay">
          <div className="alert-popup">
            <h2 className="alert-title">Time's Up!</h2>
            <p className="alert-message">Your study session has ended. Take a break or start a new session.</p>
            <button className="alert-btn" onClick={dismissAlert}>Dismiss</button>
          </div>
        </div>
      )}
      
      <audio id="alarm-sound" ref={alarmSoundRef} loop>
        <source src="/alarm-301729.mp3" type="audio/mpeg" />
      </audio>
    </div>
  );
};

export default Chatbot;