import React from 'react';

const TypingIndicator = () => {
  return (
    <div className="typing-indicator-container">
      <div className="typing-bubble">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
      <span className="typing-text">Gemini is thinking...</span>
    </div>
  );
};

export default TypingIndicator;
