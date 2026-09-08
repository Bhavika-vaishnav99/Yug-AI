import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import Auth from './components/Auth';
import { AlertCircle, RefreshCw } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch all sessions on mount / token change
  useEffect(() => {
    if (token) {
      fetchSessions(true);
    } else {
      setIsInitializing(false);
    }
  }, [token]);

  // Fetch full details whenever the active session ID changes
  useEffect(() => {
    if (activeSessionId && token) {
      fetchSessionDetails(activeSessionId);
    } else {
      setActiveSession(null);
    }
  }, [activeSessionId, token]);

  const fetchSessions = async (shouldAutoSelect = false) => {
    try {
      setErrorMessage(null);
      const res = await fetch(`${API_BASE_URL}/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 503) {
        setIsDbConnected(false);
        const data = await res.json();
        throw new Error(data.error);
      }

      if (res.status === 401) {
        handleLogout();
        throw new Error('Session expired. Please log in again.');
      }

      if (!res.ok) throw new Error('Failed to retrieve chat sessions.');
      const data = await res.json();
      setSessions(data);
      setIsDbConnected(true);

      if (shouldAutoSelect && data.length > 0) {
        setActiveSessionId(data[0]._id);
      }
    } catch (err) {
      console.error(err);
      if (err.message.includes('MongoDB is disconnected')) {
        setErrorMessage(err.message);
        setIsDbConnected(false);
      } else {
        setErrorMessage(err.message || 'Could not connect to the backend server. Make sure your server is running on port 5000.');
        setIsDbConnected(false);
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const fetchSessionDetails = async (id) => {
    try {
      setErrorMessage(null);
      const res = await fetch(`${API_BASE_URL}/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 503) {
        setIsDbConnected(false);
        const data = await res.json();
        throw new Error(data.error);
      }

      if (res.status === 401) {
        handleLogout();
        throw new Error('Session expired. Please log in again.');
      }

      if (!res.ok) throw new Error('Failed to retrieve session message history.');
      const data = await res.json();
      setActiveSession(data);
      setIsDbConnected(true);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Error fetching chat history. Please try again.');
    }
  };

  const handleCreateSession = async () => {
    try {
      setErrorMessage(null);
      const res = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'New Chat' })
      });

      if (res.status === 503) {
        setIsDbConnected(false);
        const data = await res.json();
        throw new Error(data.error);
      }

      if (res.status === 401) {
        handleLogout();
        throw new Error('Session expired. Please log in again.');
      }

      if (!res.ok) throw new Error('Failed to create new session.');
      const newSession = await res.json();

      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession._id);
      setIsDbConnected(true);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Could not create new session. Check backend connectivity.');
    }
  };

  const handleDeleteSession = async (id) => {
    try {
      setErrorMessage(null);
      const res = await fetch(`${API_BASE_URL}/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 503) {
        setIsDbConnected(false);
        const data = await res.json();
        throw new Error(data.error);
      }

      if (res.status === 401) {
        handleLogout();
        throw new Error('Session expired. Please log in again.');
      }

      if (!res.ok) throw new Error('Failed to delete session.');

      const updatedSessions = sessions.filter((s) => s._id !== id);
      setSessions(updatedSessions);
      setIsDbConnected(true);

      // If we deleted the currently active session, switch to another or clear
      if (activeSessionId === id) {
        if (updatedSessions.length > 0) {
          setActiveSessionId(updatedSessions[0]._id);
        } else {
          setActiveSessionId(null);
          setActiveSession(null);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Could not delete session. Try again.');
    }
  };

  const handleSendMessage = async (messageText) => {
    if (!activeSessionId) return;

    // Optimistically update the UI to show the user's message immediately
    const optimisticMessage = {
      _id: Date.now().toString(), // temporary ID
      sender: 'user',
      text: messageText,
      timestamp: new Date().toISOString()
    };

    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...prev.messages, optimisticMessage]
      };
    });

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${activeSessionId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: messageText })
      });

      if (res.status === 503) {
        setIsDbConnected(false);
        const data = await res.json();
        throw new Error(data.error);
      }

      if (res.status === 401) {
        handleLogout();
        throw new Error('Session expired. Please log in again.');
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to get Gemini response.');
      }

      const updatedSession = await res.json();
      setIsDbConnected(true);

      // Sync the full state returned by the database (includes database message IDs and proper timestamps)
      setActiveSession(updatedSession);

      // Refresh the session list titles since the title might have been updated from 'New Chat'
      fetchSessions(false);
    } catch (err) {
      console.error(err);
      const friendlyErr = err.message.includes('quota') || err.message.includes('429')
        ? 'Gemini API rate limit exceeded. Please wait a few seconds and try again.'
        : err.message || 'Error communicating with Gemini API.';

      setErrorMessage(friendlyErr);

      // Preserve user message and append helpful error bubble so text doesn't disappear
      setActiveSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              _id: 'err-' + Date.now(),
              sender: 'model',
              text: `⚠️ **Request Notice**: ${friendlyErr}`,
              timestamp: new Date().toISOString()
            }
          ]
        };
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setSessions([]);
    setActiveSessionId(null);
    setActiveSession(null);
  };

  if (!token) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <>
      {errorMessage && (
        <div className="error-toast-container">
          <div className="error-toast glass-effect animate-toast">
            <AlertCircle size={18} className="error-icon" />
            <div className="error-toast-content">
              <span className="error-toast-text">{errorMessage}</span>
            </div>
            <button className="error-retry-btn" onClick={() => fetchSessions(true)}>
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {isInitializing ? (
        <div className="app-loader">
          <div className="loader-spinner"></div>
          <p>Connecting to MERN server...</p>
        </div>
      ) : (
        <>
          <Sidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={(id) => {
              setActiveSessionId(id);
              setIsSidebarOpen(false);
            }}
            onCreateSession={() => {
              handleCreateSession();
              setIsSidebarOpen(false);
            }}
            onDeleteSession={handleDeleteSession}
            isDbConnected={isDbConnected}
            user={user}
            onLogout={handleLogout}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
          <ChatArea
            session={activeSession}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          />
        </>
      )}
    </>
  );
}

export default App;
