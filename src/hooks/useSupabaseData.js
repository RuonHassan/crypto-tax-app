import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getUserProfile, 
  createUserProfile, 
  updateUserProfile, 
  getUserWallets, 
  addUserWallet, 
  updateWallet, 
  updateWalletSyncTime, 
  getWalletTransactions, 
  getUserTransactions, 
  saveTransactions 
} from '../services/databaseService';

const useSupabaseData = (initialFormData) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userWallets, setUserWallets] = useState([]);
  const [formData, setFormData] = useState(initialFormData || {
    firstName: '',
    lastName: '',
    walletAddresses: [''],
    walletNames: ['My Wallet'],
    salary: '',
    stockIncome: '',
    realEstateIncome: '',
    dividends: ''
  });

  // Fetch user profile and wallets when user logs in
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        await fetchUserProfile();
        await fetchUserWallets();
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [user]);

  // Fetch user profile from Supabase
  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const { success, data } = await getUserProfile(user.id);
      
      if (success && data) {
        setUserProfile(data);
        
        // Update form data with profile information
        setFormData(prev => ({
          ...prev,
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          salary: data.salary || '',
          stockIncome: data.stock_income || '',
          realEstateIncome: data.real_estate_income || '',
          dividends: data.dividends || ''
        }));
      } else {
        // Create a new profile if none exists
        await createUserProfile(user.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          taxYear: new Date().getFullYear(),
          salary: formData.salary || 0,
          stockIncome: formData.stockIncome || 0,
          realEstateIncome: formData.realEstateIncome || 0,
          dividends: formData.dividends || 0
        });
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  // Fetch user wallets from Supabase
  const fetchUserWallets = async () => {
    if (!user) return;
    
    try {
      const { success, data } = await getUserWallets(user.id);
      
      if (success && data && data.length > 0) {
        setUserWallets(data);
        
        // Update form data with wallet information
        const walletAddresses = data.map(w => w.wallet_address);
        const walletNames = data.map(w => w.wallet_name);
        
        setFormData(prev => ({
          ...prev,
          walletAddresses: walletAddresses.length ? walletAddresses : [''],
          walletNames: walletNames.length ? walletNames : ['My Wallet']
        }));
      }
    } catch (error) {
      console.error('Error in fetchUserWallets:', error);
    }
  };

  // Save user profile to Supabase
  const saveUserProfile = async (profileData) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const { success } = await updateUserProfile(user.id, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        taxYear: profileData.taxYear || new Date().getFullYear(),
        salary: profileData.salary || 0,
        stockIncome: profileData.stockIncome || 0,
        realEstateIncome: profileData.realEstateIncome || 0,
        dividends: profileData.dividends || 0
      });
      
      if (success) {
        setFormData(prev => ({
          ...prev,
          ...profileData
        }));
      }
      
      return success;
    } catch (error) {
      console.error('Error in saveUserProfile:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Add a wallet to Supabase
  const addWalletToDatabase = async (walletAddress, walletName) => {
    if (!user) return false;
    
    try {
      setIsLoading(true);
      
      const { success, data } = await addUserWallet(user.id, {
        address: walletAddress,
        name: walletName
      });
      
      if (success && data) {
        // Refresh wallet list
        await fetchUserWallets();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error in addWalletToDatabase:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Save transactions to Supabase
  const saveTransactionsToDatabase = async (walletAddress, transactions) => {
    if (!user || !transactions.length) return false;
    
    try {
      // Find the wallet ID from the address
      const wallet = userWallets.find(w => w.wallet_address === walletAddress);
      if (!wallet) {
        console.error('Wallet not found in database:', walletAddress);
        return false;
      }
      
      const { success } = await saveTransactions(wallet.id, transactions);
      
      if (success) {
        // Update the wallet's sync time
        await updateWalletSyncTime(wallet.id);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error in saveTransactionsToDatabase:', error);
      return false;
    }
  };

  return {
    isLoading,
    userProfile,
    userWallets,
    formData,
    setFormData,
    fetchUserProfile,
    fetchUserWallets,
    saveUserProfile,
    addWalletToDatabase,
    saveTransactionsToDatabase
  };
};

export default useSupabaseData; 