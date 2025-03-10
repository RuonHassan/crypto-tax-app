import { supabase } from '../supabaseClient';
import { Transaction, Wallet } from '../types';

export const getUserWallets = async (userId: string): Promise<Wallet[]> => {
    const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Wallet[];
};

export const saveTransactions = async (transactions: Transaction[]): Promise<void> => {
    if (!transactions.length) return;

    const { error } = await supabase
        .from('transactions')
        .upsert(
            transactions.map(tx => ({
                signature: tx.signature,
                block_time: tx.block_time,
                wallet_address: tx.wallet_address,
                transaction_type: tx.transaction_type,
                amount: tx.amount,
                usd_value: tx.usd_value,
                fee: tx.fee,
                success: tx.success,
                destination_address: tx.destination_address,
                is_internal_transfer: tx.is_internal_transfer,
                destination_wallet_id: tx.destination_wallet_id,
                raw_data: tx.raw_data
            }))
        );

    if (error) throw error;
}; 