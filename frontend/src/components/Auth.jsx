import React, { useState } from 'react';
import { Bot, KeyRound, Mail, User, Sparkles, AlertCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const Auth = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    // Simple checks
    if (!email.trim() || !password.trim() || (!isLogin && !name.trim())) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin
        ? { email: email.trim(), password }
        : { name: name.trim(), email: email.trim(), password };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please check your inputs.');
      }

      // Success
      onAuthSuccess(data.token, data.user);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    setIsLogin(!isLogin);
    setErrorMessage(null);
    setName('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="auth-container">
      <div className="auth-glow"></div>

      <div className="auth-card glass-effect">
        <div className="auth-header-logo">
          <div className="auth-logo-icon">
            <Bot size={28} className="logo-bot-svg" />
          </div>
          <h2 className="auth-title text-gradient">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="auth-subtitle">
            {isLogin
              ? 'Sign in to access your saved chat sessions'
              : 'Register to start chatting with YUG AI'}
          </p>
        </div>

        {errorMessage && (
          <div className="auth-error-alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="auth-input-group">
              <label className="auth-label">Full Name</label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-input-icon" />
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input"
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="auth-input-group">
            <label className="auth-label">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <KeyRound size={16} className="auth-input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="auth-loader"></span>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-toggle-footer">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              className="auth-toggle-link"
              onClick={handleToggle}
              disabled={loading}
            >
              {isLogin ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
