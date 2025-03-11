import { supabase } from '../supabaseClient';
import { Transaction } from '../types';

export class TransactionService {
  async getUserTransactions(userId: string): Promise<Transaction[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data as Transaction[] || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async getWalletTransactions(walletId: string): Promise<Transaction[]> {
    try {
      let allTransactions: Transaction[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        console.log(`Fetching transactions page ${page + 1} for wallet ${walletId}`);
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('wallet_id', walletId)
          .order('block_time', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allTransactions = [...allTransactions, ...data];
          page++;
        }

        // If we got less than pageSize results, we've reached the end
        if (data && data.length < pageSize) {
          hasMore = false;
        }
      }

      console.log(`Total transactions fetched for wallet ${walletId}:`, allTransactions.length);
      return allTransactions as Transaction[];
    } catch (error) {
      console.error('Error fetching wallet transactions:', error);
      throw error;
    }
  }

  async saveTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([transaction])
        .select()
        .single();

      if (error) throw error;
      return data as Transaction;
    } catch (error) {
      console.error('Error saving transaction:', error);
      throw error;
    }
  }

  async processTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    // TODO: Implement transaction processing logic
    return transactions;
  }
}

export const transactionService = new TransactionService(); 