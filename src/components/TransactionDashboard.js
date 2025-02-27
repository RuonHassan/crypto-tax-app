import React, { useState, useEffect } from 'react';
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
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showSettings, setShowSettings] = useState(false);
  const [showUsdValues, setShowUsdValues] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [compactView, setCompactView] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [theme, setTheme] = useState('system');
  const [filterState, setFilterState] = useState({
    type: 'all',
    dateRange: null
  });

  console.log('TransactionDashboard rendered with transactions:', transactions);

  // Filter transactions by selected wallet
  const walletFilteredTransactions = selectedWallet === 'all' 
    ? transactions 
    : transactions.filter(tx => tx.sourceWallet === selectedWallet || tx.destinationWallet === selectedWallet);

  // Function to apply theme (moved outside useEffect)
  const applyTheme = (selectedTheme) => {
    const root = window.document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('light', 'dark');
    
    if (selectedTheme === 'system') {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(systemPrefersDark ? 'dark' : 'light');
    } else {
      // Apply selected theme
      root.classList.add(selectedTheme);
    }
    
    // Store the theme preference
    localStorage.setItem('theme', selectedTheme);
  };

  // Theme handling
  useEffect(() => {
    // Apply current theme setting
    applyTheme(theme);
    
    // Add listener for system preference change
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
  
  // Initialize theme from localStorage on component mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  if (!walletFilteredTransactions || walletFilteredTransactions.length === 0) {
    return (
      <div>
        {/* Wallet Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap border-b border-geist-accent-200 dark:border-geist-accent-700">
            <button
              onClick={() => onWalletSelect('all')}
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
                onClick={() => onWalletSelect(address)}
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
      </div>
    );
  }

  // Filter transactions
  const filterTransactions = (txs) => {
    return txs.filter(tx => {
      if (!tx) return false;
      
      const matchesSearch = searchQuery === '' || 
        (tx.signature && tx.signature.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.sourceWallet && tx.sourceWallet.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.destinationWallet && tx.destinationWallet.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.sourceWalletName && tx.sourceWalletName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.destinationWalletName && tx.destinationWalletName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.tokenInfo?.symbol && tx.tokenInfo.symbol.toLowerCase().includes(searchQuery.toLowerCase()));

      switch (selectedFilter) {
        case 'transfers':
          return tx.type === TRANSACTION_TYPES.TRANSFER && matchesSearch;
        case 'tokens':
          return tx.type === TRANSACTION_TYPES.TOKEN_TRANSACTION && matchesSearch;
        case 'swaps':
          return tx.type === TRANSACTION_TYPES.SWAP && matchesSearch;
        case 'internal':
          return tx.isInternalTransfer && matchesSearch;
        case 'fees':
          return ((tx.type === TRANSACTION_TYPES.GAS || (tx.solChange || 0) < 0)) && matchesSearch;
        default:
          return matchesSearch;
      }
    });
  };

  // Sort transactions
  const sortTransactions = (txs) => {
    return [...txs].sort((a, b) => {
      // Handle potential null values
      if (!a || !b) return 0;
      
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // Handle undefined values - put them at the end
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;
      
      if (sortConfig.key === 'valueUSD' || sortConfig.key === 'solChange') {
        aValue = Math.abs(aValue || 0);
        bValue = Math.abs(bValue || 0);
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Function to handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Function to get the sort icon for column headers
  const getSortIcon = (key) => {
    if (sortConfig.key === key) {
      return (
        <span className="inline-block ml-1">
          {sortConfig.direction === 'asc' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </span>
      );
    }
    return (
      <span className="inline-block ml-1 opacity-0 group-hover:opacity-50">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </span>
    );
  };

  // Apply all filters to walletFilteredTransactions
  const allProcessedTransactions = sortTransactions(filterTransactions(walletFilteredTransactions));
  
  // Apply pagination
  const totalPages = Math.ceil(allProcessedTransactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, allProcessedTransactions.length);
  const paginatedTransactions = allProcessedTransactions.slice(startIndex, endIndex);

  // Calculate statistics - use walletFilteredTransactions
  const stats = walletFilteredTransactions.reduce((acc, tx) => {
    if (tx.type === TRANSACTION_TYPES.GAS) {
      acc.totalGasFees += Math.abs(tx.solChange || 0);
    } else if (tx.type === TRANSACTION_TYPES.SWAP) {
      acc.totalTradingFees += Math.abs(tx.solChange || 0);
      acc.totalSwaps++;
    } else if (tx.type === TRANSACTION_TYPES.TOKEN_TRANSACTION) {
      acc.totalTokenTransactions++;
      if (tx.tokenAction === "Buy") {
        acc.tokenBuys++;
      } else if (tx.tokenAction === "Sell") {
        acc.tokenSells++;
      }
    } else if (tx.isInternalTransfer) {
      acc.totalInternalTransfers++;
    } else if (tx.type === TRANSACTION_TYPES.TRANSFER) {
      if ((tx.solChange || 0) > 0) acc.totalReceived += (tx.solChange || 0);
      else acc.totalSent += Math.abs(tx.solChange || 0);
    }
    return acc;
  }, {
    totalGasFees: 0,
    totalTradingFees: 0,
    totalSwaps: 0,
    totalTokenTransactions: 0,
    tokenBuys: 0,
    tokenSells: 0,
    totalInternalTransfers: 0,
    totalReceived: 0,
    totalSent: 0
  });

  // Prepare chart data - use walletFilteredTransactions
  const chartData = walletFilteredTransactions
    .filter(tx => tx.type !== TRANSACTION_TYPES.GAS)
    .map(tx => ({
      date: new Date((tx.timestamp || 0) * 1000).toLocaleDateString(),
      balance: Number((tx.runningBalance || 0).toFixed(4)),
      volume: Math.abs(tx.solChange || 0)
    }));

  // Transaction helper functions
  const getTransactionColor = (tx) => {
    if (!tx || !tx.transactionType) return "text-geist-accent-900 dark:text-geist-foreground";
    
    const type = tx.transactionType.toLowerCase();
    
    if (type === 'internal_transfer') {
      return "text-purple-600 dark:text-purple-400";
    }
    
    if (type === 'swap') {
      return "text-orange-600 dark:text-orange-400";
    }
    
    if (type === 'token_transfer') {
      if (tx.solChange > 0) {
        return "text-green-600 dark:text-green-400";
      } else if (tx.solChange < 0) {
        return "text-red-600 dark:text-red-400";
      }
    }
    
    if (type === 'transfer') {
      if (tx.solChange > 0) {
        return "text-green-600 dark:text-green-400";
      } else if (tx.solChange < 0) {
        return "text-red-600 dark:text-red-400";
      }
    }
    
    if (type === 'gas_fee') {
      return "text-orange-500 dark:text-orange-400";
    }
    
    return "text-geist-accent-900 dark:text-geist-foreground";
  };
  
  const getTransactionIcon = (tx) => {
    if (!tx || !tx.transactionType) return null;
    
    const type = tx.transactionType.toLowerCase();
    
    if (type === 'internal_transfer') {
      return (
        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    }
    
    if (type === 'swap') {
      return (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (type === 'token_transfer') {
      if (tx.solChange > 0) {
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8l3 5m0 0l3-5m-3 5v4m-3-5h6m-6 3h6m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      } else {
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l3-3m0 0l3 3m-3-3v6m-3-3h6m-6 3h6m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      }
    }
    
    if (type === 'transfer') {
      if (tx.solChange > 0) {
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        );
      } else {
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        );
      }
    }
    
    if (type === 'gas_fee') {
      return (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    }
    
    return (
      <svg className="w-5 h-5 text-geist-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };
  
  const getTransactionDetails = (tx) => {
    if (!tx) return "";
    
    const type = tx.transactionType ? tx.transactionType.toLowerCase() : "";
    
    if (type === 'internal_transfer') {
      if (tx.sourceWalletName && tx.destinationWalletName) {
        return `${tx.sourceWalletName} → ${tx.destinationWalletName}`;
      }
      return "Between your wallets";
    }
    
    if (type === 'swap') {
      if (tx.tokenSymbols && tx.tokenSymbols.length >= 2) {
        return `${tx.tokenSymbols[0]} → ${tx.tokenSymbols[1]}${tx.dex ? ` on ${tx.dex}` : ''}`;
      }
      return tx.dex ? `Swap on ${tx.dex}` : "Token swap";
    }
    
    if (type === 'token_transfer') {
      if (tx.tokenSymbols && tx.tokenSymbols.length > 0) {
        const symbol = tx.tokenSymbols[0] || "Unknown token";
        return tx.solChange > 0 ? `Received ${symbol}` : `Sent ${symbol}`;
      }
      return "Token transaction";
    }
    
    if (type === 'gas_fee') {
      return "Transaction fee";
    }
    
    return "";
  };
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown date";
    
    const txDate = new Date(timestamp * 1000);
    const now = new Date();
    
    // Today
    if (txDate.toDateString() === now.toDateString()) {
      return `Today at ${txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Yesterday
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (txDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Within the last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    if (txDate > oneWeekAgo) {
      const options = { weekday: 'short' };
      return `${txDate.toLocaleDateString(undefined, options)} at ${txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // This year
    if (txDate.getFullYear() === now.getFullYear()) {
      const options = { month: 'short', day: 'numeric' };
      return txDate.toLocaleDateString(undefined, options);
    }
    
    // Previous years
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return txDate.toLocaleDateString(undefined, options);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleDateFilter = () => {
    // Reset pagination
    setCurrentPage(1);
    
    // Apply date filtering logic
    if (!dateRange.from && !dateRange.to) {
      // If both dates are empty, show a message and don't filter
      alert('Please select at least one date to filter by');
      return;
    }
    
    // Create Date objects for comparison
    const fromDate = dateRange.from ? new Date(dateRange.from) : new Date(0); // Jan 1, 1970 if not specified
    const toDate = dateRange.to ? new Date(dateRange.to) : new Date(); // Current date if not specified
    
    // Set end of day for the toDate to include the full day
    toDate.setHours(23, 59, 59, 999);
    
    // Convert to Unix timestamps (seconds)
    const fromTimestamp = Math.floor(fromDate.getTime() / 1000);
    const toTimestamp = Math.floor(toDate.getTime() / 1000);
    
    // Update filter state to remember our date filter
    setFilterState({
      ...filterState,
      dateRange: {
        from: fromTimestamp,
        to: toTimestamp
      }
    });
    
    // Close settings panel
    setShowSettings(false);
  };

  const exportTransactions = (format) => {
    // Create a filtered dataset based on current filters
    let dataToExport = walletFilteredTransactions;
    
    // Apply the transaction type filter if not "all"
    if (filterState.type !== 'all') {
      dataToExport = dataToExport.filter(tx => 
        tx.transactionType && tx.transactionType.toLowerCase() === filterState.type.toLowerCase()
      );
    }
    
    // Apply search query filter if present
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      dataToExport = dataToExport.filter(tx =>
        (tx.signature && tx.signature.toLowerCase().includes(lowerQuery)) ||
        (tx.tokenSymbols && tx.tokenSymbols.some(symbol => symbol && symbol.toLowerCase().includes(lowerQuery))) ||
        (tx.address && tx.address.toLowerCase().includes(lowerQuery))
      );
    }
    
    // Apply date range filter if set
    if (filterState.dateRange) {
      dataToExport = dataToExport.filter(tx => 
        tx.timestamp >= filterState.dateRange.from && 
        tx.timestamp <= filterState.dateRange.to
      );
    }
    
    // Format the data based on the export type
    switch(format) {
      case 'csv':
        exportAsCSV(dataToExport);
        break;
      case 'json':
        exportAsJSON(dataToExport);
        break;
      case 'pdf':
        exportAsPDF(dataToExport);
        break;
      default:
        console.error('Unsupported export format:', format);
    }
    
    // Close settings panel
    setShowSettings(false);
  };
  
  // Helper function to export as CSV
  const exportAsCSV = (data) => {
    // Define CSV header row
    const headers = [
      'Date', 
      'Type', 
      'Amount (SOL)', 
      'Value (USD)', 
      'Balance', 
      'Details', 
      'Transaction ID'
    ];
    
    // Convert transactions to CSV rows
    const rows = data.map(tx => [
      new Date(tx.timestamp * 1000).toLocaleString(),
      tx.transactionType || 'Unknown',
      tx.solChange ? tx.solChange.toFixed(6) : '0.000000',
      tx.valueUSD ? tx.valueUSD.toFixed(2) : '0.00',
      tx.runningBalance ? tx.runningBalance.toFixed(6) : '0.000000',
      getTransactionDetails(tx) || '-',
      tx.signature || '-'
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create a Blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set up and trigger download
    link.setAttribute('href', url);
    link.setAttribute('download', `solana-transactions-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Helper function to export as JSON
  const exportAsJSON = (data) => {
    // Create a formatted JSON object with only the necessary fields
    const formattedData = data.map(tx => ({
      date: new Date(tx.timestamp * 1000).toISOString(),
      type: tx.transactionType || 'Unknown',
      solChange: tx.solChange ? parseFloat(tx.solChange.toFixed(9)) : 0,
      valueUSD: tx.valueUSD ? parseFloat(tx.valueUSD.toFixed(2)) : 0,
      balance: tx.runningBalance ? parseFloat(tx.runningBalance.toFixed(9)) : 0,
      details: getTransactionDetails(tx) || '-',
      signature: tx.signature || '-',
      blockNumber: tx.slot || 0,
      tokenSymbols: tx.tokenSymbols || []
    }));
    
    // Create a Blob and download link
    const blob = new Blob([JSON.stringify(formattedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set up and trigger download
    link.setAttribute('href', url);
    link.setAttribute('download', `solana-transactions-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Helper function to export as PDF (basic implementation)
  const exportAsPDF = (data) => {
    // Alert the user that this feature is coming soon
    alert('PDF export feature is coming soon. Please use CSV or JSON format for now.');
    
    // Future implementation would use a library like jsPDF to generate a PDF file
    // Example:
    // 1. Import jsPDF library 
    // 2. Create a new PDF document
    // 3. Add table with transaction data
    // 4. Save the PDF file
  };

  // Theme handling useEffect hooks are now at the beginning of the component

  return (
    <div className="mt-4 space-y-8">
      {/* Wallet Tabs */}
      <div className="mb-2">
        <div className="flex flex-wrap border-b border-geist-accent-200 dark:border-geist-accent-700">
          <button
            onClick={() => onWalletSelect('all')}
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
              onClick={() => onWalletSelect(address)}
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

      {/* Selected Wallet Stats - Only shown when a specific wallet is selected */}
      {selectedWallet !== 'all' && (
        <div className="bg-geist-accent-50 dark:bg-geist-accent-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-geist-accent-900 dark:text-geist-foreground">
                {walletMap[selectedWallet] || 'Selected Wallet'}
              </h3>
              <p className="text-sm text-geist-accent-600 break-all">{selectedWallet}</p>
            </div>
            <div className="bg-geist-success bg-opacity-10 text-geist-success px-3 py-1 rounded-full text-sm font-medium">
              Active
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Transaction Summary Card */}
        <div className="bg-white dark:bg-geist-accent-800 rounded-xl p-6 shadow-sm border border-geist-accent-200 dark:border-geist-accent-700">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-geist-accent-900 dark:text-geist-foreground">
            <svg className="w-5 h-5 mr-2 text-geist-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Transaction Summary
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-geist-accent-600 dark:text-geist-accent-300">Total Transactions</span>
              <span className="font-medium text-lg">{walletFilteredTransactions.length}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-geist-accent-600 dark:text-geist-accent-300">Token Transactions</span>
              <div className="flex items-center">
                <span className="font-medium text-geist-accent-900 dark:text-geist-foreground">{stats.totalTokenTransactions}</span>
                {stats.totalTokenTransactions > 0 && (
                  <div className="flex ml-2 text-xs">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-l-full">
                      {stats.tokenBuys}
                    </span>
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-r-full">
                      {stats.tokenSells}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-geist-accent-600 dark:text-geist-accent-300">Swaps</span>
              <span className="font-medium">{stats.totalSwaps}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-geist-accent-600 dark:text-geist-accent-300">Internal Transfers</span>
              <span className="font-medium">{stats.totalInternalTransfers}</span>
            </div>
            
            <div className="flex justify-between items-center pt-3 border-t border-geist-accent-200 dark:border-geist-accent-700">
              <span className="text-geist-accent-600 dark:text-geist-accent-300">First Transaction</span>
              <span className="font-medium">
                {walletFilteredTransactions.length > 0 
                  ? new Date(walletFilteredTransactions.sort((a, b) => a.timestamp - b.timestamp)[0].timestamp * 1000).toLocaleDateString() 
                  : 'N/A'
                }
              </span>
            </div>
          </div>
        </div>

        {/* SOL Movements Card */}
        <div className="bg-white dark:bg-geist-accent-800 rounded-xl p-6 shadow-sm border border-geist-accent-200 dark:border-geist-accent-700">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-geist-accent-900 dark:text-geist-foreground">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            SOL Movements
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-geist-accent-600 dark:text-geist-accent-300">Total Received</span>
              <span className="font-medium text-green-500">{(stats.totalReceived || 0).toFixed(4)} SOL</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-geist-accent-600 dark:text-geist-accent-300">Total Sent</span>
              <span className="font-medium text-red-500">{(stats.totalSent || 0).toFixed(4)} SOL</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-geist-accent-600 dark:text-geist-accent-300">Gas Fees</span>
              <span className="font-medium text-orange-500">{(stats.totalGasFees || 0).toFixed(4)} SOL</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-geist-accent-600 dark:text-geist-accent-300">Trading Fees</span>
              <span className="font-medium text-purple-500">{(stats.totalTradingFees || 0).toFixed(4)} SOL</span>
            </div>
            
            <div className="mt-4 pt-3 border-t border-geist-accent-200 dark:border-geist-accent-700">
              <div className="flex justify-between items-center mb-1">
                <span className="text-geist-accent-600 dark:text-geist-accent-300">Net Flow</span>
                <span className={`font-medium ${stats.totalReceived - stats.totalSent > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {((stats.totalReceived || 0) - (stats.totalSent || 0)).toFixed(4)} SOL
                </span>
              </div>
              
              <div className="w-full bg-geist-accent-100 dark:bg-geist-accent-700 rounded-full h-2.5 mt-2">
                <div 
                  className={`h-2.5 rounded-full ${stats.totalReceived - stats.totalSent > 0 
                    ? 'bg-gradient-to-r from-green-300 to-green-500' 
                    : 'bg-gradient-to-r from-red-300 to-red-500'}`} 
                  style={{ 
                    width: `${Math.min(
                      Math.abs(
                        ((stats.totalReceived - stats.totalSent) / 
                        (stats.totalReceived + stats.totalSent || 1)) * 100
                      ), 100)}%` 
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Balance Chart Card */}
        <div className="bg-white dark:bg-geist-accent-800 rounded-xl p-6 shadow-sm border border-geist-accent-200 dark:border-geist-accent-700">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-geist-accent-900 dark:text-geist-foreground">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Balance History
          </h3>
          
          <div className="h-40 relative">
            {chartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-geist-accent-500">
                No balance data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#666" opacity={0.1} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }} 
                    tickFormatter={(value) => {
                      // Abbreviate dates to save space
                      const parts = value.split('/');
                      return parts.length === 3 ? `${parts[0]}/${parts[1]}` : value;
                    }}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#333',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      padding: '8px'
                    }}
                    formatter={(value) => [`${value.toFixed(4)} SOL`, 'Balance']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#0070f3" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#0070f3', stroke: 'white', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          
          {chartData.length > 0 && (
            <div className="flex justify-between mt-4 pt-3 border-t border-geist-accent-200 dark:border-geist-accent-700 text-sm">
              <div className="flex flex-col">
                <span className="text-geist-accent-500">Initial:</span>
                <span className="font-medium">
                  {chartData.length > 0 ? chartData[0].balance.toFixed(4) + ' SOL' : '0 SOL'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-geist-accent-500">Current:</span>
                <span className="font-medium">
                  {chartData.length > 0 ? chartData[chartData.length - 1].balance.toFixed(4) + ' SOL' : '0 SOL'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-geist-accent-500">Change:</span>
                {chartData.length > 0 && (
                  <span className={`font-medium ${
                    chartData[chartData.length - 1].balance - chartData[0].balance > 0 
                      ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {(chartData[chartData.length - 1].balance - chartData[0].balance).toFixed(4)} SOL
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-geist-accent-800 rounded-xl border border-geist-accent-200 dark:border-geist-accent-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-geist-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search transactions by address, signature, token..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                className="pl-10 pr-4 py-2 w-full rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 bg-white dark:bg-geist-accent-800 focus:outline-none focus:ring-2 focus:ring-geist-success"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center md:justify-end gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                setSelectedFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center ${
                selectedFilter === 'all' 
                  ? 'bg-geist-success text-white' 
                  : 'bg-geist-accent-50 dark:bg-geist-accent-700 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-600'
              }`}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              All
            </button>
            <button
              onClick={() => {
                setSelectedFilter('transfers');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center ${
                selectedFilter === 'transfers' 
                  ? 'bg-geist-success text-white' 
                  : 'bg-geist-accent-50 dark:bg-geist-accent-700 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-600'
              }`}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Transfers
            </button>
            <button
              onClick={() => {
                setSelectedFilter('tokens');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center ${
                selectedFilter === 'tokens' 
                  ? 'bg-geist-success text-white' 
                  : 'bg-geist-accent-50 dark:bg-geist-accent-700 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-600'
              }`}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tokens
            </button>
            <button
              onClick={() => {
                setSelectedFilter('swaps');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center ${
                selectedFilter === 'swaps' 
                  ? 'bg-geist-success text-white' 
                  : 'bg-geist-accent-50 dark:bg-geist-accent-700 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-600'
              }`}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Swaps
            </button>
            <button
              onClick={() => {
                setSelectedFilter('internal');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center ${
                selectedFilter === 'internal' 
                  ? 'bg-geist-success text-white' 
                  : 'bg-geist-accent-50 dark:bg-geist-accent-700 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-600'
              }`}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Internal
            </button>
            <button
              onClick={() => {
                setSelectedFilter('fees');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center ${
                selectedFilter === 'fees' 
                  ? 'bg-geist-success text-white' 
                  : 'bg-geist-accent-50 dark:bg-geist-accent-700 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-600'
              }`}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Fees
            </button>
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-geist-accent-200 dark:border-geist-accent-700">
          <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
            <span className="font-medium">{allProcessedTransactions.length}</span> transactions found
            {selectedFilter !== 'all' && <span> in <span className="font-medium">{selectedFilter}</span> category</span>}
            {searchQuery && <span> matching "<span className="font-medium">{searchQuery}</span>"</span>}
            {selectedWallet !== 'all' && <span> for <span className="font-medium">{walletMap[selectedWallet] || 'selected wallet'}</span></span>}
          </div>
          
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-geist-accent-600 dark:text-geist-accent-300">Show:</span>
            <select 
              value={pageSize} 
              onChange={(e) => {
                const newSize = parseInt(e.target.value);
                setPageSize(newSize);
                setCurrentPage(1); // Reset to first page when changing page size
              }}
              className="px-2 py-1 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 bg-white dark:bg-geist-accent-800 text-sm"
            >
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
            
            <button
              onClick={() => {
                // Export CSV function
                const headers = ['Type', 'Date', 'Amount (SOL)', 'Value (USD)', 'Balance', 'Details'];
                const csvContent = [
                  headers.join(','),
                  ...allProcessedTransactions.map(tx => {
                    const type = tx ? categorizeTransaction(tx) : 'Unknown Transaction';
                    const date = tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : 'Unknown';
                    const amount = tx.solChange ? tx.solChange.toFixed(4) : '0';
                    const valueUSD = tx.valueUSD ? Math.abs(tx.valueUSD).toFixed(2) : '0';
                    const balance = tx.runningBalance ? tx.runningBalance.toFixed(4) : '0';
                    let details = '';
                    if (tx.isInternalTransfer) {
                      details = `Internal Transfer: ${tx.sourceWalletName || 'Unknown'} → ${tx.destinationWalletName || 'Unknown'}`;
                    } else {
                      details = tx.signature || '';
                    }
                    
                    return [type, date, amount, valueUSD, balance, details].join(',');
                  })
                ].join('\n');
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `transactions_${new Date().toISOString().slice(0, 10)}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3 py-1.5 bg-geist-accent-50 dark:bg-geist-accent-700 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-600 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Settings button */}
      <div className="relative">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center rounded-full p-2 bg-geist-accent-100 dark:bg-geist-accent-700 text-geist-accent-700 dark:text-geist-accent-300 hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 transition-colors"
          aria-label="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {showSettings && (
          <div className="absolute right-0 mt-2 z-10 bg-white dark:bg-geist-accent-800 rounded-xl shadow-lg py-2 px-4 w-80 border border-geist-accent-200 dark:border-geist-accent-700 text-geist-accent-900 dark:text-geist-foreground">
            <div className="flex justify-between items-center border-b border-geist-accent-200 dark:border-geist-accent-700 pb-2 mb-3">
              <h3 className="font-semibold">Dashboard Settings</h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-geist-accent-500 hover:text-geist-accent-700 dark:hover:text-geist-accent-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Display Section */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300">Display Settings</h4>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm flex items-center">
                    <span>Show USD Values</span>
                  </label>
                  <div className="relative inline-block w-10 align-middle select-none">
                    <input 
                      type="checkbox" 
                      id="showUsd" 
                      name="showUsd" 
                      checked={showUsdValues}
                      onChange={() => setShowUsdValues(!showUsdValues)}
                      className="sr-only"
                    />
                    <div className={`block w-10 h-6 rounded-full ${showUsdValues ? 'bg-blue-500' : 'bg-geist-accent-300 dark:bg-geist-accent-600'} transition-colors`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform ${showUsdValues ? 'translate-x-4' : ''}`}></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm flex items-center">
                    <span>Show Running Balance</span>
                  </label>
                  <div className="relative inline-block w-10 align-middle select-none">
                    <input 
                      type="checkbox" 
                      id="showBalance" 
                      name="showBalance" 
                      checked={showBalance}
                      onChange={() => setShowBalance(!showBalance)}
                      className="sr-only"
                    />
                    <div className={`block w-10 h-6 rounded-full ${showBalance ? 'bg-blue-500' : 'bg-geist-accent-300 dark:bg-geist-accent-600'} transition-colors`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform ${showBalance ? 'translate-x-4' : ''}`}></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm flex items-center">
                    <span>Compact View</span>
                  </label>
                  <div className="relative inline-block w-10 align-middle select-none">
                    <input 
                      type="checkbox" 
                      id="compactView" 
                      name="compactView" 
                      checked={compactView}
                      onChange={() => setCompactView(!compactView)}
                      className="sr-only"
                    />
                    <div className={`block w-10 h-6 rounded-full ${compactView ? 'bg-blue-500' : 'bg-geist-accent-300 dark:bg-geist-accent-600'} transition-colors`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform ${compactView ? 'translate-x-4' : ''}`}></div>
                  </div>
                </div>
              </div>
              
              {/* Date Range Section */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300">Date Range</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-geist-accent-500">From Date</label>
                    <input 
                      type="date" 
                      className="w-full p-1.5 text-sm border border-geist-accent-200 dark:border-geist-accent-700 rounded bg-white dark:bg-geist-accent-900 text-geist-accent-900 dark:text-geist-foreground"
                      value={dateRange.from}
                      onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-geist-accent-500">To Date</label>
                    <input 
                      type="date" 
                      className="w-full p-1.5 text-sm border border-geist-accent-200 dark:border-geist-accent-700 rounded bg-white dark:bg-geist-accent-900 text-geist-accent-900 dark:text-geist-foreground"
                      value={dateRange.to}
                      onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-1">
                  <button 
                    className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    onClick={() => {
                      // Apply date filter to transactions
                      handleDateFilter();
                    }}
                  >
                    Apply Dates
                  </button>
                </div>
              </div>
              
              {/* Export Section */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300">Export Data</h4>
                <div className="flex space-x-2">
                  <button 
                    className="text-xs flex-1 px-2 py-1.5 bg-geist-accent-100 dark:bg-geist-accent-700 rounded hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 transition-colors flex items-center justify-center"
                    onClick={() => exportTransactions('csv')}
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    CSV
                  </button>
                  <button 
                    className="text-xs flex-1 px-2 py-1.5 bg-geist-accent-100 dark:bg-geist-accent-700 rounded hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 transition-colors flex items-center justify-center"
                    onClick={() => exportTransactions('json')}
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    JSON
                  </button>
                  <button 
                    className="text-xs flex-1 px-2 py-1.5 bg-geist-accent-100 dark:bg-geist-accent-700 rounded hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 transition-colors flex items-center justify-center"
                    onClick={() => exportTransactions('pdf')}
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    PDF
                  </button>
                </div>
              </div>
              
              {/* Theme Setting */}
              <div className="space-y-2 pt-2 border-t border-geist-accent-200 dark:border-geist-accent-700">
                <h4 className="text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300">Theme</h4>
                <div className="flex space-x-2">
                  <button 
                    className={`text-xs flex-1 px-2 py-1.5 rounded transition-colors flex items-center justify-center ${
                      theme === 'light' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-geist-accent-100 dark:bg-geist-accent-700 hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600'
                    }`}
                    onClick={() => setTheme('light')}
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Light
                  </button>
                  <button 
                    className={`text-xs flex-1 px-2 py-1.5 rounded transition-colors flex items-center justify-center ${
                      theme === 'dark' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-geist-accent-100 dark:bg-geist-accent-700 hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600'
                    }`}
                    onClick={() => setTheme('dark')}
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Dark
                  </button>
                  <button 
                    className={`text-xs flex-1 px-2 py-1.5 rounded transition-colors flex items-center justify-center ${
                      theme === 'system' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-geist-accent-100 dark:bg-geist-accent-700 hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600'
                    }`}
                    onClick={() => setTheme('system')}
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    System
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto rounded-xl border border-geist-accent-200 dark:border-geist-accent-700 bg-white dark:bg-geist-accent-800 shadow-sm">
        <table className="min-w-full">
          <thead>
            <tr className="text-left border-b border-geist-accent-200 dark:border-geist-accent-700">
              <th className="pl-4 py-3 font-semibold text-geist-accent-900 dark:text-geist-foreground cursor-pointer" onClick={() => handleSort('transactionType')}>
                Type {getSortIcon('transactionType')}
              </th>
              <th className="py-3 font-semibold text-geist-accent-900 dark:text-geist-foreground cursor-pointer" onClick={() => handleSort('timestamp')}>
                Date {getSortIcon('timestamp')}
              </th>
              <th className="py-3 font-semibold text-geist-accent-900 dark:text-geist-foreground cursor-pointer" onClick={() => handleSort('solChange')}>
                Amount (SOL) {getSortIcon('solChange')}
              </th>
              {showUsdValues && (
                <th className="py-3 font-semibold text-geist-accent-900 dark:text-geist-foreground cursor-pointer" onClick={() => handleSort('valueUSD')}>
                  Value (USD) {getSortIcon('valueUSD')}
                </th>
              )}
              {showBalance && (
                <th className="py-3 font-semibold text-geist-accent-900 dark:text-geist-foreground cursor-pointer" onClick={() => handleSort('runningBalance')}>
                  Balance {getSortIcon('runningBalance')}
                </th>
              )}
              <th className="pr-4 py-3 text-right font-semibold text-geist-accent-900 dark:text-geist-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map((tx, index) => (
              <tr 
                key={tx.signature || index} 
                className={`
                  ${index % 2 === 0 ? 'bg-white dark:bg-geist-accent-800' : 'bg-geist-accent-100 dark:bg-geist-accent-900'} 
                  ${compactView ? 'h-10' : 'h-14'}
                  cursor-pointer hover:bg-geist-accent-200 dark:hover:bg-geist-accent-700 transition-colors
                `}
                onClick={() => window.open(`https://solscan.io/tx/${tx.signature}`, '_blank')}
              >
                {/* Transaction Type */}
                <td className={`pl-4 ${compactView ? 'py-1' : 'py-3'}`}>
                  <div className="flex items-center">
                    <div className="mr-2">
                      {getTransactionIcon(tx)}
                    </div>
                    <div>
                      <div className={`flex items-center ${getTransactionColor(tx)}`}>
                        <span className={`font-medium ${compactView ? 'text-sm' : ''}`}>
                          {tx.transactionType || 'Unknown'}
                        </span>
                      </div>
                      {!compactView && (
                        <div className="text-xs text-geist-accent-500 mt-0.5">
                          {getTransactionDetails(tx)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                
                {/* Date */}
                <td className={`${compactView ? 'py-1' : 'py-3'}`}>
                  <div className={`${compactView ? 'text-sm' : ''}`}>
                    {formatTimestamp(tx.timestamp)}
                  </div>
                  {!compactView && tx.slot && (
                    <div className="text-xs text-geist-accent-500">
                      Block: {tx.slot.toLocaleString()}
                    </div>
                  )}
                </td>
                
                {/* Amount (SOL) */}
                <td className={`${compactView ? 'py-1' : 'py-3'}`}>
                  <div className={`font-medium ${getTransactionColor(tx)} ${compactView ? 'text-sm' : ''}`}>
                    {tx.solChange 
                      ? (tx.solChange > 0 ? '+' : '') + tx.solChange.toFixed(6) 
                      : '0.000000'
                    }
                  </div>
                </td>
                
                {/* Value (USD) */}
                {showUsdValues && (
                  <td className={`${compactView ? 'py-1' : 'py-3'}`}>
                    <div className={`${getTransactionColor(tx)} ${compactView ? 'text-sm' : ''}`}>
                      {tx.valueUSD 
                        ? (tx.valueUSD > 0 ? '+$' : '-$') + Math.abs(tx.valueUSD).toFixed(2)
                        : '$0.00'
                      }
                    </div>
                  </td>
                )}
                
                {/* Running Balance */}
                {showBalance && (
                  <td className={`${compactView ? 'py-1' : 'py-3'}`}>
                    <div className={`${compactView ? 'text-sm' : ''}`}>
                      {tx.runningBalance 
                        ? tx.runningBalance.toFixed(6)
                        : '0.000000'
                      }
                    </div>
                  </td>
                )}
                
                {/* Actions/Details */}
                <td className={`pr-4 text-right ${compactView ? 'py-1' : 'py-3'}`}>
                  <a
                    href={`https://solscan.io/tx/${tx.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 inline-flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className={`${compactView ? 'text-xs' : 'text-sm'}`}>View</span>
                    <svg className={`w-4 h-4 ml-1 ${compactView ? 'w-3 h-3' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {allProcessedTransactions.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-geist-accent-800 rounded-xl border border-geist-accent-200 dark:border-geist-accent-700">
          <svg className="w-16 h-16 text-geist-accent-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-geist-accent-800 dark:text-geist-accent-200 mb-2">No Transactions Found</h3>
          <p className="text-geist-accent-500 max-w-md mx-auto">
            No transactions match your current filters. Try changing your search criteria or selecting a different wallet.
          </p>
        </div>
      )}

      {/* Pagination Controls - Updated */}
      {allProcessedTransactions.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 bg-white dark:bg-geist-accent-800 rounded-xl border border-geist-accent-200 dark:border-geist-accent-700 px-4 py-3">
          <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-4 sm:mb-0">
            Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{endIndex}</span> of <span className="font-medium">{allProcessedTransactions.length}</span> transactions
          </div>
          
          <div className="flex justify-center items-center space-x-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded-md border border-geist-accent-200 dark:border-geist-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              aria-label="First page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded-md border border-geist-accent-200 dark:border-geist-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              aria-label="Previous page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around current page
              let pageToShow;
              if (totalPages <= 5) {
                pageToShow = i + 1; // Show all pages if 5 or fewer
              } else if (currentPage <= 3) {
                pageToShow = i + 1; // Show first 5 pages
              } else if (currentPage >= totalPages - 2) {
                pageToShow = totalPages - 4 + i; // Show last 5 pages
              } else {
                pageToShow = currentPage - 2 + i; // Show 2 before and 2 after current
              }
              
              return (
                <button
                  key={pageToShow}
                  onClick={() => handlePageChange(pageToShow)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-200 text-sm ${
                    currentPage === pageToShow
                      ? 'bg-geist-success text-white font-medium'
                      : 'text-geist-accent-600 dark:text-geist-accent-300 hover:bg-geist-accent-100 dark:hover:bg-geist-accent-700'
                  }`}
                  aria-label={`Page ${pageToShow}`}
                  aria-current={currentPage === pageToShow ? 'page' : undefined}
                >
                  {pageToShow}
                </button>
              );
            })}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded-md border border-geist-accent-200 dark:border-geist-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              aria-label="Next page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded-md border border-geist-accent-200 dark:border-geist-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              aria-label="Last page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionDashboard;