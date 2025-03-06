import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Network configurations
const SUPPORTED_NETWORKS = [
  {
    id: 'solana',
    name: 'Solana',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 128 128">
        <path
          fill="currentColor"
          d="M93.94 42.63H44.82a2.45 2.45 0 0 1-1.72-.71l-7.58-7.58a2.43 2.43 0 0 1 1.71-4.15h49.12a2.4 2.4 0 0 1 1.72.71l7.58 7.58a2.43 2.43 0 0 1-1.71 4.15zm0 27.55H44.82a2.45 2.45 0 0 1-1.72-.71l-7.58-7.58a2.43 2.43 0 0 1 1.71-4.15h49.12a2.4 2.4 0 0 1 1.72.71l7.58 7.58a2.43 2.43 0 0 1-1.71 4.15zm0 27.54H44.82a2.45 2.45 0 0 1-1.72-.71l-7.58-7.58a2.43 2.43 0 0 1 1.71-4.15h49.12a2.4 2.4 0 0 1 1.72.71l7.58 7.58a2.43 2.43 0 0 1-1.71 4.15z"
        />
      </svg>
    ),
    placeholder: 'Enter Solana wallet address',
    validateAddress: (address) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  },
  {
    id: 'coming-soon',
    name: 'More coming soon...',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    ),
    placeholder: '',
    validateAddress: () => false,
    disabled: true
  }
];

