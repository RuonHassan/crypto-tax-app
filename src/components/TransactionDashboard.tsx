import React, { useState, useMemo } from 'react';
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
    batchProgress,
    walletProcessingStatus,
    queueWalletForProcessing,
    validateWalletAddress
}: TransactionDashboardProps) {
    const [selectedType, setSelectedType] = useState<TransactionType | 'all'>('all');

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

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                            Total Transactions
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                            {stats.totalTransactions}
                        </dd>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                            Total Volume
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                            {stats.totalVolume.toFixed(2)} SOL
                        </dd>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                            Total Fees
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                            {stats.totalFees.toFixed(4)} SOL
                        </dd>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                            Average Daily Volume
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                            {stats.averageVolume.toFixed(2)} SOL
                        </dd>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col sm:flex-row sm:space-x-4">
                            <div className="mb-4 sm:mb-0">
                                <label htmlFor="wallet" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Wallet
                                </label>
                                <select
                                    id="wallet"
                                    value={selectedWallet}
                                    onChange={(e) => handleWalletSelect(e.target.value)}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="all">All Wallets</option>
                                    {wallets.map((wallet) => (
                                        <option key={wallet.id} value={wallet.wallet_address}>
                                            {wallet.wallet_name || wallet.wallet_address.slice(0, 8)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Transaction Type
                                </label>
                                <select
                                    id="type"
                                    value={selectedType}
                                    onChange={(e) => setSelectedType(e.target.value as TransactionType | 'all')}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="all">All Types</option>
                                    {Object.values(TransactionType).map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                        Transactions
                    </h3>
                    <div className="mt-4">
                        {filteredTransactions.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No transactions found.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead>
                                        <tr>
                                            <th className="px-6 py-3 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-6 py-3 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Amount
                                            </th>
                                            <th className="px-6 py-3 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                USD Value
                                            </th>
                                            <th className="px-6 py-3 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Fee
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {filteredTransactions.map((tx) => (
                                            <tr key={tx.signature}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {new Date(tx.block_time).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {tx.transaction_type}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {tx.amount.toFixed(4)} SOL
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    ${tx.usd_value.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {tx.fee.toFixed(4)} SOL
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 