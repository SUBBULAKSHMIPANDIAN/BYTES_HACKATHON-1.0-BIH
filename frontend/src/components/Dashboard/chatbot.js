import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { FaMicrophone, FaPaperclip, FaPaperPlane, FaTrash, FaRegCopy } from 'react-icons/fa';
import { BsStopFill } from 'react-icons/bs';
import { IoMdRefresh } from 'react-icons/io';
import '../../styles/Chatbot.css';

const Chatbot = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [isNewChat, setIsNewChat] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Get user info from localStorage
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('username');

  // API configuration
  const API_BASE_URL = 'http://localhost:5000';
  const FLASK_BASE_URL = 'http://localhost:8000';

  // Load a specific chat session
  const loadChatSession = useCallback(async (sessionId) => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/chats/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentSession(data);
      setMessages(data.messages);
      setIsNewChat(false);
      setError(null);
    } catch (err) {
      console.error('Failed to load chat session:', err);
      setError('Failed to load chat session');
    }
  }, [token]);

  // Create a new chat session
  const createNewSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.post(`${API_BASE_URL}/api/chats`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentSession(data);
      setMessages([]);
      setIsNewChat(true);
      setChatSessions(prev => [data, ...prev]);
      setError(null);
      return data;
    } catch (err) {
      console.error('Failed to create new chat session:', err);
      setError('Failed to create new chat');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [token]);
  const fetchChatSessions = useCallback(async () => {
    try {
      console.log('Attempting to fetch chats with token:', token); // Debug
      
      const { data } = await axios.get(`${API_BASE_URL}/api/chats`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000 // Add timeout
      });
      
      return data;
    } catch (err) {
      console.error('API Error Details:', {
        status: err.response?.status,
        data: err.response?.data,
        config: err.config
      });
      
      if (err.response?.status === 403) {
        // Clear invalid token immediately
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        
        // Show user-friendly message
        setError('Session expired. Redirecting to login...');
        
        // Redirect after delay
        /* setTimeout(() => window.location.href = '/login', 1000); */
      }
      
      return []; // Return empty array to prevent crashes
    }
  }, [token, API_BASE_URL]);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        await fetchChatSessions();
      } catch (err) {
        console.error('Initialization error:', err);
        // Error is already handled in fetchChatSessions
      } finally {
        setIsInitializing(false);
      }
    };
    
    // Check if token exists before trying to initialize
    if (token) {
      initializeChat();
    } else {
      window.location.href = '/login';
    }
  }, [fetchChatSessions, token]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Delete a chat session
  const deleteChatSession = async (sessionId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/chats/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (currentSession?.sessionId === sessionId) {
        await createNewSession();
      }
      
      fetchChatSessions();
    } catch (err) {
      console.error('Failed to delete chat session:', err);
      setError('Failed to delete chat session');
    }
  };

  // Send a message to the chatbot
  const sendMessage = async () => {
    if ((!input.trim() && !selectedFile) || !currentSession) return;
    
    const userMessage = {
      content: input,
      sender: 'user',
      timestamp: new Date(),
      metadata: selectedFile ? {
        fileType: selectedFile.type,
        fileUrl: selectedFile.url
      } : null
    };
    
    // Optimistically update UI
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);
    
    try {
      // Save user message to backend
      await axios.post(
        `${API_BASE_URL}/api/chats/${currentSession.sessionId}/messages`,
        userMessage,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Get response from Flask
      const { data } = await axios.post(
        `${FLASK_BASE_URL}/api/chat`,
        { query: userMessage.content },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const botMessage = {
        content: data?.response || "I didn't understand that.",
        sender: 'bot',
        timestamp: new Date()
      };
      
      // Update UI with bot response
      setMessages(prev => [...prev, botMessage]);
      
      // Save bot response to backend
      await axios.post(
        `${API_BASE_URL}/api/chats/${currentSession.sessionId}/messages`,
        botMessage,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
      
      const errorMessage = {
        content: "Sorry, I'm having trouble responding. Please try again.",
        sender: 'bot',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }
    
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const { data } = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setSelectedFile({
        name: file.name,
        type: file.type,
        url: data.fileUrl,
        originalFile: file
      });
      setError(null);
    } catch (err) {
      console.error('File upload failed:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Audio recording functions
  const startRecording = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data);
        };
        
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processAudioRecording(audioBlob);
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
      })
      .catch(err => {
        console.error('Error accessing microphone:', err);
        setError('Microphone access denied. Please allow microphone access.');
      });
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const processAudioRecording = async (audioBlob) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const { data } = await axios.post(`${API_BASE_URL}/api/chat/transcribe`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setInput(data.transcribed || '');
      setError(null);
    } catch (err) {
      console.error('Failed to process audio:', err);
      setError('Failed to process audio recording.');
    } finally {
      setIsLoading(false);
    }
  };

  // UI helper functions
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .catch(err => {
        console.error('Failed to copy text:', err);
        setError('Failed to copy text');
      });
  };

  const regenerateResponse = async () => {
    if (messages.length === 0 || messages[messages.length - 1].sender !== 'bot') return;
    
    setIsLoading(true);
    
    try {
      const updatedMessages = messages.slice(0, -1);
      setMessages(updatedMessages);
      
      const lastUserMessage = updatedMessages.reverse().find(m => m.sender === 'user');
      
      if (lastUserMessage) {
        setInput(lastUserMessage.content);
        if (lastUserMessage.metadata) {
          setSelectedFile({
            name: lastUserMessage.metadata.fileUrl.split('/').pop(),
            type: lastUserMessage.metadata.fileType,
            url: lastUserMessage.metadata.fileUrl
          });
        }
        
        setTimeout(sendMessage, 300);
      }
    } catch (err) {
      console.error('Failed to regenerate response:', err);
      setError('Failed to regenerate response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isInitializing) {
    return <div className="loading-screen">Loading your chats...</div>;
  }

  return (
    <div className="chatbot-container">
      {/* Sidebar */}
      <div className={`chatbot-sidebar ${showSidebar ? 'active' : ''}`}>
        <div className="sidebar-header">
          <button 
            className="mobile-menu-btn"
            onClick={() => setShowSidebar(!showSidebar)}
            aria-label="Toggle sidebar"
          >
            {showSidebar ? '✕' : '☰'}
          </button>
          <h3>Chat Sessions</h3>
          <button 
            className="new-chat-btn"
            onClick={createNewSession}
            disabled={isLoading}
          >
            + New Chat
          </button>
        </div>
        
        <div className="chat-sessions">
          {chatSessions.map(session => (
            <div 
              key={session.sessionId}
              className={`session-item ${currentSession?.sessionId === session.sessionId ? 'active' : ''}`}
              onClick={() => loadChatSession(session.sessionId)}
            >
              <div className="session-preview">
                {session.title || session.messages[0]?.content.substring(0, 50) || 'New Chat'}
              </div>
              <div className="session-meta">
                <span>{new Date(session.updatedAt).toLocaleString()}</span>
                <button 
                  className="delete-session-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChatSession(session.sessionId);
                  }}
                  aria-label="Delete chat session"
                  disabled={isLoading}
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="user-info">
          <div className="username">{user || 'User'}</div>
          <button 
            className="logout-btn"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('username');
              window.location.reload();
            }}
          >
            Logout
          </button>
        </div>
      </div>
      
      {/* Main chat area */}
      <div className="chatbot-main">
        {error && <div className="error-message">{error}</div>}
        
        {isNewChat && messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Welcome to Math Study Assistant</h2>
            <p>How can I help you with your math studies today?</p>
            <div className="suggestions">
              <button onClick={() => setInput('Explain the Pythagorean theorem')}>
                Explain the Pythagorean theorem
              </button>
              <button onClick={() => setInput('Help me solve 2x + 5 = 15')}>
                Help me solve 2x + 5 = 15
              </button>
              <button onClick={() => setInput('Create a study schedule for calculus')}>
                Create a study schedule
              </button>
            </div>
          </div>
        ) : (
          <div className="messages-container">
            {messages.map((message, index) => (
              <div 
                key={index}
                className={`message ${message.sender}`}
              >
                <div className="message-content">
                  {message.metadata?.fileType?.startsWith('image/') && (
                    <div className="file-preview">
                      <img 
                        src={`${API_BASE_URL}${message.metadata.fileUrl}`} 
                        alt="Uploaded content" 
                      />
                    </div>
                  )}
                  
                  {message.metadata?.fileType && !message.metadata.fileType.startsWith('image/') && (
                    <div className="file-preview">
                      <a 
                        href={`${API_BASE_URL}${message.metadata.fileUrl}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        📄 {message.metadata.fileUrl.split('/').pop()}
                      </a>
                    </div>
                  )}
                  
                  <div className="message-text">
                    {message.content.split('\n').map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                  
                  <div className="message-actions">
                    <span className="timestamp">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(message.content)}
                      aria-label="Copy message"
                    >
                      <FaRegCopy />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message bot">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Input area */}
        <div className="input-area">
          {selectedFile && (
            <div className="file-preview-input">
              <span>{selectedFile.name}</span>
              <button 
                onClick={() => setSelectedFile(null)}
                aria-label="Remove file"
                disabled={isLoading}
              >
                ×
              </button>
            </div>
          )}
          
          <div className="input-container">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message here..."
              disabled={isLoading}
              aria-label="Message input"
            />
            
            <div className="input-buttons">
              <button 
                className={`record-btn ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? <BsStopFill /> : <FaMicrophone />}
              </button>
              
              <button 
                className="attach-btn"
                onClick={() => fileInputRef.current.click()}
                disabled={isLoading}
                aria-label="Attach file"
              >
                <FaPaperclip />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  style={{ display: 'none' }}
                />
              </button>
              
              {messages.length > 0 && (
                <button 
                  className="regenerate-btn"
                  onClick={regenerateResponse}
                  disabled={isLoading}
                  aria-label="Regenerate response"
                >
                  <IoMdRefresh />
                </button>
              )}
              
              <button 
                className="send-btn"
                onClick={sendMessage}
                disabled={isLoading || (!input.trim() && !selectedFile)}
                aria-label="Send message"
              >
                <FaPaperPlane />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;