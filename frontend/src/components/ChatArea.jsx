import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Terminal, Copy, Check, MessageSquareCode, FileText, BookOpen, Menu } from 'lucide-react';
import TypingIndicator from './TypingIndicator';

const ChatArea = ({ session, onSendMessage, isLoading, onToggleSidebar }) => {
  const [input, setInput] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [ragStatus, setRagStatus] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch('/api/rag/status')
      .then(res => res.json())
      .then(data => setRagStatus(data))
      .catch(err => console.error('Failed to fetch RAG status:', err));
  }, []);

  const suggestions = [
    { text: 'What FAQs are covered in the documentation?', category: 'RAG FAQ' },
    { text: "How's the weather today?", category: 'Weather' },
    { text: 'Write a Node.js Express route to upload files', category: 'Backend' },
    { text: 'Design a glassmorphic card component using Vanilla CSS', category: 'Design' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  const handleCopyCode = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Safe and clean parser for formatting markdown, bullet lists, and code blocks
  const formatMessageText = (text) => {
    if (!text) return null;

    // Split text by code blocks (```code```)
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      // Check if it's a code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        // Extract language if specified, otherwise default to bash
        let language = 'javascript';
        let codeContent = lines.join('\n');

        if (lines[0] && !lines[0].includes(' ') && lines[0].length < 15) {
          language = lines[0].toLowerCase();
          codeContent = lines.slice(1).join('\n');
        }

        return (
          <div key={index} className="code-block-container">
            <div className="code-block-header">
              <span className="code-block-lang">
                <Terminal size={14} />
                {language}
              </span>
              <button
                className="copy-btn"
                onClick={() => handleCopyCode(codeContent, index)}
                title="Copy code"
              >
                {copiedIndex === index ? (
                  <>
                    <Check size={14} className="copy-success-icon" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre>
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

      // Format inline elements: code (`code`), bold (**bold**) and line breaks
      const formattedLines = part.split('\n').map((line, lineIdx) => {
        // Handle list items
        if (line.startsWith('* ') || line.startsWith('- ')) {
          return (
            <li key={lineIdx} className="bullet-item">
              {parseInlineMarkdown(line.substring(2))}
            </li>
          );
        }

        // Handle numeric list items
        const numMatch = line.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          return (
            <li key={lineIdx} className="number-item" style={{ listStyleType: 'decimal', marginLeft: '20px' }}>
              {parseInlineMarkdown(numMatch[2])}
            </li>
          );
        }

        // Handle titles/headers
        if (line.startsWith('### ')) {
          return <h4 key={lineIdx} className="chat-h4">{parseInlineMarkdown(line.substring(4))}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={lineIdx} className="chat-h3">{parseInlineMarkdown(line.substring(3))}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={lineIdx} className="chat-h2">{parseInlineMarkdown(line.substring(2))}</h2>;
        }

        // Default paragraph line
        return line.trim() === '' ? (
          <div key={lineIdx} className="empty-line" />
        ) : (
          <p key={lineIdx} className="chat-p">
            {parseInlineMarkdown(line)}
          </p>
        );
      });

      return <div key={index} className="text-block-wrapper">{formattedLines}</div>;
    });
  };

  // Parse inline structures like **bold** and `code`
  const parseInlineMarkdown = (text) => {
    // Escape standard regex characters, but keep formatting
    let tokens = [text];

    // Parse inline code: `code`
    tokens = tokens.flatMap(token => {
      if (typeof token !== 'string') return token;
      const parts = token.split(/(`[^`]+`)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={idx} className="inline-code">{part.slice(1, -1)}</code>;
        }
        return part;
      });
    });

    // Parse bold text: **bold**
    tokens = tokens.flatMap(token => {
      if (typeof token !== 'string') return token;
      const parts = token.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} className="bold-text">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    });

    return tokens;
  };

  return (
    <div className="chat-area">
      {!session ? (
        <div className="chat-welcome">
          <button className="mobile-menu-btn welcome-menu-btn" onClick={onToggleSidebar} title="Recent Chats">
            <Menu size={20} />
            <span>Recent Chats</span>
          </button>
          <div className="welcome-glow"></div>
          <div className="welcome-inner">
            <MessageSquareCode size={48} className="welcome-icon text-gradient" />
            <h2 className="welcome-title text-gradient">Create or Select a conversation</h2>
            <p className="welcome-subtitle">Start a session from the sidebar to chat with YUG </p>
          </div>
        </div>
      ) : (
        <>
          <div className="chat-header glass-effect">
            <button className="mobile-menu-btn" onClick={onToggleSidebar} title="Recent Chats">
              <Menu size={20} />
            </button>
            <div className="header-info">
              <h2 className="header-title">{session.title}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="header-badge">Gemini-2.5-Flash</span>
                {ragStatus?.isIndexed && (
                  <span className="header-badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} />
                    RAG Active ({ragStatus.documentName})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="messages-container">
            {session.messages && session.messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-header">
                  <div className="welcome-stars">
                    <Sparkles size={24} className="star-icon glow" />
                  </div>
                  <h3>What would you like to build today?</h3>
                  <p>Ask anything. ChatBot will process your chat history and deliver solutions.</p>
                </div>

                <div className="suggestions-grid">
                  {suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="suggestion-card glass-effect"
                      onClick={() => setInput(s.text)}
                    >
                      <span className="suggestion-category">{s.category}</span>
                      <p className="suggestion-text">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {session.messages && session.messages.map((msg, idx) => (
              <div key={msg._id || idx} className={`message-row ${msg.sender}`}>
                <div className={`message-bubble ${msg.sender} glass-effect`}>
                  <div className="message-content">
                    {formatMessageText(msg.text)}
                  </div>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message-row model">
                <div className="message-bubble model glass-effect">
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-container glass-effect">
            <form onSubmit={handleSubmit} className="input-form">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Shift + Enter for new line)"
                className="chat-textarea"
                disabled={isLoading}
                rows={1}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`send-btn ${input.trim() ? 'active' : ''}`}
              >
                <Send size={18} />
              </button>
            </form>
            <div className="input-footer">
              <span>Press Enter to send. Powered by MongoDB session history storage.</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatArea;
