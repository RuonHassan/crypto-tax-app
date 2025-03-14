import { supabase } from '../supabaseClient';
import { Transaction } from '../types';

export class TransactionService {
  private cache: Map<string, { data: Transaction[]; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache
  private readonly INITIAL_BATCH_SIZE = 50; // Start with most recent 50 transactions
  private readonly MAX_BATCH_SIZE = 1000;

  async getUserTransactions(userId: string, page = 0): Promise<{ transactions: Transaction[]; hasMore: boolean }> {
    const cacheKey = `user_${userId}_${page}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { transactions: cached.data, hasMore: cached.data.length === this.INITIAL_BATCH_SIZE };
    }

    try {
      // First get all wallet IDs for the user
      const { data: wallets, error: walletError } = await supabase
        .from('wallets')
        .select('wallet_address')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (walletError) throw walletError;
      if (!wallets || wallets.length === 0) return { transactions: [], hasMore: false };

      const walletAddresses = wallets.map(w => w.wallet_address);
      const offset = page * this.INITIAL_BATCH_SIZE;

      // Then get transactions for all wallets with pagination
      const { data, error, count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .in('wallet_address', walletAddresses)
        .order('block_time', { ascending: false })
        .range(offset, offset + this.INITIAL_BATCH_SIZE - 1);

      if (error) throw error;
      
      const transactions = data as Transaction[];
      this.cache.set(cacheKey, { data: transactions, timestamp: Date.now() });
      
      const hasMore = count ? offset + this.INITIAL_BATCH_SIZE < count : false;
      return { transactions, hasMore };
    } catch (error) {
      console.error('Error fetching user transactions:', error);
      throw error;
    }
  }

  async getWalletTransactions(walletAddress: string, page = 0): Promise<{ transactions: Transaction[]; hasMore: boolean }> {
    const cacheKey = `wallet_${walletAddress}_${page}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { transactions: cached.data, hasMore: cached.data.length === this.INITIAL_BATCH_SIZE };
    }

    try {
      const offset = page * this.INITIAL_BATCH_SIZE;

      // Fetch transactions with pagination
      const { data: transactions, count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('wallet_address', walletAddress)
        .order('block_time', { ascending: false })
        .range(offset, offset + this.INITIAL_BATCH_SIZE - 1);

      if (error) throw error;
      
      if (!transactions) return { transactions: [], hasMore: false };

      this.cache.set(cacheKey, { data: transactions, timestamp: Date.now() });
      
      const hasMore = count ? offset + this.INITIAL_BATCH_SIZE < count : false;
      return { transactions, hasMore };
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

  clearCache(): void {
    this.cache.clear();
  }
}

export const transactionService = new TransactionService(); 