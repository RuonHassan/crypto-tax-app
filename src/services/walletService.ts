import { supabase } from '../supabaseClient';
import { Wallet } from '../types';

class WalletService {
  async getUserWallets(userId: string): Promise<Wallet[]> {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data as Wallet[] || [];
    } catch (error) {
      console.error('Error fetching wallets:', error);
      throw error;
    }
  }

  async addWallet(wallet: Partial<Wallet>): Promise<Wallet> {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .insert([wallet])
        .select()
        .single();

      if (error) throw error;
      return data as Wallet;
    } catch (error) {
      console.error('Error adding wallet:', error);
      throw error;
    }
  }

  async deleteWallet(walletId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('wallets')
        .delete()
        .eq('id', walletId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting wallet:', error);
      throw error;
    }
  }
}

export const walletService = new WalletService(); 