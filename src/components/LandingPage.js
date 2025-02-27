import React from 'react';

const LandingPage = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-geist-accent-100 to-white dark:from-geist-background dark:to-geist-accent-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="py-6">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground flex items-center">
              <span className="text-3xl mr-2 bg-geist-success bg-opacity-90 text-white px-3 py-1 rounded-lg transform -rotate-3">Tax</span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500">AI</span>
            </div>
            <button
              onClick={onGetStarted}
              className="text-geist-accent-600 dark:text-geist-accent-300 hover:text-geist-accent-900 dark:hover:text-geist-foreground transition-colors font-medium"
            >
              Login
            </button>
          </div>
        </nav>

        <div className="py-16 md:py-24 text-center">
          <div className="max-w-4xl mx-auto relative">
            {/* Decorative elements */}
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-geist-success bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20"></div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500 bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20"></div>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6 relative animate-fade-in">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500 dark:from-blue-400 dark:to-green-300">
                Crypto Tax Simplified
              </span>
            </h1>
            <p className="text-xl text-geist-accent-600 dark:text-geist-accent-300 mb-12 leading-relaxed max-w-3xl mx-auto animate-fade-in-delay">
              Harness the power of AI to automatically track, calculate, and file your crypto taxes. 
              No more spreadsheets, no more confusion.
            </p>
            <button
              onClick={onGetStarted}
              className="px-8 py-4 bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 text-white rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transform transition-all duration-300 hover:-translate-y-1 animate-fade-in-delay-2"
            >
              Get Started Free
            </button>
          </div>

          <div className="mt-24 md:mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 hover:shadow-xl transition-all duration-300 group hover:-translate-y-2 animate-fade-in">
              <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-geist-accent-900 dark:text-geist-foreground">Smart Analysis</h3>
              <p className="text-geist-accent-600 dark:text-geist-accent-300 leading-relaxed">
                Our AI automatically categorizes and analyzes your crypto transactions across multiple chains and exchanges
              </p>
            </div>
            <div className="p-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 hover:shadow-xl transition-all duration-300 group hover:-translate-y-2 animate-fade-in-delay">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-geist-accent-900 dark:text-geist-foreground">Real-Time Calculations</h3>
              <p className="text-geist-accent-600 dark:text-geist-accent-300 leading-relaxed">
                Get instant tax estimates and insights as you trade, with support for DEX interactions and token transactions
              </p>
            </div>
            <div className="p-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 hover:shadow-xl transition-all duration-300 group hover:-translate-y-2 animate-fade-in-delay-2">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <span className="text-3xl">📄</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-geist-accent-900 dark:text-geist-foreground">Auto-Generated Forms</h3>
              <p className="text-geist-accent-600 dark:text-geist-accent-300 leading-relaxed">
                Download ready-to-file tax forms with one click, compatible with all major tax reporting software
              </p>
            </div>
          </div>
          
          {/* Add testimonial section */}
          <div className="mt-24 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-lg p-8 border border-geist-accent-200 dark:border-geist-accent-700 animate-fade-in-delay-3">
            <div className="max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold mb-6 text-geist-accent-900 dark:text-geist-foreground">What Our Users Say</h3>
              <div className="italic text-lg text-geist-accent-600 dark:text-geist-accent-300 mb-6">
                "TaxAI saved me hours of work and helped me identify transactions I would have missed. The token tracking is incredible!"
              </div>
              <div className="flex items-center justify-center">
                <div className="w-12 h-12 bg-geist-accent-200 dark:bg-geist-accent-700 rounded-full flex items-center justify-center mr-4">
                  <span className="text-geist-accent-900 dark:text-geist-accent-100 font-semibold">JS</span>
                </div>
                <div className="text-left">
                  <p className="font-medium text-geist-accent-900 dark:text-geist-foreground">Jamie Smith</p>
                  <p className="text-sm text-geist-accent-500">Solana DeFi Trader</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;