const WalletsPage = ({
  formData,
  setFormData,
  handleWalletNameChange,
  loading,
  loadingProgress,
  walletProcessingStatus,
  queueWalletForProcessing,
  saveWalletAndPull,
  removeWallet,
  walletSaving,
  activeWalletIndex,
  validateWalletAddress
}) => {
  const { user: authUser } = useAuth();
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState(SUPPORTED_NETWORKS[0]);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletName, setNewWalletName] = useState('');
  const [error, setError] = useState('');
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const networkDropdownRef = useRef(null);

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target)) {
        setShowNetworkDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAddWallet = async () => {
    if (!selectedNetwork.validateAddress(newWalletAddress)) {
      setError('Invalid wallet address for selected network');
      return;
    }

    if (!newWalletName.trim()) {
      setError('Please enter a wallet name');
      return;
    }

    try {
      // Add to formData first
      const updatedAddresses = [...formData.walletAddresses, newWalletAddress];
      const updatedNames = [...formData.walletNames, newWalletName];
      
      setFormData({
        ...formData,
        walletAddresses: updatedAddresses,
        walletNames: updatedNames
      });

      // Reset form and close popup immediately
      setNewWalletAddress('');
      setNewWalletName('');
      setError('');
      setShowAddWallet(false);

      // Save to database after popup is closed
      if (authUser) {
        await saveWalletAndPull(newWalletAddress, newWalletName, updatedAddresses.length - 1);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Section */}
      <div className="space-y-4 sm:space-y-0 sm:flex sm:justify-between sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-geist-accent-900 dark:text-geist-foreground">
            Wallet Management
          </h1>
          <p className="mt-2 text-geist-accent-600 dark:text-geist-accent-300">
            Manage your crypto wallets across different networks
          </p>
        </div>
        <button
          onClick={() => setShowAddWallet(true)}
          className="w-full sm:w-auto px-4 py-2 bg-geist-success text-white rounded-xl font-medium hover:bg-opacity-90 transition-all flex items-center justify-center sm:justify-start"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Wallet
        </button>
      </div>

      {/* Add Wallet Modal */}
      {showAddWallet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div 
            className="bg-white dark:bg-geist-accent-800 rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all duration-300 scale-100 animate-scale-up border border-geist-accent-200/50 dark:border-geist-accent-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                Add New Wallet
              </h2>
              <button
                onClick={() => {
                  setShowAddWallet(false);
                  setError('');
                }}
                className="text-geist-accent-500 hover:text-geist-accent-700 dark:text-geist-accent-400 dark:hover:text-geist-accent-200 p-1 rounded-lg hover:bg-geist-accent-100 dark:hover:bg-geist-accent-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Network Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                Select Network
              </label>
              <div className="relative" ref={networkDropdownRef}>
                <button
                  onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                  className="w-full flex items-center justify-between p-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-700 rounded-xl focus:ring-2 focus:ring-geist-success focus:border-transparent"
                >
                  <div className="flex items-center">
                    <span className="mr-2 text-geist-accent-500 dark:text-geist-accent-400">
                      {selectedNetwork.icon}
                    </span>
                    <span className="font-medium text-geist-accent-900 dark:text-geist-foreground">
                      {selectedNetwork.name}
                    </span>
                  </div>
                  <svg className="w-5 h-5 text-geist-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showNetworkDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-700 rounded-xl shadow-lg">
                    {SUPPORTED_NETWORKS.map(network => (
                      <button
                        key={network.id}
                        onClick={() => {
                          if (!network.disabled) {
                            setSelectedNetwork(network);
                            setShowNetworkDropdown(false);
                          }
                        }}
                        disabled={network.disabled}
                        className={`w-full flex items-center p-3 hover:bg-geist-accent-50 dark:hover:bg-geist-accent-700 ${
                          network.disabled ? 'opacity-50 cursor-not-allowed' : ''
                        } ${selectedNetwork.id === network.id ? 'bg-geist-accent-50 dark:bg-geist-accent-700' : ''}`}
                      >
                        <span className="mr-2 text-geist-accent-500 dark:text-geist-accent-400">
                          {network.icon}
                        </span>
                        <span className="font-medium text-geist-accent-900 dark:text-geist-foreground">
                          {network.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Wallet Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                Wallet Name
              </label>
              <input
                type="text"
                value={newWalletName}
                onChange={(e) => setNewWalletName(e.target.value)}
                className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success transition-colors"
                placeholder="Enter a name for this wallet"
              />
            </div>

            {/* Wallet Address Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                Wallet Address
              </label>
              <input
                type="text"
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success transition-colors"
                placeholder={selectedNetwork.placeholder}
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleAddWallet}
              className="w-full px-4 py-3 bg-geist-success text-white rounded-xl font-medium hover:bg-opacity-90 transition-all"
            >
              Add Wallet
            </button>
          </div>
        </div>
      )}

      {/* Wallets Grid */}
      {formData.walletAddresses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {formData.walletAddresses.map((address, index) => (
            <div
              key={index}
              className="bg-white dark:bg-geist-accent-800 rounded-2xl border border-geist-accent-200 dark:border-geist-accent-700 p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-medium text-geist-accent-900 dark:text-geist-foreground">
                    {formData.walletNames[index]}
                  </h3>
                  <p className="text-sm text-geist-accent-500 dark:text-geist-accent-400 mt-1">
                    {address.slice(0, 4)}...{address.slice(-4)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(address);
                    }}
                    className="p-2 text-geist-accent-500 hover:text-geist-accent-700 dark:text-geist-accent-400 dark:hover:text-geist-accent-200"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeWallet(index)}
                    className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center">
                  <span className="mr-2 text-geist-accent-500 dark:text-geist-accent-400">
                    {SUPPORTED_NETWORKS[0].icon}
                  </span>
                  <span className="text-sm font-medium text-geist-accent-900 dark:text-geist-foreground">
                    Solana
                  </span>
                </div>
                
                {walletProcessingStatus.currentWallet === address ? (
                  <span className="text-sm text-geist-accent-500 dark:text-geist-accent-400 flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing
                  </span>
                ) : walletProcessingStatus.queuedWallets.includes(address) ? (
                  <span className="text-sm text-geist-accent-500 dark:text-geist-accent-400">
                    Queued
                  </span>
                ) : walletProcessingStatus.completedWallets.includes(address) ? (
                  <span className="text-sm text-green-500 dark:text-green-400 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Synced
                  </span>
                ) : (
                  <button
                    onClick={() => queueWalletForProcessing(address)}
                    className="text-sm text-geist-success hover:text-geist-success/90"
                  >
                    Sync Now
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 px-4 bg-white dark:bg-geist-accent-800 rounded-2xl border border-geist-accent-200 dark:border-geist-accent-700">
          <h3 className="text-lg font-medium text-geist-accent-900 dark:text-geist-foreground mb-2">
            No wallets connected
          </h3>
          <p className="text-geist-accent-600 dark:text-geist-accent-300">
            Click the "Add Wallet" button above to start tracking your crypto transactions
          </p>
        </div>
      )}

      {/* Loading Progress */}
      {loading && (
        <div className="mt-8 bg-white dark:bg-geist-accent-800 rounded-2xl border border-geist-accent-200 dark:border-geist-accent-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
              {loadingProgress.status}
            </span>
            <span className="text-sm font-medium text-geist-accent-900 dark:text-geist-foreground">
              {Math.round(loadingProgress.progress)}%
            </span>
          </div>
          <div className="w-full bg-geist-accent-200 dark:bg-geist-accent-700 rounded-full h-2">
            <div
              className="bg-geist-success h-2 rounded-full transition-all duration-500"
              style={{ width: `${loadingProgress.progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletsPage; 