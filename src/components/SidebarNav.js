import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const SidebarNav = ({ 
  toggleUserInfoPage, 
  currentPage = 'dashboard',
  userProfile = {},
  onNavigate
}) => {
  const { user, signOut } = useAuth();
  
  // Get user display name - use name if available, otherwise email
  const getDisplayName = () => {
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName} ${userProfile.lastName}`;
    } 
    else if (userProfile?.firstName) {
      return userProfile.firstName;
    }
    return user?.email || 'User';
  };
  
  // Handle navigation between different sections
  const handleNavigate = (page) => {
    if (typeof onNavigate === 'function') {
      onNavigate(page);
    }
  };
  
  return (
    <div className="h-screen w-64 bg-white dark:bg-geist-accent-900 shadow-lg flex flex-col border-r border-geist-accent-200 dark:border-geist-accent-700">
      {/* Logo and app name */}
      <div className="p-6 border-b border-geist-accent-200 dark:border-geist-accent-700">
        <div className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground flex items-center">
          <span className="text-3xl mr-2 bg-geist-success bg-opacity-90 text-white px-3 py-1 rounded-lg transform -rotate-3">Tax</span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500">AI</span>
        </div>
      </div>
      
      {/* User section */}
      <div className="p-6 border-b border-geist-accent-200 dark:border-geist-accent-700 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-geist-accent-300 dark:bg-geist-accent-700 flex items-center justify-center text-geist-accent-800 dark:text-geist-accent-100 font-semibold">
          {getDisplayName().charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 truncate">
          <p className="text-sm font-medium text-geist-accent-900 dark:text-geist-foreground truncate">
            {getDisplayName()}
          </p>
          <p className="text-xs text-geist-accent-500 dark:text-geist-accent-400 truncate">
            {user?.email}
          </p>
        </div>
      </div>
      
      {/* Navigation items */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <button 
              onClick={() => handleNavigate('dashboard')}
              className={`w-full text-left px-4 py-2 rounded-lg flex items-center space-x-3 ${
                currentPage === 'dashboard' 
                  ? 'bg-geist-accent-100 dark:bg-geist-accent-800 text-geist-accent-900 dark:text-geist-foreground' 
                  : 'text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Dashboard</span>
            </button>
          </li>
          <li>
            <button 
              onClick={toggleUserInfoPage}
              className={`w-full text-left px-4 py-2 rounded-lg flex items-center space-x-3 ${
                currentPage === 'account' 
                  ? 'bg-geist-accent-100 dark:bg-geist-accent-800 text-geist-accent-900 dark:text-geist-foreground' 
                  : 'text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>My Account</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => handleNavigate('reports')}
              className={`w-full text-left px-4 py-2 rounded-lg flex items-center space-x-3 ${
                currentPage === 'reports' 
                  ? 'bg-geist-accent-100 dark:bg-geist-accent-800 text-geist-accent-900 dark:text-geist-foreground' 
                  : 'text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Tax Reports</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => handleNavigate('wallets')}
              className={`w-full text-left px-4 py-2 rounded-lg flex items-center space-x-3 ${
                currentPage === 'wallets' 
                  ? 'bg-geist-accent-100 dark:bg-geist-accent-800 text-geist-accent-900 dark:text-geist-foreground' 
                  : 'text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>Wallets</span>
            </button>
          </li>
        </ul>
      </nav>
      
      {/* Logout button */}
      <div className="p-4 border-t border-geist-accent-200 dark:border-geist-accent-700">
        <button 
          onClick={signOut}
          className="w-full text-left px-4 py-2 rounded-lg flex items-center space-x-3 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-800"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default SidebarNav; 