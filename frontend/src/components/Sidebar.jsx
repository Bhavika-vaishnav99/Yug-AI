import React from 'react';
import { Plus, MessageSquare, Trash2, Bot, Sparkles, LogOut } from 'lucide-react';

const Sidebar = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  isDbConnected,
  user,
  onLogout
}) => {
  // Helper to compute profile initials (e.g. "Bhavika Sharma" -> "BS")
  const getInitials = (name) => {
    if (!name) return 'AI';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <aside className="sidebar glass-effect">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon">
            <Bot size={22} className="logo-bot-svg" />
          </div>
          <div>
            <h1 className="logo-text">YUG AI</h1>
            <p className="logo-subtext">MERN Stack ChatBot </p>
          </div>
        </div>
      </div>

      <button className="new-chat-btn" onClick={onCreateSession}>
        <Plus size={18} />
        <span>New Chat</span>
      </button>

      <div className="sessions-list-container">
        <h2 className="sessions-title">Recent Chats</h2>
        <div className="sessions-list">
          {sessions.length === 0 ? (
            <div className="sessions-empty">
              <Sparkles size={16} className="sparkle-icon" />
              <span>No chat history yet</span>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session._id === activeSessionId;
              return (
                <div
                  key={session._id}
                  className={`session-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectSession(session._id)}
                >
                  <MessageSquare size={16} className="session-icon" />
                  <span className="session-text" title={session.title}>
                    {session.title}
                  </span>
                  <button
                    className="delete-session-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session._id);
                    }}
                    title="Delete Chat"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-profile">
            <div className="profile-avatar">
              {getInitials(user.name)}
            </div>
            <div className="profile-info">
              <p className="profile-name" title={user.name}>{user.name}</p>
              <p className="profile-email" title={user.email}>{user.email}</p>
            </div>
            <button className="logout-btn" onClick={onLogout} title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        )}

        <div className="connection-status">
          <span className={`status-dot ${isDbConnected ? 'online' : 'offline'}`}></span>
          <span>{isDbConnected ? 'MongoDB Connected' : 'MongoDB Disconnected'}</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
