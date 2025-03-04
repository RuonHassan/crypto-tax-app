import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from './LoginPage';
import ProtectedRoute from './ProtectedRoute';
import LandingPage from './LandingPage';

// This component will handle routing for the application
// Regular flows will use the existing components, but wrapped with authentication
const AppRoutes = ({ 
  // Props from App.js related to application state and functions
  formData,
  setFormData,
  handleInputChange,
  handleWalletNameChange,
  analyzeTaxes,
  loading,
  loadingProgress,
  results,
  transactions,
  clearTransactionCache,
  clearAllTransactionCache,
  resetAllAppData,
  walletProcessingStatus,
  queueWalletForProcessing,
  // Current app state
  showLandingPage,
  showUserInfoPage,
  appComponent, // The main app component to render after authentication
  startOnboarding, // Function to start onboarding process
  toggleUserInfoPage
}) => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={
          user ? 
            <Navigate to="/" /> : 
            <LoginPage onGetStarted={startOnboarding} />
        } 
      />

      {/* Protected routes */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            {showLandingPage ? (
              <LandingPage onGetStarted={startOnboarding} />
            ) : (
              // Render the main application component with all props
              appComponent
            )}
          </ProtectedRoute>
        } 
      />

      {/* More routes can be added here as needed */}
      
      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default AppRoutes; 