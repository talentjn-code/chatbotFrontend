import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './context/ProtectedRoute';
import LoginPage from './pages/Auth/LoginPage';
import OAuthCallback from './pages/Auth/OAuthCallback';
import InterviewPrepPage from './pages/InterviewPrepPage';
import ResumeUploadPage from './pages/ResumeUploadPage';
import ChatbotPage from './pages/ChatbotPage';
import ChatHistoryPage from './pages/ChatHistoryPage';
import InterviewHistoryPage from './pages/InterviewHistoryPage';
import AdminPage from './pages/AdminPage';
import './App.css';
import GoogleCallbackRedirect from './pages/Auth/GoogleCallbackRedirect';
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "688031807895-8icknr63u5nifu4s0rrgvij4s2gglo15.apps.googleusercontent.com"; 

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/auth/google/callback" element={<GoogleCallbackRedirect />} />
            <Route
              path="/resume-upload/:jobId"
              element={
                <ProtectedRoute>
                  <ResumeUploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resume-upload/:type/:jobId"
              element={
                <ProtectedRoute>
                  <ResumeUploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chatbot/:jobId"
              element={
                <ProtectedRoute>
                  <ChatbotPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chatbot/:type/:jobId"
              element={
                <ProtectedRoute>
                  <ChatbotPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat-history/:chatId"
              element={
                <ProtectedRoute>
                  <ChatHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview-history/:id"
              element={
                <ProtectedRoute>
                  <InterviewHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <InterviewPrepPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
