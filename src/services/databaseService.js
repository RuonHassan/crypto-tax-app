import { supabase } from '../supabaseClient';

// User profile operations
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { success: false, error: error.message };
  }
};

export const createUserProfile = async (userId, profileData) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert([
        { 
          id: userId, 
          first_name: profileData.firstName || null,
          last_name: profileData.lastName || null,
          tax_year: profileData.taxYear || new Date().getFullYear(),
          salary: profileData.salary || 0,
          stock_income: profileData.stockIncome || 0,
          real_estate_income: profileData.realEstateIncome || 0,
          dividends: profileData.dividends || 0
        }
      ])
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating user profile:', error);
    return { success: false, error: error.message };
  }
};

export const updateUserProfile = async (userId, profileData) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        tax_year: profileData.taxYear,
        salary: profileData.salary,
        stock_income: profileData.stockIncome,
        real_estate_income: profileData.realEstateIncome,
        dividends: profileData.dividends,
        updated_at: new Date()
      })
      .eq('id', userId)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error: error.message };
  }
};

// Wallet operations
export const getUserWallets = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching user wallets:', error);
    return { success: false, error: error.message };
  }
};

export const addUserWallet = async (userId, walletData) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .insert([
        {
          user_id: userId,
          wallet_address: walletData.address,
          wallet_name: walletData.name,
          blockchain: walletData.blockchain || 'solana'
        }
      ])
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error adding user wallet:', error);
    return { success: false, error: error.message };
  }
};

export const updateWallet = async (walletId, walletData) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .update({
        wallet_name: walletData.name,
        is_active: walletData.isActive
      })
      .eq('id', walletId)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating wallet:', error);
    return { success: false, error: error.message };
  }
};

export const updateWalletSyncTime = async (walletId) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .update({
        last_synced_at: new Date()
      })
      .eq('id', walletId)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating wallet sync time:', error);
    return { success: false, error: error.message };
  }
};

// Transaction operations
export const getWalletTransactions = async (walletId) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('block_time', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return { success: false, error: error.message };
  }
};

export const getUserTransactions = async (userId) => {
  try {
    // First get all of the user's wallet IDs
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (walletsError) throw walletsError;
    
    // If user has no wallets, return empty array
    if (!wallets || wallets.length === 0) {
      return { success: true, data: [] };
    }
    
    // Get transactions for all of these wallets
    const walletIds = wallets.map(wallet => wallet.id);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .in('wallet_id', walletIds)
      .order('block_time', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    return { success: false, error: error.message };
  }
};

export const saveTransactions = async (walletId, transactions) => {
  try {
    // Format transactions for Supabase insertion
    const formattedTransactions = transactions.map(tx => ({
      wallet_id: walletId,
      signature: tx.signature,
      block_time: tx.blockTime ? new Date(tx.blockTime * 1000) : null,
      success: tx.status === 'success',
      fee: tx.fee || null,
      transaction_type: tx.type || 'unknown',
      amount: tx.amount || null,
      token_symbol: tx.token || null,
      token_address: tx.tokenAddress || null,
      usd_value: tx.usdValue || null,
      source_address: tx.sourceWallet || null,
      destination_address: tx.destinationWallet || null,
      raw_data: tx.rawData || {}
    }));

    // Use upsert to avoid duplicate transactions
    const { data, error } = await supabase
      .from('transactions')
      .upsert(formattedTransactions, { 
        onConflict: 'signature',
        ignoreDuplicates: true
      })
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving transactions:', error);
    return { success: false, error: error.message };
  }
};

// Function to delete all user data from Supabase for testing purposes
export const deleteAllUserData = async (userId) => {
  try {
    // Delete all transactions from the user's wallets
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId);
      
    if (walletsError) throw walletsError;
    
    if (wallets && wallets.length > 0) {
      const walletIds = wallets.map(wallet => wallet.id);
      
      // Delete all transactions for these wallets
      const { error: transactionDeleteError } = await supabase
        .from('transactions')
        .delete()
        .in('wallet_id', walletIds);
        
      if (transactionDeleteError) throw transactionDeleteError;
    }
    
    // Delete all wallets for the user
    const { error: walletDeleteError } = await supabase
      .from('wallets')
      .delete()
      .eq('user_id', userId);
      
    if (walletDeleteError) throw walletDeleteError;
    
    // Note: We don't delete the profile itself, just reset its data
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        first_name: null,
        last_name: null,
        salary: 0,
        stock_income: 0,
        real_estate_income: 0,
        dividends: 0,
        updated_at: new Date()
      })
      .eq('id', userId);
      
    if (profileUpdateError) throw profileUpdateError;
    
    return { success: true, message: 'All user data deleted successfully' };
  } catch (error) {
    console.error('Error deleting user data:', error);
    return { success: false, error: error.message };
  }
}; 