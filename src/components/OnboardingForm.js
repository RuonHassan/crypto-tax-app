import React, { useState, useCallback, memo } from 'react';
import { formatCurrency } from '../utils/formatters';
import { addUserWallet, updateUserProfile } from '../services/databaseService';

// Create a memoized wallet input component to prevent re-renders
const WalletInput = memo(({ 
  index, 
  address, 
  walletName, 
  onAddressChange, 
  onNameChange, 
  onRemove, 
  onSave, 
  walletSaving, 
  activeWalletIndex,
  walletProcessingStatus
}) => (
  <div className="mb-6 border border-geist-accent-100 dark:border-geist-accent-700 rounded-lg p-4">
    <div className="flex justify-between items-center mb-4">
      <h3 className="font-medium text-geist-accent-900 dark:text-geist-foreground">Wallet {index + 1}</h3>
      <button
        onClick={onRemove}
        className="text-red-500 hover:text-red-700 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
          Wallet Name
        </label>
        <input
          type="text"
          value={walletName || ''}
          onChange={(e) => onNameChange(index, e.target.value)}
          className="input w-full"
          placeholder="My Main Wallet"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
          Wallet Address
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => onAddressChange(index, e.target.value)}
            className="input w-full"
            placeholder="Enter Solana wallet address"
          />
          <button
            onClick={() => onSave(index)}
            disabled={walletSaving && activeWalletIndex === index || address.length < 32}
            className={`px-3 py-1 rounded-lg text-white transition-colors flex items-center whitespace-nowrap ${
              address.length < 32
                ? 'bg-geist-accent-400 cursor-not-allowed'
                : 'bg-geist-success hover:bg-opacity-90'
            }`}
          >
            {walletSaving && activeWalletIndex === index ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving
              </span>
            ) : 'Save & Pull'}
          </button>
        </div>
      </div>
    </div>
    
    {address.length > 0 && (
      <div className="text-sm">
        {address.length < 32 ? (
          <div className="text-amber-500">
            Wallet address should be at least 32 characters
          </div>
        ) : (
          <div className="text-green-600">
            Valid wallet address
          </div>
        )}
        
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
));

