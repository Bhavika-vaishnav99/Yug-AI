import React from 'react';

const TypingIndicator = () => {
  return (
    <div className="typing-indicator-container">
      <div className="thinking-bubble-pill">
        <div className="typing-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
        <span className="typing-text">YUG is thinking...</span>
      </div>
    </div>
  );
};

export default TypingIndicator;
