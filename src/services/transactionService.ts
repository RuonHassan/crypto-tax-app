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