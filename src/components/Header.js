// src/components/Header.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Header.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const Header = ({ logo, backgroundColor }) => {
  const { user, jwt, logout } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!jwt) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/admin/stats`, {
          headers: {
            'Authorization': `Bearer ${jwt}`,
          },
        });
        
        if (response.ok) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [jwt]);

  const handleLogout = async () => {
    try {
      // Always clear local storage first
      logout();
      
      // Try to call logout endpoint (but don't block on it)
      const token = localStorage.getItem('jwt');
      if (token) {
        fetch(`${BACKEND_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).catch(() => {
          // Ignore any errors - user is already logged out locally
        });
      }
      
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Ensure we still clear storage and redirect even if there's an error
      logout();
      navigate('/login');
    }
  };

  return (
    <header className="header" style={{ backgroundColor }}>
      <div className="header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <span className="header-logo-text">{logo.text}</span>
      </div>
      
      <div className="header-nav">
        {isAdmin && user && (
          <button 
            className="manage-users-btn" 
            onClick={() => navigate('/admin')}
            title="Admin Panel - Manage Users"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            ManageUsers
          </button>
        )}
      </div>

      <div className="header-user">
        {user && (
          <>
            <span className="user-email">{user.email || user.name}</span>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
