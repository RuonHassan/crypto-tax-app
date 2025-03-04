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
  // State hooks at top level
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  // Add transaction type filter state
  const [selectedType, setSelectedType] = useState('all');

  // Get unique transaction types from the transactions
  const availableTypes = useMemo(() => {
    const types = new Set(['all']);
    transactions.forEach(tx => {
      if (tx.type) types.add(tx.type);
    });
    return Array.from(types);
  }, [transactions]);

  // Callback hooks
  const handleWalletSelect = useCallback((address) => {
    onWalletSelect(address);
  }, [onWalletSelect]);

  const handleSort = useCallback((key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  // Update filterTransactions to include type filtering
  const filterTransactions = useCallback((txs) => {
    if (!txs || txs.length === 0) return [];
    
    // First filter by wallet if a specific one is selected
    const walletFiltered = selectedWallet === 'all' 
      ? txs 
      : txs.filter(tx => tx && tx.sourceWallet === selectedWallet);
      
    return walletFiltered.filter(tx => {
      if (!tx) return false;
      
      // Apply type filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }
      
      // Apply search filter if present
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        const matchesSearch = 
          (tx.signature && tx.signature.toLowerCase().includes(lowerSearch)) ||
          (tx.sourceWalletName && tx.sourceWalletName.toLowerCase().includes(lowerSearch)) ||
          (tx.destinationWalletName && tx.destinationWalletName.toLowerCase().includes(lowerSearch)) ||
          (tx.description && tx.description.toLowerCase().includes(lowerSearch));
        
        if (!matchesSearch) return false;
      }
      
      return true;
    });
  }, [searchQuery, selectedType, selectedWallet]);

  // Sort filtered transactions
  const sortTransactions = useCallback((txs) => {
    if (!txs || txs.length === 0) return [];
    
    return [...txs].sort((a, b) => {
      if (!a || !b) return 0;
      
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      if (sortConfig.key === 'amount') {
        aValue = parseFloat(a.amount || 0);
        bValue = parseFloat(b.amount || 0);
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortConfig]);

  // Process transactions through filtering and sorting
  const processedTransactions = useMemo(() => {
    const filtered = filterTransactions(transactions);
    return sortTransactions(filtered);
  }, [transactions, filterTransactions, sortTransactions]);

  // Pagination calculation
  const totalPages = Math.ceil(processedTransactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, processedTransactions.length);
  const paginatedTransactions = processedTransactions.slice(startIndex, endIndex);

  const getTransactionColor = (type) => {
    switch(type) {
      case 'buy':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'sell':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'transfer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'internal_transfer':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300';
      case 'swap':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'gas':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return '⇳';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Rendering logic
  const renderEmptyState = () => (
    <div className="bg-geist-accent-50 dark:bg-geist-accent-800 rounded-xl p-6 shadow-sm text-center">
      <h3 className="text-lg font-semibold mb-4">No Transactions Available</h3>
      <p className="text-geist-accent-500">
        No transaction data is currently available. This could be because:
      </p>
      <ul className="mt-2 text-geist-accent-500 list-disc list-inside">
        <li>No wallet addresses have been analyzed yet</li>
        <li>The selected wallet has no transactions</li>
        <li>The data is still loading</li>
      </ul>
            </div>
  );

  const renderTransactionsTable = () => (
    <div>
      <div className="bg-white dark:bg-geist-accent-800 rounded-xl border border-geist-accent-200 dark:border-geist-accent-700 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-geist-accent-200 dark:divide-geist-accent-700">
          <thead className="bg-geist-accent-50 dark:bg-geist-accent-900">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-geist-accent-500 uppercase tracking-wider cursor-pointer hover:text-geist-accent-700 dark:hover:text-geist-accent-300" onClick={() => handleSort('timestamp')}>
                Date {getSortIcon('timestamp')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-geist-accent-500 uppercase tracking-wider cursor-pointer hover:text-geist-accent-700 dark:hover:text-geist-accent-300" onClick={() => handleSort('type')}>
                Type {getSortIcon('type')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-geist-accent-500 uppercase tracking-wider">
                Details
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-geist-accent-500 uppercase tracking-wider cursor-pointer hover:text-geist-accent-700 dark:hover:text-geist-accent-300" onClick={() => handleSort('solChange')}>
                SOL Amount {getSortIcon('solChange')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-geist-accent-500 uppercase tracking-wider cursor-pointer hover:text-geist-accent-700 dark:hover:text-geist-accent-300" onClick={() => handleSort('usdValue')}>
                USD Value {getSortIcon('usdValue')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-geist-accent-500 uppercase tracking-wider">
                Wallet
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-geist-accent-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-geist-accent-800 divide-y divide-geist-accent-200 dark:divide-geist-accent-700">
            {paginatedTransactions.map((tx, index) => (
              <tr 
                key={tx.signature || index} 
                className={`${
                  index % 2 === 0 
                    ? 'bg-white dark:bg-geist-accent-800' 
                    : 'bg-geist-accent-50/50 dark:bg-geist-accent-900/50'
                } hover:bg-geist-accent-100 dark:hover:bg-geist-accent-700 transition-colors`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-geist-accent-600 dark:text-geist-accent-400">
                  {tx.timestamp ? formatTimestamp(tx.timestamp * 1000) : 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTransactionColor(tx.type)}`}>
                    {tx.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <div className="font-medium text-geist-accent-900 dark:text-geist-foreground">
                      {tx.details?.title || 'Transaction'}
                    </div>
                    {tx.details?.description && (
                      <div className="text-geist-accent-500 dark:text-geist-accent-400 text-xs mt-0.5">
                        {tx.details.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm font-medium ${
                    tx.solChange > 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {tx.solChange > 0 ? '+' : ''}{tx.solChange?.toFixed(4) || 0} SOL
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm font-medium ${
                    tx.usdValue > 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {tx.usdValue ? (
                      `${tx.usdValue > 0 ? '+' : ''}$${Math.abs(tx.usdValue).toFixed(2)}`
                    ) : (
                      'N/A'
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-geist-accent-500 dark:text-geist-accent-400">
                  {tx.walletName || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <a
                    href={`https://solscan.io/tx/${tx.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-geist-accent-600 dark:text-geist-accent-300 bg-geist-accent-100 dark:bg-geist-accent-700 hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-geist-success transition-colors"
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Inspect
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 bg-white dark:bg-geist-accent-900 border-t border-geist-accent-200 dark:border-geist-accent-700">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                  currentPage === 1
                    ? 'bg-geist-accent-100 text-geist-accent-400 cursor-not-allowed'
                    : 'bg-white dark:bg-geist-accent-800 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-50 dark:hover:bg-geist-accent-700'
                }`}
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                  currentPage === totalPages
                    ? 'bg-geist-accent-100 text-geist-accent-400 cursor-not-allowed'
                    : 'bg-white dark:bg-geist-accent-800 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-50 dark:hover:bg-geist-accent-700'
                }`}
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-geist-accent-600 dark:text-geist-accent-400">
                  Showing <span className="font-medium">{Math.min(processedTransactions.length, startIndex + 1)}</span> to <span className="font-medium">{endIndex}</span> of{' '}
                  <span className="font-medium">{processedTransactions.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px" aria-label="Pagination">
                  {[...Array(totalPages).keys()].map(page => (
                    <button
                      key={page + 1}
                      onClick={() => handlePageChange(page + 1)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium first:rounded-l-lg last:rounded-r-lg ${
                        currentPage === page + 1
                          ? 'z-10 bg-geist-success bg-opacity-10 border-geist-success text-geist-success'
                          : 'bg-white dark:bg-geist-accent-800 text-geist-accent-500 hover:bg-geist-accent-50 dark:hover:bg-geist-accent-700'
                      }`}
                    >
                      {page + 1}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Wallet selection */}
      <div className="bg-white dark:bg-geist-accent-800 rounded-xl shadow-sm p-4 mb-6">
        <div className="overflow-x-auto">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleWalletSelect('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedWallet === 'all'
                  ? 'bg-geist-success text-white'
                  : 'bg-geist-accent-100 dark:bg-geist-accent-700 text-geist-accent-600 dark:text-geist-accent-300 hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600'
              }`}
            >
              All Wallets
            </button>
            
            {walletAddresses.map((address, index) => (
              <button
                key={address}
                onClick={() => handleWalletSelect(address)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                  selectedWallet === address
                    ? 'bg-geist-success text-white'
                    : walletProcessingStatus.completedWallets.includes(address)
                    ? 'bg-green-500 text-white'
                    : 'bg-geist-accent-100 dark:bg-geist-accent-700 text-geist-accent-600 dark:text-geist-accent-300 hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600'
                }`}
              >
                {walletProcessingStatus.currentWallet === address ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing
                  </>
                ) : walletProcessingStatus.queuedWallets.includes(address) ? (
                  <>
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    In Queue
                  </>
                ) : walletProcessingStatus.completedWallets.includes(address) ? (
                  <>
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {walletNames[index] || `Wallet ${index + 1}`}
                  </>
                ) : (
                  <>
                    {walletNames[index] || `Wallet ${index + 1}`}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions content */}
      <div className="mt-4">
        {loading && <div className="flex justify-center py-8">
          <Spinner size="large" />
        </div>}
        
        {!loading && transactions && (
          <div className="space-y-6">
            <BatchProgressIndicator batchProgress={batchProgress} />
            
            {/* Add filters section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold">Transactions</h2>
              
              <div className="flex flex-wrap gap-4">
                {/* Search input */}
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 bg-white dark:bg-geist-accent-800 text-sm focus:outline-none focus:ring-2 focus:ring-geist-success"
                />
                
                {/* Type filter dropdown */}
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 bg-white dark:bg-geist-accent-800 text-sm focus:outline-none focus:ring-2 focus:ring-geist-success"
                >
                  {availableTypes.map(type => (
                    <option key={type} value={type}>
                      {type === 'all' ? 'All Types' : getTransactionTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Existing table */}
            {transactions.length === 0 ? renderEmptyState() : renderTransactionsTable()}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(TransactionDashboard);