import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Transaction, Wallet, TransactionType } from '../types';
import { groupTransactionsByDate, calculateDailyVolume, calculateTotalFees } from '../utils/transactionUtils';

interface TransactionDashboardProps {
    transactions: Transaction[];
    wallets: Wallet[];
    onRefresh: () => Promise<void>;
    selectedWallet: string;
    walletMap?: { [key: string]: string };
    walletAddresses?: string[];
    walletNames?: string[];
    onWalletSelect: (wallet: string) => void;
    loading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => Promise<void>;
    batchProgress?: {
        totalTransactions: number;
        processedTransactions: number;
        currentBatch: number;
        isComplete: boolean;
    };
    walletProcessingStatus?: {
        currentWallet: string | null;
        queuedWallets: string[];
        completedWallets: string[];
        interruptedWallets: string[];
    };
    queueWalletForProcessing?: () => Promise<void>;
    validateWalletAddress?: (address: string) => boolean;
}

export default function TransactionDashboard({
    transactions,
    wallets,
    onRefresh,
    selectedWallet,
    walletMap = {},
    walletAddresses = [],
    walletNames = [],
    onWalletSelect,
    loading = false,
    hasMore = false,
    onLoadMore,
    batchProgress,
    walletProcessingStatus,
    queueWalletForProcessing,
    validateWalletAddress
}: TransactionDashboardProps) {
    const [selectedType, setSelectedType] = useState<TransactionType | 'all'>('all');
    const loadingRef = useRef<HTMLDivElement>(null);
    const observer = useRef<IntersectionObserver | null>(null);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const walletMatch = selectedWallet === 'all' || tx.wallet_address === selectedWallet;
            const typeMatch = selectedType === 'all' || tx.transaction_type === selectedType;
            return walletMatch && typeMatch;
        });
    }, [transactions, selectedWallet, selectedType]);

    const stats = useMemo(() => {
        const dailyVolume = calculateDailyVolume(filteredTransactions);
        const totalFees = calculateTotalFees(filteredTransactions);
        const totalVolume = Object.values(dailyVolume).reduce((sum, vol) => sum + vol, 0);

        return {
            totalTransactions: filteredTransactions.length,
            totalVolume,
            totalFees,
            averageVolume: totalVolume / Object.keys(dailyVolume).length || 0
        };
    }, [filteredTransactions]);

    const handleRefresh = async () => {
        try {
            await onRefresh();
        } catch (error) {
            console.error('Error refreshing transactions:', error);
        }
    };

    const handleWalletSelect = (wallet: string) => {
        onWalletSelect(wallet);
    };

    // Infinite scroll implementation
    const lastTransactionElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                onLoadMore?.();
            }
        });
        
        if (node) observer.current.observe(node);
    }, [loading, hasMore, onLoadMore]);

    return (
        <div className="flex flex-col space-y-4 p-4">
            {/* Stats section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold">Total Transactions</h3>
                    <p className="text-2xl">{stats.totalTransactions}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold">Total Volume</h3>
                    <p className="text-2xl">${stats.totalVolume.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold">Total Fees</h3>
                    <p className="text-2xl">${stats.totalFees.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold">Average Daily Volume</h3>
                    <p className="text-2xl">${stats.averageVolume.toFixed(2)}</p>
                </div>
            </div>

            {/* Filters section */}
            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg shadow">
                <select
                    className="form-select"
                    value={selectedWallet}
                    onChange={(e) => handleWalletSelect(e.target.value)}
                >
                    <option value="all">All Wallets</option>
                    {wallets.map((wallet) => (
                        <option key={wallet.wallet_address} value={wallet.wallet_address}>
                            {wallet.wallet_name || wallet.wallet_address}
                        </option>
                    ))}
                </select>

                <select
                    className="form-select"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as TransactionType | 'all')}
                >
                    <option value="all">All Types</option>
                    <option value="transfer">Transfer</option>
                    <option value="swap">Swap</option>
                    <option value="nft">NFT</option>
                </select>

                <button
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={handleRefresh}
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* Transactions list */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">USD Value</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredTransactions.map((transaction, index) => (
                                <tr
                                    key={transaction.signature}
                                    ref={index === filteredTransactions.length - 1 ? lastTransactionElementRef : null}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {new Date(transaction.block_time).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">{transaction.transaction_type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{transaction.amount}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">${transaction.usd_value?.toFixed(2) || '0.00'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">${transaction.fee?.toFixed(4) || '0.0000'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            transaction.success
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {transaction.success ? 'Success' : 'Failed'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {loading && (
                    <div className="fixed bottom-4 right-4 z-50">
                        <div className="flex items-center space-x-2 bg-white dark:bg-geist-accent-800 shadow-lg rounded-lg p-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                            <span className="text-xs text-gray-500">Loading...</span>
                        </div>
                    </div>
                )}
                {!loading && !hasMore && filteredTransactions.length > 0 && (
                    <div className="text-center p-4 text-gray-500">
                        No more transactions to load
                    </div>
                )}
                {!loading && filteredTransactions.length === 0 && (
                    <div className="text-center p-4 text-gray-500">
                        No transactions found
                    </div>
                )}
            </div>
        </div>
    );
} 