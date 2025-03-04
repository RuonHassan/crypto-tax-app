import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import LandingPage from './components/LandingPage';
import AppAdapter from './adapters/AppAdapter';

// This component wraps the entire application with routing
const AppWrapper = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showLanding, setShowLanding] = useState(!user);

  // Initialize dark mode globally
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Update showLanding when auth state changes
  useEffect(() => {
    if (!loading) {
      setShowLanding(!user);
    }
  }, [user, loading]);

  const handleGetStarted = () => {
    setShowLanding(false);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-geist-background">
        <svg className="animate-spin h-8 w-8 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <Routes>
      {/* Landing/Home route */}
      <Route 
        path="/" 
        element={
          showLanding ? (
            <LandingPage onGetStarted={handleGetStarted} />
          ) : (
            user ? <Navigate to="/app" /> : <Navigate to="/login" />
          )
        } 
      />
      
      {/* Public route for login */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/app" /> : <LoginPage onSuccess={() => navigate('/app')} />} 
      />
      
      {/* Protected route for main app */}
      <Route 
        path="/app/*" 
        element={!user ? <Navigate to="/" /> : <AppAdapter />} 
      />
      
      {/* Redirect any other routes to root */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default AppWrapper; 