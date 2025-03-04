import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TRANSACTION_TYPES, categorizeTransaction, DEX_PROGRAMS } from '../utils/transactionUtils';
import { Spinner, Progress } from '@geist-ui/core';

/**
 * Displays batch processing progress for transactions
 */
const BatchProgressIndicator = ({ batchProgress }) => {
  const { totalTransactions, processedTransactions, currentBatch, isComplete } = batchProgress;
  
  // Don't show anything if there's no data or process is complete
  if (!totalTransactions || isComplete) return null;
  
  const progressPercent = Math.min(
    Math.round((processedTransactions / totalTransactions) * 100), 
    99
  );
  
  return (
    <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            {progressPercent < 100 && (
              <Spinner size="small" className="mr-2" />
            )}
            <span className="text-sm font-medium">
              Loading transactions...
            </span>
          </div>
          <span className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
            Batch {currentBatch}
          </span>
        </div>
        
        <Progress value={progressPercent} />
        
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Processed: {processedTransactions} transactions</span>
          <span>{progressPercent}%</span>
        </div>
        
        <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
          Transactions are loaded in batches and will appear as they're processed.
          You can start exploring while more load in the background.
        </p>
      </div>
    </div>
  );
};

// Add this helper function at the top level
const getTransactionTypeLabel = (type) => {
  return type.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const TransactionDashboard = ({ 
  transactions = [], 
  selectedWallet = 'all', 
  walletMap = {},
  walletAddresses = [],
  walletNames = [],
  onWalletSelect,
  loading,
  batchProgress,
  walletProcessingStatus,
  queueWalletForProcessing,
  validateWalletAddress
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const itemsPerPage = 10;

  // Filter transactions based on selected wallet
  const filteredTransactions = useMemo(() => {
    return selectedWallet === 'all'
      ? transactions
      : transactions.filter(tx => tx.walletAddress === selectedWallet);
  }, [transactions, selectedWallet]);

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
      return 0;
    });
    }
    return sorted;
  }, [filteredTransactions, sortConfig]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + itemsPerPage);

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get transaction type color
  const getTransactionColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'buy':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'sell':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'transfer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'swap':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'gas':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
  };

  // Format amount with sign
  const formatAmount = (amount, includeSign = true) => {
    if (amount === undefined || amount === null) return '-';
    const formatted = Math.abs(amount).toFixed(4);
    return includeSign ? (amount >= 0 ? `+${formatted}` : `-${formatted}`) : formatted;
  };

  // Format USD value
  const formatUSD = (value) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Wallet Selection */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => onWalletSelect('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedWallet === 'all'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-geist-accent-100 text-geist-accent-700 dark:bg-geist-accent-800 dark:text-geist-accent-300 hover:bg-geist-accent-200 dark:hover:bg-geist-accent-700'
          }`}
        >
          All Wallets
        </button>
        {walletAddresses.map((address, index) => (
          address && (
            <button
              key={address}
              onClick={() => onWalletSelect(address)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedWallet === address
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-geist-accent-100 text-geist-accent-700 dark:bg-geist-accent-800 dark:text-geist-accent-300 hover:bg-geist-accent-200 dark:hover:bg-geist-accent-700'
              }`}
            >
              {walletNames[index] || `Wallet ${index + 1}`}
            </button>
          )
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-geist-success mx-auto mb-4"></div>
          <p className="text-geist-accent-700 dark:text-geist-accent-300">
            Loading transactions...
          </p>
          {batchProgress && (
            <div className="mt-2 text-sm text-geist-accent-600 dark:text-geist-accent-400">
              Processed {batchProgress.processedTransactions} of {batchProgress.totalTransactions} transactions
            </div>
          )}
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full divide-y divide-geist-accent-200 dark:divide-geist-accent-700">
          <thead>
            <tr className="text-left text-xs font-medium text-geist-accent-600 dark:text-geist-accent-400 uppercase tracking-wider">
              <th className="px-4 py-3" onClick={() => handleSort('timestamp')}>Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3" onClick={() => handleSort('solChange')}>Amount (SOL)</th>
              <th className="px-4 py-3" onClick={() => handleSort('usdValue')}>Value (USD)</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-geist-accent-200 dark:divide-geist-accent-700">
            {paginatedTransactions.map((tx, index) => (
              <tr 
                key={tx.signature}
                className={`text-sm ${
                  index % 2 === 0 
                    ? 'bg-white dark:bg-geist-accent-800' 
                    : 'bg-geist-accent-50 dark:bg-geist-accent-800/50'
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-geist-accent-900 dark:text-geist-accent-100">
                  {formatDate(tx.timestamp)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionColor(tx.type)}`}>
                    {tx.type}
                  </span>
                </td>
                <td className={`px-4 py-3 whitespace-nowrap font-medium ${
                  tx.solChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatAmount(tx.solChange)} SOL
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-geist-accent-900 dark:text-geist-accent-100">
                  {formatUSD(tx.usdValue)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-geist-accent-600 dark:text-geist-accent-400">
                  {walletMap[tx.walletAddress] || 'Unknown Wallet'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    tx.success 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    {tx.success ? 'Success' : 'Failed'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-geist-accent-600 dark:text-geist-accent-400">
                  {tx.fee ? `${tx.fee.toFixed(6)} SOL` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Table View */}
      <div className="lg:hidden">
        {paginatedTransactions.map((tx, index) => (
          <div 
            key={tx.signature}
            className={`p-4 rounded-lg mb-2 ${
              index % 2 === 0 
                ? 'bg-white dark:bg-geist-accent-800' 
                : 'bg-geist-accent-50 dark:bg-geist-accent-800/50'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionColor(tx.type)}`}>
                {tx.type}
              </span>
              <span className="text-xs text-geist-accent-600 dark:text-geist-accent-400">
                {formatDate(tx.timestamp)}
              </span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-geist-accent-600 dark:text-geist-accent-400">Amount:</span>
              <span className={`text-sm font-medium ${
                tx.solChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {formatAmount(tx.solChange)} SOL
              </span>
              </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-geist-accent-600 dark:text-geist-accent-400">Value:</span>
              <span className="text-sm text-geist-accent-900 dark:text-geist-accent-100">
                {formatUSD(tx.usdValue)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 px-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-lg text-sm font-medium bg-geist-accent-100 text-geist-accent-700 dark:bg-geist-accent-800 dark:text-geist-accent-300 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-geist-accent-600 dark:text-geist-accent-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded-lg text-sm font-medium bg-geist-accent-100 text-geist-accent-700 dark:bg-geist-accent-800 dark:text-geist-accent-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionDashboard;