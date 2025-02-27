import React, { useState } from 'react';
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

  console.log('TransactionDashboard rendered with transactions:', transactions);

  // Filter transactions by selected wallet
  const walletFilteredTransactions = selectedWallet === 'all' 
    ? transactions 
    : transactions.filter(tx => tx.sourceWallet === selectedWallet || tx.destinationWallet === selectedWallet);

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

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
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

  const renderTransactionRow = (tx) => {
    const getTransactionColor = () => {
      if (!tx || tx.type === undefined) return 'text-geist-accent-500';
      
      if (tx.isInternalTransfer) {
        return 'text-blue-500 dark:text-blue-400';
      }
      
      switch (tx.type) {
        case TRANSACTION_TYPES.SWAP:
          return 'text-purple-500 dark:text-purple-400';
        case TRANSACTION_TYPES.TOKEN_TRANSACTION:
          return tx.tokenAction === "Buy" 
            ? 'text-green-500 dark:text-green-400'
            : 'text-red-500 dark:text-red-400';
        case TRANSACTION_TYPES.GAS:
          return 'text-orange-500 dark:text-orange-400';
        default:
          return (tx.solChange || 0) > 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';
      }
    };

    const getTransactionDetails = () => {
      if (!tx) return '';
      if (tx.type === TRANSACTION_TYPES.GAS) return 'Network Fee';
      if (tx.type === TRANSACTION_TYPES.SWAP || tx.type === TRANSACTION_TYPES.TOKEN_TRANSACTION) {
        const dex = tx.dex || (tx.programId && DEX_PROGRAMS[tx.programId]) || 'Unknown DEX';
        const tokenInfo = tx.tokenInfo?.symbol ? ` - ${tx.tokenInfo.symbol}` : '';
        return `${dex}${tokenInfo}`;
      }
      return '';
    };

    return (
      <tr key={tx.signature} className="border-b dark:border-geist-accent-700 hover:bg-geist-accent-50 dark:hover:bg-geist-accent-700">
        <td className="py-4 px-6">
          <div className="flex flex-col">
            <span className={`font-medium ${getTransactionColor()}`}>
              {tx ? categorizeTransaction(tx) : 'Unknown Transaction'}
            </span>
            <span className="text-sm text-geist-accent-500">
              {getTransactionDetails()}
            </span>
          </div>
        </td>
        <td className="py-4 px-6">
          {tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'Unknown date'}
        </td>
        <td className="py-4 px-6">
          <span className={getTransactionColor()}>
            {tx.solChange > 0 ? '+' : ''}{(tx.solChange || 0).toFixed(4)} SOL
          </span>
        </td>
        <td className="py-4 px-6">
          ${Math.abs(tx.valueUSD || 0).toFixed(2)}
        </td>
        <td className="py-4 px-6">
          {(tx.runningBalance || 0).toFixed(4)} SOL
        </td>
        <td className="py-4 px-6">
          <div className="flex flex-col space-y-1">
            {tx.isInternalTransfer ? (
              <>
                <span className="text-sm text-geist-accent-700 dark:text-geist-accent-300">
                  From: <span className="font-medium">{tx.sourceWalletName || 'Unknown'}</span>
                  <span className="text-xs text-geist-accent-500"> ({tx.sourceWallet ? `${tx.sourceWallet.slice(0, 4)}...${tx.sourceWallet.slice(-4)}` : 'Unknown'})</span>
                </span>
                <span className="text-sm text-geist-accent-700 dark:text-geist-accent-300">
                  To: <span className="font-medium">{tx.destinationWalletName || 'Unknown'}</span>
                  <span className="text-xs text-geist-accent-500"> ({tx.destinationWallet ? `${tx.destinationWallet.slice(0, 4)}...${tx.destinationWallet.slice(-4)}` : 'Unknown'})</span>
                </span>
              </>
            ) : (
              <a
                href={`https://solscan.io/tx/${tx.signature || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-geist-accent-500 hover:underline"
              >
                {tx.signature ? `${tx.signature.slice(0, 8)}...${tx.signature.slice(-8)}` : 'Unknown'}
              </a>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-geist-accent-50 dark:bg-geist-accent-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Transaction Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Token Transactions:</span>
              <span className="font-medium">{stats.totalTokenTransactions}</span>
            </div>
            <div className="flex justify-between">
              <span>Token Buys:</span>
              <span className="font-medium text-green-500">{stats.tokenBuys}</span>
            </div>
            <div className="flex justify-between">
              <span>Token Sells:</span>
              <span className="font-medium text-red-500">{stats.tokenSells}</span>
            </div>
            <div className="flex justify-between">
              <span>Internal Transfers:</span>
              <span className="font-medium">{stats.totalInternalTransfers}</span>
            </div>
          </div>
        </div>

        <div className="bg-geist-accent-50 dark:bg-geist-accent-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">SOL Movements</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Received:</span>
              <span className="font-medium text-green-500">{(stats.totalReceived || 0).toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Total Sent:</span>
              <span className="font-medium text-red-500">{(stats.totalSent || 0).toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Total Fees:</span>
              <span className="font-medium text-orange-500">{((stats.totalGasFees || 0) + (stats.totalTradingFees || 0)).toFixed(4)} SOL</span>
            </div>
          </div>
        </div>

        <div className="bg-geist-accent-50 dark:bg-geist-accent-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Balance Chart</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#666" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#333',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#0070f3" 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              selectedFilter === 'all' 
                ? 'bg-geist-accent-900 dark:bg-geist-accent-100 text-white dark:text-geist-accent-900' 
                : 'bg-geist-accent-200 dark:bg-geist-accent-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedFilter('transfers')}
            className={`px-4 py-2 rounded-lg ${
              selectedFilter === 'transfers' 
                ? 'bg-geist-accent-900 dark:bg-geist-accent-100 text-white dark:text-geist-accent-900' 
                : 'bg-geist-accent-200 dark:bg-geist-accent-700'
            }`}
          >
            Transfers
          </button>
          <button
            onClick={() => setSelectedFilter('tokens')}
            className={`px-4 py-2 rounded-lg ${
              selectedFilter === 'tokens' 
                ? 'bg-geist-accent-900 dark:bg-geist-accent-100 text-white dark:text-geist-accent-900' 
                : 'bg-geist-accent-200 dark:bg-geist-accent-700'
            }`}
          >
            Tokens
          </button>
          <button
            onClick={() => setSelectedFilter('swaps')}
            className={`px-4 py-2 rounded-lg ${
              selectedFilter === 'swaps' 
                ? 'bg-geist-accent-900 dark:bg-geist-accent-100 text-white dark:text-geist-accent-900' 
                : 'bg-geist-accent-200 dark:bg-geist-accent-700'
            }`}
          >
            Swaps
          </button>
          <button
            onClick={() => setSelectedFilter('internal')}
            className={`px-4 py-2 rounded-lg ${
              selectedFilter === 'internal' 
                ? 'bg-geist-accent-900 dark:bg-geist-accent-100 text-white dark:text-geist-accent-900' 
                : 'bg-geist-accent-200 dark:bg-geist-accent-700'
            }`}
          >
            Internal
          </button>
          <button
            onClick={() => setSelectedFilter('fees')}
            className={`px-4 py-2 rounded-lg ${
              selectedFilter === 'fees' 
                ? 'bg-geist-accent-900 dark:bg-geist-accent-100 text-white dark:text-geist-accent-900' 
                : 'bg-geist-accent-200 dark:bg-geist-accent-700'
            }`}
          >
            Fees
          </button>
        </div>
        <input
          type="text"
          placeholder="Search by address, signature, or token..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 bg-white dark:bg-geist-accent-800"
        />
      </div>

      {/* Transaction Info Bar */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-geist-accent-600 dark:text-geist-accent-300">
          Showing {startIndex + 1}-{endIndex} of {allProcessedTransactions.length} transactions
          {selectedWallet !== 'all' && (
            <span> for {walletMap[selectedWallet] || 'selected wallet'}</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-geist-accent-600 dark:text-geist-accent-300">
            Show:
          </label>
          <select 
            value={pageSize} 
            onChange={handlePageSizeChange}
            className="px-2 py-1 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 bg-white dark:bg-geist-accent-800"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-geist-accent-100 dark:bg-geist-accent-700">
              <th 
                className="px-6 py-3 text-left cursor-pointer hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600"
                onClick={() => handleSort('type')}
              >
                Type
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600"
                onClick={() => handleSort('timestamp')}
              >
                Date
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600"
                onClick={() => handleSort('solChange')}
              >
                Amount (SOL)
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600"
                onClick={() => handleSort('valueUSD')}
              >
                Value (USD)
              </th>
              <th 
                className="px-6 py-3 text-left cursor-pointer hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600"
                onClick={() => handleSort('runningBalance')}
              >
                Balance
              </th>
              <th className="px-6 py-3 text-left">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map(renderTransactionRow)}
          </tbody>
        </table>
      </div>

      {allProcessedTransactions.length === 0 && (
        <div className="text-center py-8 text-geist-accent-500">
          No transactions found matching your criteria
        </div>
      )}

      {/* Pagination Controls */}
      {allProcessedTransactions.length > 0 && (
        <div className="flex justify-center mt-6 space-x-2">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 disabled:opacity-50"
          >
            First
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 disabled:opacity-50"
          >
            Prev
          </button>
          
          <div className="flex items-center px-4">
            <span className="text-geist-accent-600 dark:text-geist-accent-300">
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 disabled:opacity-50"
          >
            Next
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 disabled:opacity-50"
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionDashboard;