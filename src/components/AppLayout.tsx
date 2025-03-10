import React, { useState } from 'react';
import SidebarNav from './SidebarNav';
import Logo from './Logo';
import { DarkModeToggle } from '../App';
import { AppLayoutProps } from '../types';

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  toggleUserInfoPage, 
  currentPage = 'dashboard',
  userProfile,
  onNavigate
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-geist-accent-100 to-white dark:from-geist-background dark:to-geist-accent-800">
      <DarkModeToggle />
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-geist-accent-800 border-b border-geist-accent-200 dark:border-geist-accent-700 z-50">
        <div className="flex items-center justify-between px-4 h-full">
          <Logo size="small" />
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-lg hover:bg-geist-accent-100 dark:hover:bg-geist-accent-700"
          >
            <svg
              className="w-6 h-6 text-geist-accent-900 dark:text-geist-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${
        isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`} onClick={toggleMobileMenu}>
        <div 
          className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-geist-accent-800 transform transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <div className="h-16 border-b border-geist-accent-200 dark:border-geist-accent-700 flex items-center px-6">
            <Logo size="small" />
          </div>
          <SidebarNav
            toggleUserInfoPage={toggleUserInfoPage}
            currentPage={currentPage}
            userProfile={userProfile}
            onNavigate={(page: string) => {
              onNavigate(page);
              setIsMobileMenuOpen(false);
            }}
          />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white dark:bg-geist-accent-800 border-r border-geist-accent-200 dark:border-geist-accent-700">
          <div className="p-6 border-b border-geist-accent-200 dark:border-geist-accent-700">
            <Logo size="default" />
          </div>
          <SidebarNav
            toggleUserInfoPage={toggleUserInfoPage}
            currentPage={currentPage}
            userProfile={userProfile}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64 pt-16 lg:pt-0">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayout; 