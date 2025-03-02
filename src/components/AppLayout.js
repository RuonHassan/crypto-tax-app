import React from 'react';
import SidebarNav from './SidebarNav';
import { DarkModeToggle } from '../App';

const AppLayout = ({ 
  children, 
  toggleUserInfoPage, 
  currentPage = 'dashboard',
  userProfile,
  onNavigate
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-geist-accent-100 to-white dark:from-geist-background dark:to-geist-accent-800">
      <DarkModeToggle />
      
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar Navigation */}
        <SidebarNav 
          toggleUserInfoPage={toggleUserInfoPage} 
          currentPage={currentPage}
          userProfile={userProfile}
          onNavigate={onNavigate}
        />
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayout; 