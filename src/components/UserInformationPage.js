import React, { useState } from 'react';
import { formatCurrency } from '../utils/formatters';
import { addUserWallet } from '../services/databaseService';

const UserInformationPage = ({ 
  formData, 
  setFormData, 
  handleInputChange, 
  handleWalletNameChange, 
  analyzeTaxes, 
  loading, 
  loadingProgress, 
  results, 
  clearTransactionCache, 
  clearAllTransactionCache,
  goBackToDashboard,
  walletProcessingStatus,
  queueWalletForProcessing,
  user,
  saveWalletAndPull: externalSaveWalletAndPull
}) => {
  const [walletSaving, setWalletSaving] = useState(false);
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [activeWalletIndex, setActiveWalletIndex] = useState(null);
  
  // Function to add a wallet
  const addWallet = () => {
    setFormData(prev => ({
      ...prev,
      walletAddresses: [...prev.walletAddresses, ''],
      walletNames: [...prev.walletNames, `Wallet ${prev.walletAddresses.length + 1}`]
    }));
  };
  
  // Function to remove a wallet
  const removeWallet = (index) => {
    const updatedAddresses = formData.walletAddresses.filter((_, i) => i !== index);
    const updatedNames = formData.walletNames.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      walletAddresses: updatedAddresses,
      walletNames: updatedNames
    }));
  };
  
  // Function to update a wallet address
  const updateWalletAddress = (index, value) => {
    const updatedAddresses = [...formData.walletAddresses];
    updatedAddresses[index] = value;
    setFormData(prev => ({
      ...prev,
      walletAddresses: updatedAddresses
    }));
  };
  
  // Function to save wallet and pull transactions
  const saveWalletAndPull = async (index) => {
    setActiveWalletIndex(index);
    setWalletSaving(true);
    
    // Here we would normally do validation
    const walletAddress = formData.walletAddresses[index];
    const walletName = formData.walletNames[index];
    
    if (walletAddress.length >= 32) {
      try {
        // If user is logged in, save wallet to Supabase
        if (user) {
          const { success, data: walletData } = await addUserWallet(user.id, {
            address: walletAddress,
            name: walletName || `Wallet ${index + 1}`
          });
          
          if (!success) {
            console.error('Failed to save wallet to database');
          }
        }
        
        // Check if we need to queue this wallet
        if (walletProcessingStatus && walletProcessingStatus.currentWallet) {
          // A wallet is currently being processed, queue this one
          queueWalletForProcessing(walletAddress);
        } else {
          // No wallet is being processed, process this one immediately
          await analyzeTaxes(walletAddress);
        }
      } catch (error) {
        console.error('Error analyzing wallet:', error);
      }
    } else {
      alert('Please enter a valid Solana wallet address (minimum 32 characters)');
    }
    
    setWalletSaving(false);
    setActiveWalletIndex(null);
  };
  
  // Function to save income data
  const saveIncomeData = () => {
    setIncomeSaving(true);
    
    // Simple timeout to simulate saving
    setTimeout(() => {
      setIncomeSaving(false);
      alert('Income data saved successfully!');
    }, 500);
  };
  
  // Function to save personal data
  const savePersonalData = () => {
    setPersonalSaving(true);
    
    // Simple timeout to simulate saving
    setTimeout(() => {
      setPersonalSaving(false);
      alert('Personal information saved successfully!');
    }, 500);
  };
  
  return (
    <div className="py-12 text-center relative">
      {/* Decorative elements */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-geist-success bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500 bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
      
      <h1 className="text-4xl font-bold mb-2 animate-fade-in">
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500 dark:from-blue-400 dark:to-green-300">
          Your Information
        </span>
      </h1>
      <p className="text-xl text-geist-accent-600 dark:text-geist-accent-300 animate-fade-in-delay mb-12">
        Manage your personal data and wallets
      </p>
      
      <div className="max-w-4xl mx-auto px-4">
        {/* Personal Information Section */}
        <div className="mb-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground">Personal Information</h2>
            <button
              onClick={savePersonalData}
              disabled={personalSaving}
              className="px-3 py-1 bg-geist-success text-white text-sm rounded-lg hover:bg-opacity-90 transition-colors flex items-center"
            >
              {personalSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </>
              )}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="Doe"
              />
            </div>
          </div>
        </div>
        
        {/* Wallets Section */}
        <div className="mb-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
          <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Your Wallets</h2>
          
          {formData.walletAddresses.map((address, index) => (
            <div key={index} className="mb-6 border border-geist-accent-100 dark:border-geist-accent-700 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                    Wallet Name
                  </label>
                  <input
                    type="text"
                    value={formData.walletNames[index] || `Wallet ${index + 1}`}
                    onChange={(e) => handleWalletNameChange(index, e.target.value)}
                    className="input w-full"
                    placeholder="My Main Wallet"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                    Solana Wallet Address
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => updateWalletAddress(index, e.target.value)}
                      className="input w-full"
                      placeholder="Solana Wallet Address"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between mt-4">
                <div>
                  {index > 0 && (
                    <button
                      onClick={() => removeWallet(index)}
                      className="px-4 py-2 bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-800 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <button
                  onClick={() => saveWalletAndPull(index)}
                  disabled={walletSaving && activeWalletIndex === index || 
                           (walletProcessingStatus && (
                              walletProcessingStatus.currentWallet === address || 
                              walletProcessingStatus.queuedWallets.includes(address)
                           ))}
                  className={`px-4 py-2 ${
                    walletProcessingStatus && walletProcessingStatus.completedWallets.includes(address) 
                      ? 'bg-geist-accent-300 dark:bg-geist-accent-600' 
                      : 'bg-geist-success'
                  } text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center`}
                >
                  {walletSaving && activeWalletIndex === index ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Pulling Transactions...
                    </>
                  ) : (walletProcessingStatus && walletProcessingStatus.currentWallet === address) ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </>
                  ) : (walletProcessingStatus && walletProcessingStatus.queuedWallets.includes(address)) ? (
                    <>
                      <svg className="w-4 h-4 mr-1 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      In Queue
                    </>
                  ) : (walletProcessingStatus && walletProcessingStatus.completedWallets.includes(address)) ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Connected
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Connect
                    </>
                  )}
                </button>
              </div>
              {address.length >= 32 && (
                <div className="mt-2 text-xs">
                  <div className="text-geist-success flex items-center mb-1">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Valid wallet address
                  </div>
                  
                  {walletProcessingStatus && (
                    <>
                      {walletProcessingStatus.currentWallet === address && (
                        <div className="text-blue-500 flex items-center mt-1">
                          <svg className="animate-spin w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Currently processing transactions
                        </div>
                      )}
                      {walletProcessingStatus.queuedWallets.includes(address) && (
                        <div className="text-amber-500 flex items-center mt-1">
                          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Queued for processing
                        </div>
                      )}
                      {walletProcessingStatus.completedWallets.includes(address) && (
                        <div className="text-green-600 flex items-center mt-1">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Transactions loaded successfully
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          
          <button
            onClick={addWallet}
            className="px-4 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-lg hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors"
          >
            Add Another Wallet
          </button>
        </div>
        
        {/* Traditional Income Section */}
        <div className="mb-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground">Traditional Income</h2>
            <button
              onClick={saveIncomeData}
              disabled={incomeSaving}
              className="px-3 py-1 bg-geist-success text-white text-sm rounded-lg hover:bg-opacity-90 transition-colors flex items-center"
            >
              {incomeSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </>
              )}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                Salary Income
              </label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                Stock Trading Income
              </label>
              <input
                type="number"
                name="stockIncome"
                value={formData.stockIncome}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                Real Estate Income
              </label>
              <input
                type="number"
                name="realEstateIncome"
                value={formData.realEstateIncome}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                Dividend Income
              </label>
              <input
                type="number"
                name="dividends"
                value={formData.dividends}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-4 justify-center mb-8">
          <button
            onClick={analyzeTaxes}
            disabled={loading || formData.walletAddresses.filter(addr => addr.length >= 32).length === 0}
            className="px-6 py-3 bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
          >
            {loading ? (
              <span>
                Processing... {loadingProgress.toFixed(0)}%
              </span>
            ) : (
              'Calculate All Taxes'
            )}
          </button>
          
          {results && (
            <button
              onClick={clearTransactionCache}
              className="px-6 py-3 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-xl font-semibold hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1"
            >
              Re-analyze Transactions
            </button>
          )}
          
          {results && (
            <button
              onClick={clearAllTransactionCache}
              className="px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1"
            >
              Clear All Cache
            </button>
          )}
        </div>
        
        <button
          onClick={goBackToDashboard}
          className="px-6 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-xl font-medium hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors inline-flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default UserInformationPage; 