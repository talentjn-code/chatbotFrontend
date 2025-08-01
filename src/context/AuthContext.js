// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [jwt, setJwt] = useState(() => localStorage.getItem('jwt'));

  const login = (userData, jwtToken) => {
    setUser(userData);
    setJwt(jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
    if (jwtToken) localStorage.setItem('jwt', jwtToken);
  };

  const logout = () => {
    setUser(null);
    setJwt(null);
    // Clear all localStorage data to prevent cross-user contamination
    localStorage.clear();
  };

  const checkBackendConnectivity = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${BACKEND_URL}/`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    const verifyBackendAndAuth = async () => {
      const currentUser = localStorage.getItem('user');
      const currentJwt = localStorage.getItem('jwt');
      
      if (currentUser && currentJwt) {
        const isBackendUp = await checkBackendConnectivity();
        if (!isBackendUp) {
          logout();
        }
      }
    };

    verifyBackendAndAuth();
    
    // Increase interval to 5 minutes to reduce aggressive checking
    const interval = setInterval(() => {
      verifyBackendAndAuth();
    }, 300000); // 5 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <AuthContext.Provider value={{ user, jwt, login, logout, checkBackendConnectivity }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
