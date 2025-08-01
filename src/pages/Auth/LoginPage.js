// src/pages/Auth/LoginPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import GoogleOAuthButton from '../../components/GoogleOAuthButton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    // Check for error in location state
    if (location.state?.error) {
      setError(location.state.error);
    }
  }, [location]);

  const handleSuccess = async (data) => {
    setLoading(true);
    setError('');
    
    try {
      if (data.user && data.token) {
        login(data.user, data.token);
        navigate('/interview-prep', { replace: true });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleError = () => {
    setError('Google login failed. Please try again.');
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setEmailLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/auth/email-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Email login failed');
      }
      
      if (data.user && data.token) {
        login(data.user, data.token);
        navigate('/interview-prep', { replace: true });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err.message || 'Email login failed. Please try again.');
      setEmailLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h1 style={{ 
          textAlign: 'center', 
          marginBottom: '30px',
          color: '#333'
        }}>
          Welcome to Interview AI
        </h1>
        
        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
        
        {loading || emailLoading ? (
          <div style={{ textAlign: 'center' }}>
            <p>Authenticating...</p>
          </div>
        ) : (
          <div>
            {/* Email Login Form */}
            <form onSubmit={handleEmailLogin} style={{ marginBottom: '30px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '5px', 
                  fontWeight: '500',
                  color: '#333'
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={emailLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: emailLoading ? 'not-allowed' : 'pointer',
                  opacity: emailLoading ? 0.7 : 1
                }}
              >
                {emailLoading ? 'Signing in...' : 'Sign in with Email'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ 
              textAlign: 'center', 
              margin: '20px 0',
              position: 'relative'
            }}>
              <span style={{
                backgroundColor: 'white',
                padding: '0 15px',
                color: '#666',
                fontSize: '14px'
              }}>
                OR
              </span>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: '#ddd',
                zIndex: -1
              }}></div>
            </div>

            {/* Google Login */}
            <GoogleOAuthButton 
              onSuccess={handleSuccess} 
              onError={handleError}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
