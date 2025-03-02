import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useSupabaseData from '../hooks/useSupabaseData';
import UserInformationPage from '../components/UserInformationPage';

/**
 * This adapter bridges the existing UserInformationPage component with Supabase
 * It handles data synchronization between the local state and Supabase
 */
const UserInfoAdapter = ({ 
  formData: existingFormData,
  setFormData: setExistingFormData,
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
  ...props
}) => {
  const { user } = useAuth();
  const { 
    formData: supabaseFormData, 
    setFormData: setSupabaseFormData,
    saveUserProfile,
    addWalletToDatabase
  } = useSupabaseData(existingFormData);

  // Sync form data between existing state and Supabase state
  useEffect(() => {
    if (user && supabaseFormData) {
      setExistingFormData(prevData => ({
        ...prevData,
        firstName: supabaseFormData.firstName || prevData.firstName,
        lastName: supabaseFormData.lastName || prevData.lastName,
        walletAddresses: supabaseFormData.walletAddresses.length ? 
          supabaseFormData.walletAddresses : prevData.walletAddresses,
        walletNames: supabaseFormData.walletNames.length ? 
          supabaseFormData.walletNames : prevData.walletNames,
        salary: supabaseFormData.salary || prevData.salary,
        stockIncome: supabaseFormData.stockIncome || prevData.stockIncome,
        realEstateIncome: supabaseFormData.realEstateIncome || prevData.realEstateIncome,
        dividends: supabaseFormData.dividends || prevData.dividends
      }));
    }
  }, [user, supabaseFormData, setExistingFormData]);

  // Enhanced input handler that updates both states
  const enhancedInputChange = (e) => {
    // Call the original handler
    handleInputChange(e);
    
    // Update the Supabase state
    const { name, value } = e.target;
    setSupabaseFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Enhanced wallet name handler
  const enhancedWalletNameChange = (index, value) => {
    // Call the original handler
    handleWalletNameChange(index, value);
    
    // Update the Supabase state
    setSupabaseFormData(prev => {
      const updatedNames = [...prev.walletNames];
      updatedNames[index] = value;
      return {
        ...prev,
        walletNames: updatedNames
      };
    });
  };

  // Enhanced save wallet function
  const enhancedSaveWalletAndPull = async (index) => {
    // Get wallet info
    const walletAddress = existingFormData.walletAddresses[index];
    const walletName = existingFormData.walletNames[index];
    
    // Validate wallet
    if (walletAddress.length < 32) {
      alert('Please enter a valid Solana wallet address');
      return;
    }
    
    // Save to Supabase if authenticated
    if (user) {
      await addWalletToDatabase(walletAddress, walletName);
    }
    
    // Queue for processing or analyze immediately
    if (walletProcessingStatus.currentWallet) {
      // If already processing a wallet, queue this one
      queueWalletForProcessing(walletAddress);
    } else {
      // Otherwise, analyze immediately
      analyzeTaxes(walletAddress);
    }
  };

  // Enhanced save personal data function
  const enhancedSavePersonalData = async () => {
    if (user) {
      await saveUserProfile({
        firstName: existingFormData.firstName,
        lastName: existingFormData.lastName,
        taxYear: new Date().getFullYear(),
        salary: existingFormData.salary || 0,
        stockIncome: existingFormData.stockIncome || 0,
        realEstateIncome: existingFormData.realEstateIncome || 0,
        dividends: existingFormData.dividends || 0
      });
    }
    
    goBackToDashboard();
  };

  return (
    <UserInformationPage
      formData={existingFormData}
      handleInputChange={enhancedInputChange}
      handleWalletNameChange={enhancedWalletNameChange}
      analyzeTaxes={analyzeTaxes}
      loading={loading}
      loadingProgress={loadingProgress}
      results={results}
      clearTransactionCache={clearTransactionCache}
      clearAllTransactionCache={clearAllTransactionCache}
      setFormData={setExistingFormData}
      goBackToDashboard={goBackToDashboard}
      walletProcessingStatus={walletProcessingStatus}
      queueWalletForProcessing={queueWalletForProcessing}
      saveWalletAndPull={enhancedSaveWalletAndPull}
      savePersonalData={enhancedSavePersonalData}
      user={user}
      {...props}
    />
  );
};

export default UserInfoAdapter; 