// Wrap OnboardingForm with memo to prevent unnecessary re-renders
const OnboardingForm = memo(function OnboardingForm({ 
  formData,
  setFormData,
  handleInputChange,
  handleWalletNameChange,
  analyzeTaxes,
  loading,
  loadingProgress,
  walletProcessingStatus,
  queueWalletForProcessing,
  user,
  onComplete
}) {
  const [walletSaving, setWalletSaving] = useState(false);
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1 = Wallet Form, 2 = Income Form
  const [activeWalletIndex, setActiveWalletIndex] = useState(null);
  
  // Define the functions that were previously passed as props
  const goBackToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipToResults = async () => {
    setCurrentStep(3);
    // You might want to add additional logic here
  };

  const goToTraditionalIncomeStep = () => {
    setCurrentStep(2);
  };
  
  // Function to add a wallet
  const addWallet = () => {
    setFormData(prev => ({
      ...prev,
      walletAddresses: [...prev.walletAddresses, ''],
      walletNames: [...prev.walletNames, `My Wallet ${prev.walletAddresses.length + 1}`]
    }));
  };
  
  // Function to remove a wallet
  const removeWallet = (index) => {
    setFormData(prev => {
      const newAddresses = [...prev.walletAddresses];
      const newNames = [...prev.walletNames];
      
      newAddresses.splice(index, 1);
      newNames.splice(index, 1);
      
      return {
        ...prev,
        walletAddresses: newAddresses,
        walletNames: newNames
      };
    });
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
          if (queueWalletForProcessing) {
            queueWalletForProcessing(walletAddress);
          } else {
            console.log('Wallet queuing is not available');
          }
        } else {
          // No wallet is being processed, process this one immediately
          if (analyzeTaxes) {
            await analyzeTaxes(walletAddress);
          } else {
            console.log('Transaction analysis is not available');
          }
        }
      } catch (error) {
        console.error('Error analyzing wallet:', error);
      }
    }
    
    setWalletSaving(false);
  };
  
  // Function to save income data and move to the next step
  const saveIncomeData = async () => {
    setIncomeSaving(true);
    
    try {
      if (user) {
        console.log('Completing onboarding for user:', user.id);
        
        // Update user profile to mark onboarding as complete
        const { success, error } = await updateUserProfile(user.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          salary: formData.salary || 0,
          stockIncome: formData.stockIncome || 0,
          realEstateIncome: formData.realEstateIncome || 0,
          dividends: formData.dividends || 0,
          is_new_user: false // Mark onboarding as complete
        });
        
        if (!success) {
          console.error('Error updating profile:', error);
          alert('There was an issue completing onboarding. Please try again.');
          setIncomeSaving(false);
          return;
        }
        
        console.log('Onboarding completed successfully');
      }
      
      // On completion, go to dashboard
      if (onComplete) {
        onComplete();
      } else {
        // If onComplete is not available, advance to the next step
        goToTraditionalIncomeStep();
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('There was an issue completing onboarding. Please try again.');
    } finally {
      setIncomeSaving(false);
    }
  };
  
  const advanceToIncomeForm = () => {
    // Validate that at least one wallet has been added
    const validWallets = formData.walletAddresses.filter(addr => addr.length >= 32);
    if (validWallets.length === 0) {
      alert('Please add at least one valid wallet address before continuing.');
      return;
    }
    
    setCurrentStep(2);
  };
  
  // Create optimized handlers
  const handleWalletAddressChange = useCallback((index, value) => {
    const newAddresses = [...formData.walletAddresses];
    newAddresses[index] = value;
    setFormData(prev => ({
      ...prev,
      walletAddresses: newAddresses
    }));
  }, [formData.walletAddresses, setFormData]);

  return (
    <div className="py-12 text-center relative">
      {/* Decorative elements */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-geist-success bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500 bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
      
      <h1 className="text-4xl font-bold mb-2 animate-fade-in">
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500 dark:from-blue-400 dark:to-green-300">
          {currentStep === 1 ? 'Connect Your Wallets' : 'Additional Information'}
        </span>
      </h1>
      <p className="text-xl text-geist-accent-600 dark:text-geist-accent-300 animate-fade-in-delay mb-12">
        {currentStep === 1 
          ? 'Add your wallet addresses to get started with tax calculations'
          : 'Add your traditional income sources for a complete tax picture'
        }
      </p>
      
      {/* Progress steps */}
      <div className="max-w-md mx-auto mb-10 flex items-center">
        <div className={`flex-1 h-1 ${currentStep >= 1 ? 'bg-geist-success' : 'bg-geist-accent-300'}`}></div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-geist-success text-white' : 'bg-geist-accent-300 text-geist-accent-600'}`}>1</div>
        <div className={`flex-1 h-1 ${currentStep >= 2 ? 'bg-geist-success' : 'bg-geist-accent-300'}`}></div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-geist-success text-white' : 'bg-geist-accent-300 text-geist-accent-600'}`}>2</div>
        <div className={`flex-1 h-1 ${currentStep >= 3 ? 'bg-geist-success' : 'bg-geist-accent-300'}`}></div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-geist-success text-white' : 'bg-geist-accent-300 text-geist-accent-600'}`}>3</div>
        <div className={`flex-1 h-1 ${currentStep >= 3 ? 'bg-geist-success' : 'bg-geist-accent-300'}`}></div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4">
        {/* Step 1: Wallet Form */}
        {currentStep === 1 && (
          <div className="mb-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
            <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Your Wallets</h2>
            
            {formData.walletAddresses.map((address, index) => (
              <WalletInput
                key={index}
                index={index}
                address={address}
                walletName={formData.walletNames[index] || ''}
                onAddressChange={handleWalletAddressChange}
                onNameChange={handleWalletNameChange}
                onRemove={() => removeWallet(index)}
                onSave={saveWalletAndPull}
                walletSaving={walletSaving}
                activeWalletIndex={activeWalletIndex}
                walletProcessingStatus={walletProcessingStatus}
              />
            ))}
            
            <div className="flex justify-between mt-8">
              <button
                onClick={addWallet}
                className="px-4 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-lg hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors"
              >
                Add Another Wallet
              </button>
              
              <button
                onClick={advanceToIncomeForm}
                className="px-4 py-2 bg-geist-success text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Continue
              </button>
            </div>
            
            {loading && (
              <div className="mt-8 pt-6 border-t border-geist-accent-200 dark:border-geist-accent-700">
                <div className="flex items-center">
                  <div className="w-full bg-geist-accent-100 dark:bg-geist-accent-700 rounded-full h-2.5 mr-4">
                    <div 
                      className="bg-geist-success h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${loadingProgress || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-geist-accent-700 dark:text-geist-accent-300 whitespace-nowrap">{loadingProgress || 0}%</span>
                </div>
                <p className="text-sm text-geist-accent-600 dark:text-geist-accent-400 mt-2">
                  Loading and processing transactions. This may take a few minutes depending on your wallet activity.
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Step 2: Traditional Income Form */}
        {currentStep === 2 && (
          <div className="mb-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground">Traditional Income</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                  Annual Salary (USD)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-geist-accent-500">$</span>
                  </div>
                  <input
                    type="text"
                    name="salary"
                    value={formData.salary}
                    onChange={handleInputChange}
                    className="input w-full pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                  Stock Investment Income (USD)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-geist-accent-500">$</span>
                  </div>
                  <input
                    type="text"
                    name="stockIncome"
                    value={formData.stockIncome}
                    onChange={handleInputChange}
                    className="input w-full pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                  Real Estate Income (USD)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-geist-accent-500">$</span>
                  </div>
                  <input
                    type="text"
                    name="realEstateIncome"
                    value={formData.realEstateIncome}
                    onChange={handleInputChange}
                    className="input w-full pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                  Dividend Income (USD)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-geist-accent-500">$</span>
                  </div>
                  <input
                    type="text"
                    name="dividends"
                    value={formData.dividends}
                    onChange={handleInputChange}
                    className="input w-full pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-lg hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors"
              >
                Back
              </button>
              
              <button
                onClick={saveIncomeData}
                disabled={incomeSaving}
                className="px-4 py-2 bg-geist-success text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center"
              >
                {incomeSaving ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Go to Dashboard'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default OnboardingForm; 