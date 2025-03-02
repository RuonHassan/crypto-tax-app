import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  
  const { signIn, signUp, resetPassword } = useAuth();

  const handleEmailChange = (e) => setEmail(e.target.value);
  const handlePasswordChange = (e) => setPassword(e.target.value);
  
  const handleToggleMode = () => {
    setIsRegistering(!isRegistering);
    setErrorMessage('');
    setSuccessMessage('');
    setResetPasswordMode(false);
  };
  
  const handleToggleResetPassword = () => {
    setResetPasswordMode(!resetPasswordMode);
    setErrorMessage('');
    setSuccessMessage('');
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (resetPasswordMode) {
        // Handle password reset
        const { success, error } = await resetPassword(email);
        if (success) {
          setSuccessMessage('Password reset email sent! Check your inbox.');
        } else {
          setErrorMessage(error || 'Failed to send reset email. Please try again.');
        }
      } else if (isRegistering) {
        // Handle sign up
        const { success, error } = await signUp(email, password);
        if (success) {
          setSuccessMessage('Registration successful! Check your email to confirm your account.');
        } else {
          setErrorMessage(error || 'Failed to register. Please try again.');
        }
      } else {
        // Handle sign in
        const { success, error } = await signIn(email, password);
        if (success) {
          // Redirect to app on successful login
          if (onSuccess) {
            onSuccess();
          }
        } else {
          setErrorMessage(error || 'Failed to login. Please check your credentials.');
        }
      }
    } catch (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-geist-accent-100 to-white dark:from-geist-background dark:to-geist-accent-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="text-3xl font-bold text-geist-accent-900 dark:text-geist-foreground flex items-center justify-center mb-6">
            <span className="text-4xl mr-2 bg-geist-success bg-opacity-90 text-white px-3 py-1 rounded-lg transform -rotate-3">Tax</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500">AI</span>
          </div>
          <h2 className="text-2xl font-extrabold text-geist-accent-900 dark:text-geist-foreground">
            {resetPasswordMode 
              ? 'Reset Password'
              : isRegistering 
                ? 'Create an account' 
                : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-sm text-geist-accent-600 dark:text-geist-accent-300">
            {resetPasswordMode 
              ? 'Enter your email and we\'ll send you a reset link'
              : isRegistering 
                ? 'Already have an account? ' 
                : 'Don\'t have an account? '}
            {!resetPasswordMode && (
              <button 
                onClick={handleToggleMode} 
                className="font-medium text-geist-success hover:text-geist-success-dark"
              >
                {isRegistering ? 'Sign in' : 'Create one'}
              </button>
            )}
          </p>
        </div>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}
        
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded-lg text-sm">
            {successMessage}
          </div>
        )}
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300">
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleEmailChange}
                className="input w-full"
                placeholder="you@example.com"
              />
            </div>
          </div>
          
          {!resetPasswordMode && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  className="input w-full"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}
          
          {!isRegistering && !resetPasswordMode && (
            <div className="flex items-center justify-end">
              <button 
                type="button" 
                onClick={handleToggleResetPassword}
                className="text-sm font-medium text-geist-success hover:text-geist-success-dark"
              >
                Forgot your password?
              </button>
            </div>
          )}
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-geist-success disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </div>
              ) : resetPasswordMode ? (
                'Send reset link'
              ) : isRegistering ? (
                'Create account'
              ) : (
                'Sign in'
              )}
            </button>
          </div>
          
          {resetPasswordMode && (
            <div className="text-center">
              <button 
                type="button" 
                onClick={handleToggleResetPassword}
                className="text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 hover:text-geist-accent-900 dark:hover:text-geist-foreground"
              >
                Back to login
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPage; 