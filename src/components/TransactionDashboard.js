import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TRANSACTION_TYPES, categorizeTransaction, DEX_PROGRAMS } from '../utils/transactionUtils';

const TransactionDashboard = ({ 
  transactions = [], 
  selectedWallet = 'all', 
  walletMap = {},
  walletAddresses = [],
  walletNames = [],
  onWalletSelect
}) => {
  // State hooks at top level
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(false);
  
  // Remove console logging in production
  // console.log('TransactionDashboard rendered with transactions:', transactions);

  // Callback hooks at top level
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

  const handleDateFilter = useCallback(() => {
    // Implementation for date filter
  }, []);

  // Filter transactions based on search and other criteria
  const filterTransactions = useCallback((txs) => {
    if (!txs || txs.length === 0) return [];
    
    // First filter by wallet if a specific one is selected
    const walletFiltered = selectedWallet === 'all' 
      ? txs 
      : txs.filter(tx => tx && tx.sourceWallet === selectedWallet);
      
    return walletFiltered.filter(tx => {
      if (!tx) return false;
      
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
      
      // Apply type filter if not 'all'
      if (selectedFilter !== 'all') {
        return tx.type === selectedFilter;
      }
      
      return true;
    });
  }, [searchQuery, selectedFilter, selectedWallet]);

  // Sort filtered transactions
  const sortTransactions = useCallback((txs) => {
    if (!txs || txs.length === 0) return [];
    
    return [...txs].sort((a, b) => {
      // Handle null or undefined values
      if (!a || !b) return 0;
      
      // Determine values to compare based on sort key
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // Special handling for certain fields
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
    // First filter
    const filtered = filterTransactions(transactions);
    // Then sort
    return sortTransactions(filtered);
  }, [transactions, filterTransactions, sortTransactions]);

  // Pagination calculation
  const totalPages = Math.ceil(processedTransactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, processedTransactions.length);
  const paginatedTransactions = processedTransactions.slice(startIndex, endIndex);

  // Utility functions (not hooks)
  const getTransactionIcon = (tx) => {
    // Implementation for transaction icon
    return null;
  };

  const getTransactionColor = (tx) => {
    // Implementation for transaction color
    return '';
  };

  const getTransactionDetails = (tx) => {
    // Implementation for transaction details 
    return {};
  };

  const formatTimestamp = (timestamp) => {
    // Implementation for formatting timestamp
    return new Date(timestamp).toLocaleString();
  };

  const getSortIcon = (key) => {
    // Implementation for sort icon
    return null;
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
      {/* Your transactions table rendering code */}
      <div className="bg-white dark:bg-geist-accent-800 rounded-xl border border-geist-accent-200 dark:border-geist-accent-700 overflow-hidden">
        {/* Table content would go here */}
        <div className="p-6 text-center text-geist-accent-600">
          <p>Transaction data is available but table rendering is simplified in this example.</p>
          <p className="mt-2">Found {processedTransactions.length} transactions{selectedWallet !== 'all' ? ` for ${walletNames[walletAddresses.indexOf(selectedWallet)] || 'selected wallet'}` : ''}.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Wallet selection */}
      <div className="bg-white dark:bg-geist-accent-800 rounded-xl shadow-sm p-4 mb-6">
        <div className="overflow-x-auto">
          <div className="flex flex-wrap border-b border-geist-accent-200 dark:border-geist-accent-700">
            <button
              onClick={() => handleWalletSelect('all')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200 ${
                selectedWallet === 'all'
                  ? 'border-geist-success text-geist-success'
                  : 'border-transparent text-geist-accent-600 hover:text-geist-accent-900'
              }`}
            >
              All Wallets
            </button>
            
            {walletAddresses.map((address, index) => (
              <button
                key={address}
                onClick={() => handleWalletSelect(address)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  selectedWallet === address
                    ? 'border-geist-success text-geist-success'
                    : 'border-transparent text-geist-accent-600 hover:text-geist-accent-900'
                }`}
              >
                {walletNames[index] || `Wallet ${index + 1}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions content */}
      <div className="mt-4">
        {processedTransactions.length === 0 ? renderEmptyState() : renderTransactionsTable()}
      </div>
    </div>
  );
};

export default React.memo(TransactionDashboard);