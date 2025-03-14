import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { updateUserProfile } from '../../services/databaseService';
import Step1PersonalDetails from './Step1PersonalDetails';
import Step2WalletSetup from './Step2WalletSetup';
import Step3IncomeSoon from './Step3IncomeSoon';

const OnboardingFlow = () => {
  const { user, userProfile, fetchUserProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    walletAddresses: [''],
    walletNames: ['My Wallet']
  });
  const navigate = useNavigate();

  // Initialize form data from userProfile
  useEffect(() => {
    if (userProfile) {
      setFormData(prev => ({
        ...prev,
        firstName: userProfile.first_name || '',
        lastName: userProfile.last_name || '',
      }));
    }
  }, [userProfile]);

  // Navigate to main app if user is not new
  useEffect(() => {
    if (userProfile && userProfile.is_new_user === false) {
      navigate('/app');
    }
  }, [userProfile, navigate]);

  const handleNext = async () => {
    if (currentStep === 1) {
      // Save personal details
      try {
        const { success, error } = await updateUserProfile(user.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
        });
        
        if (!success) {
          throw error || new Error('Failed to update profile');
        }
        
        await fetchUserProfile(user.id);
        setCurrentStep(2);
      } catch (error) {
        console.error('Error saving profile:', error);
        alert('Failed to save profile. Please try again.');
      }
    } else if (currentStep === 2) {
      // Wallet setup completed
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Finish onboarding
      try {
        const { success, error } = await updateUserProfile(user.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          is_new_user: false
        });
        
        if (!success) {
          throw error || new Error('Failed to update profile');
        }
        
        navigate('/app');
      } catch (error) {
        console.error('Error completing onboarding:', error);
        alert('Failed to complete onboarding. Please try again.');
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleWalletChange = (index, value) => {
    const newWalletAddresses = [...formData.walletAddresses];
    newWalletAddresses[index] = value;
    setFormData(prev => ({
      ...prev,
      walletAddresses: newWalletAddresses
    }));
  };

  const handleWalletNameChange = (index, value) => {
    const newWalletNames = [...formData.walletNames];
    newWalletNames[index] = value;
    setFormData(prev => ({
      ...prev,
      walletNames: newWalletNames
    }));
  };

  const addWalletField = () => {
    setFormData(prev => ({
      ...prev,
      walletAddresses: [...prev.walletAddresses, ''],
      walletNames: [...prev.walletNames, `My Wallet ${prev.walletNames.length + 1}`]
    }));
  };

  const removeWalletField = (index) => {
    if (formData.walletAddresses.length > 1) {
      setFormData(prev => ({
        ...prev,
        walletAddresses: prev.walletAddresses.filter((_, i) => i !== index),
        walletNames: prev.walletNames.filter((_, i) => i !== index)
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-geist-accent-100 to-white dark:from-geist-background dark:to-geist-accent-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white dark:bg-geist-accent-800 rounded-xl shadow-md p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-geist-accent-900 dark:text-white">
              {currentStep === 1 && "Welcome! Let's get started"}
              {currentStep === 2 && "Connect your wallets"}
              {currentStep === 3 && "Almost done!"}
            </h2>
            <div className="text-sm text-geist-accent-500 dark:text-geist-accent-400">
              Step {currentStep} of 3
            </div>
          </div>
          
          <div className="w-full bg-geist-accent-200 dark:bg-geist-accent-700 h-2 rounded-full mb-6">
            <div 
              className="bg-geist-accent-500 dark:bg-geist-accent-300 h-2 rounded-full transition-all"
              style={{ width: `${(currentStep / 3) * 100}%` }}
            ></div>
          </div>
        </div>

        {currentStep === 1 && (
          <Step1PersonalDetails 
            formData={formData} 
            onChange={handleChange} 
          />
        )}
        
        {currentStep === 2 && (
          <Step2WalletSetup 
            walletAddresses={formData.walletAddresses}
            walletNames={formData.walletNames}
            onWalletChange={handleWalletChange}
            onWalletNameChange={handleWalletNameChange}
            onAddWallet={addWalletField}
            onRemoveWallet={removeWalletField}
          />
        )}
        
        {currentStep === 3 && (
          <Step3IncomeSoon />
        )}

        <div className="flex justify-between mt-8">
          {currentStep > 1 ? (
            <button
              onClick={handleBack}
              className="px-4 py-2 border border-geist-accent-300 dark:border-geist-accent-600 text-geist-accent-700 dark:text-geist-accent-300 rounded-lg hover:bg-geist-accent-100 dark:hover:bg-geist-accent-700 transition-colors"
            >
              Back
            </button>
          ) : (
            <div></div>
          )}
          
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-geist-accent-500 text-white rounded-lg hover:bg-geist-accent-600 transition-colors"
          >
            {currentStep < 3 ? 'Continue' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow; 