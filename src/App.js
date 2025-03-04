import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// Add CSS import for animations if not already included in your app
import './styles/animations.css';
import './App.css';

import LandingPage from './components/LandingPage';
import UserInformationPage from './components/UserInformationPage';
import { useAuth } from './contexts/AuthContext';
import AppLayout from './components/AppLayout';

// Add these imports at the top of your file
import { 
  TRANSACTION_TYPES,
  categorizeTransaction, 
  calculateVolume, 
  calculateGasFees,
  calculateUniqueTokens,
  groupTransactions 
} from './utils/transactionUtils';

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

import calculateTaxes from './calculateTaxes';

import priceService from './services/priceService';

import TransactionDashboard from './components/TransactionDashboard.js';

import { getUserWallets, saveTransactions } from './services/databaseService';

import throttledQueue from 'throttled-queue';

import tokenRegistryService from './services/tokenRegistryService';

// At the top of the file with the other imports, add:
import { getConnection, validateWalletAddress, resetConnection, executeWithRetry, checkHeliusHealth } from './services/solanaConnectionService';

// Add Supabase client import
import { supabase } from './supabaseClient';

import WalletsPage from './components/WalletsPage';

const CACHE_KEY_PREFIX = 'solana_tx_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Helius API Configuration
const HELIUS_API_KEY = '268519a5-accf-40b1-9fe3-d0d61fe3a5ce';
const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';
const HELIUS_RPC_URL = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;

// Make the endpoint available globally for the connection service
window.SOLANA_RPC_ENDPOINT = HELIUS_RPC_URL;

// Debug mode - set to true to enable additional logging
const DEBUG_MODE = true;

// Constants
const RATE_LIMIT = {
  REQUEST_DELAY: 50,    // Reduce from 100ms to 50ms
  BATCH_DELAY: 500,     // Reduce from 1000ms to 500ms
  MAX_RETRIES: 5,
  BATCH_SIZE: 50        // Increase from 10 to 50
};

// RPC throttler for rate limiting
const rpcThrottler = (() => {
  let lastCall = 0;
  return async (fn) => {
    const now = Date.now();
    const timeToWait = Math.max(0, RATE_LIMIT.REQUEST_DELAY - (now - lastCall));
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    lastCall = Date.now();
    return fn();
  };
})();

function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="fixed top-4 right-4 p-2 rounded-lg bg-geist-accent-200 dark:bg-geist-accent-700 hover:opacity-90 transition-all"
    >
      {darkMode ? '🌞' : '🌙'}
    </button>
  );
}

function WalletInputs({ walletAddresses, onChange }) {
  const addWallet = () => {
    onChange([...walletAddresses, '']);
  };

  const removeWallet = (index) => {
    const updated = walletAddresses.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateWallet = (index, value) => {
    const updated = walletAddresses.map((addr, i) => 
      i === index ? value : addr
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {walletAddresses.map((address, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => updateWallet(index, e.target.value)}
            className="input"
            placeholder="Solana Wallet Address"
          />
          {index > 0 && (
            <button
              onClick={() => removeWallet(index)}
              className="btn btn-secondary"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button onClick={addWallet} className="btn btn-primary">
        Add Wallet
      </button>
    </div>
  );
}

// Add validateConnection function before the App component
const validateConnection = async () => {
  try {
    if (!HELIUS_RPC_URL) {
      throw new Error('Helius RPC URL not configured');
    }

    const connection = new Connection(HELIUS_RPC_URL);
    const blockHeight = await connection.getBlockHeight();
    console.log(`Connection validated successfully. Block height: ${blockHeight}`);
    return true;
  } catch (error) {
    console.error('Connection validation failed:', error);
    return false;
  }
};

function App({ user }) {
  const { user: authUser } = useAuth();
  
  // Add missing state variables
  const [currentWallet, setCurrentWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [formData, setFormData] = useState({
    walletAddresses: [],
    walletNames: [],
    firstName: '',
    lastName: '',
    salary: '',
    stockIncome: '',
    realEstateIncome: '',
    dividends: ''
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); // Add this state for tracking processing steps
  const [results, setResults] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState({
    status: '',
    progress: 0
  });
  const [showLandingPage, setShowLandingPage] = useState(!user); // Initialize based on authentication status
const [bypassCache, setBypassCache] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState({
    isLimited: false,
    retryCount: 0,
    nextRetryTime: null,
    message: ''
  });
  
  // Add state for selected wallet
  const [selectedWallet, setSelectedWallet] = useState('all');
  
  // Add onboarding step tracking
  const [onboardingStep, setOnboardingStep] = useState(0);
  
  // Add states for UI and tracking
  const [showUserInfoPage, setShowUserInfoPage] = useState(false);
  const [appLoaded, setAppLoaded] = useState(false);
  const [walletBalances, setWalletBalances] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [currentPage, setCurrentPage] = useState('wallets');
  const [showWalletInputs, setShowWalletInputs] = useState(false);
  const [activeSection, setActiveSection] = useState('wallets'); // To track which section is active
  
  // Add state for tracking wallet processing status
  const [walletProcessingStatus, setWalletProcessingStatus] = useState({
    currentWallet: null,
    queuedWallets: [],
    completedWallets: []
  });
  
  // Create refs for functions to break circular dependencies
  const analyzeTaxesRef = useRef(null);
  const processNextWalletInQueueRef = useRef(null);
  const queueWalletForProcessingRef = useRef(null);
  
  // Initialize refs after all functions are defined
  useEffect(() => {
    // Use a small timeout to ensure all functions are defined
    const timer = setTimeout(() => {
      // At this point, all functions should be defined
      
      // Define the real queueWalletForProcessing function
      queueWalletForProcessingRef.current = (walletAddress) => {
        if (!walletAddress) {
          console.error("Cannot process empty wallet address");
          return Promise.resolve();
        }
        
        // Use the improved wallet validation from solanaConnectionService
        if (!validateWalletAddress(walletAddress)) {
          console.error(`Invalid Solana wallet address: ${walletAddress}`);
          return Promise.resolve();
        }
        
        console.log(`Queueing wallet for processing: ${walletAddress}`);
        
        try {
          // Don't add if it's already in the queue or currently processing
          if (walletProcessingStatus.currentWallet === walletAddress) {
            console.log(`Wallet ${walletAddress} is already being processed`);
            return Promise.resolve();
          }
          
          if (walletProcessingStatus.queuedWallets.includes(walletAddress)) {
            console.log(`Wallet ${walletAddress} is already queued for processing`);
            return Promise.resolve();
          }
          
          // Clear any existing wallet-specific data to ensure a fresh load
          setTransactions([]);
          
          // Switch to wallet display view
          setActiveSection('transactions');
          
          // Select this wallet for display
          setSelectedWallet(walletAddress);
          
          // Update wallet processing status
          setWalletProcessingStatus(prev => {
            // If already processing this wallet, don't change anything
            if (prev.currentWallet === walletAddress) {
              return prev;
            }
            
            // If already in queue, don't add again
            if (prev.queuedWallets.includes(walletAddress)) {
              return prev;
            }
            
            // If no current wallet, set this as current
            if (!prev.currentWallet) {
              // Start processing immediately
              console.log(`Starting immediate processing of wallet: ${walletAddress}`);
              setTimeout(() => {
                analyzeTaxes(walletAddress);
              }, 100);
              
              return {
                ...prev,
                currentWallet: walletAddress,
                completedWallets: prev.completedWallets.filter(addr => addr !== walletAddress)
              };
            }
            
            // Otherwise add to queue
            console.log(`Adding ${walletAddress} to processing queue`);
            return {
              ...prev,
              queuedWallets: [...prev.queuedWallets, walletAddress],
              completedWallets: prev.completedWallets.filter(addr => addr !== walletAddress)
            };
          });
          
          return Promise.resolve();
        } catch (error) {
          console.error(`Error queueing wallet ${walletAddress}:`, error);
          return Promise.resolve();
        }
      };
      
      // At this point, all functions should be defined
      // Implement the real functions first
      const realAnalyzeTaxes = async (specificWalletAddress = null) => {
        try {
          console.log('Starting transaction analysis...');
        setLoading(true);
          setResults(null);

          // Validate connection first
          const isConnected = await validateConnection();
          if (!isConnected) {
            throw new Error('Failed to connect to Solana network');
          }

          // Get wallet addresses to process
          const walletsToProcess = specificWalletAddress 
            ? [specificWalletAddress]
            : formData.walletAddresses.filter(addr => addr.length >= 32);

          if (walletsToProcess.length === 0) {
            throw new Error('No valid wallet addresses to process');
          }

          let allTransactions = [];
          
          // Process each wallet
          for (const walletAddress of walletsToProcess) {
            console.log('Processing wallet:', walletAddress);
            
            try {
              const transactions = await fetchAndProcessTransactions(walletAddress);
              allTransactions = [...allTransactions, ...transactions];
              
              // Update UI with progress
              setResults(prev => ({
                    ...prev,
                transactions: allTransactions,
                walletStats: {
                  ...prev?.walletStats,
                  [walletAddress]: {
                    totalTransactions: transactions.length,
                    lastUpdated: new Date().toISOString()
                  }
                }
              }));
      } catch (error) {
              console.error(`Error processing wallet ${walletAddress}:`, error);
              // Continue with next wallet if one fails
            }
          }

          // Calculate summary statistics
          const summary = {
            totalTransactions: allTransactions.length,
            totalVolume: allTransactions.reduce((sum, tx) => sum + Math.abs(tx.usd_value), 0),
            realizedGains: allTransactions
              .filter(tx => tx.transaction_type === 'sell')
              .reduce((sum, tx) => sum + tx.usd_value, 0),
            uniqueTokens: new Set(allTransactions.map(tx => tx.token_address)).size,
            gasFees: allTransactions.reduce((sum, tx) => sum + (tx.fee || 0), 0)
          };

          // Update final results
          setResults(prev => ({
                    ...prev,
            summary,
            isComplete: true
          }));

          console.log('Analysis complete');
          return true;
        } catch (error) {
          console.error('Error in transaction analysis:', error);
          setResults(prev => ({
            ...prev,
            error: error.message
          }));
          return false;
        } finally {
          setLoading(false);
        }
      };
      
      // Implement the real processNextWalletInQueue function
      const realProcessNextWalletInQueue = async () => {
        console.log('Processing next wallet in queue');
        
        // Access the state through the setter function to ensure we have the latest state
        let currentStatus = null;
        setWalletProcessingStatus(prev => {
          // Store the current status for checking
          currentStatus = prev;
          return prev;
        });
        
        // Wait for the state update to complete
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Check if there are any wallets in the queue
        if (!currentStatus || !currentStatus.queuedWallets || currentStatus.queuedWallets.length === 0) {
          console.log('No wallets in queue');
          return false;
        }
        
        // Get the next wallet from the queue
        const nextWallet = currentStatus.queuedWallets[0];
        console.log('Found wallet in queue, processing:', nextWallet);
        
        // Update the current wallet while keeping it in the queue
        setWalletProcessingStatus(prev => ({
          ...prev,
          currentWallet: nextWallet
        }));
        
        // Process the wallet - analyzeTaxes will handle removing from queue when done
        try {
          await realAnalyzeTaxes(nextWallet);
          return true;
        } catch (error) {
          console.error('Error processing wallet:', error);
          // Even on error, try to update the status to avoid stuck state
          setWalletProcessingStatus(prev => {
            // Only modify the state if the nextWallet is still the currentWallet
            if (prev.currentWallet === nextWallet) {
              const updatedStatus = {
                ...prev,
                currentWallet: null,
                queuedWallets: prev.queuedWallets.filter(addr => addr !== nextWallet),
                completedWallets: [...prev.completedWallets, nextWallet]
              };
              
              // Check if there are more wallets to process
              if (updatedStatus.queuedWallets.length > 0) {
                // Schedule the next wallet processing
                setTimeout(() => {
                  console.log('Processing next wallet after error recovery');
                  realProcessNextWalletInQueue();
                }, 500);
              }
              
              return updatedStatus;
            }
            return prev;
          });
          return false;
        }
      };
      
      // Now assign our implementations to the refs
      analyzeTaxesRef.current = realAnalyzeTaxes;
      processNextWalletInQueueRef.current = realProcessNextWalletInQueue;
    }, 100);
    
    return () => clearTimeout(timer);
  }, [formData.walletAddresses, setLoading, setLoadingProgress, setWalletProcessingStatus, walletProcessingStatus]);
  
  // Define walletMap (mapping from wallet addresses to wallet names)
  const walletMap = useMemo(() => {
    const map = {};
    formData.walletAddresses.forEach((address, index) => {
      if (address && address.length > 0) {
        map[address] = formData.walletNames[index] || `Wallet ${index + 1}`;
      }
    });
    return map;
  }, [formData.walletAddresses, formData.walletNames]);
  
  // Set app as loaded after a small delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch wallet balances when app loads or when showing the dashboard
  useEffect(() => {
    if (appLoaded && !showUserInfoPage) {
      const validWalletAddresses = formData.walletAddresses.filter(addr => addr.length >= 32);
      if (validWalletAddresses.length > 0) {
        fetchWalletBalances();
      }
    }
  }, [appLoaded, showUserInfoPage, formData.walletAddresses]);

  // Start onboarding process
  const startOnboarding = () => {
    setShowLandingPage(false);
    setOnboardingStep(1);
  };

  // Move to traditional income step
  const goToTraditionalIncomeStep = () => {
    // Start loading wallet balances in background
    if (formData.walletAddresses.filter(addr => addr.length >= 32).length > 0) {
      fetchWalletBalances();
    }
    setOnboardingStep(2);
  };

  // Skip traditional income and go to dashboard
  const skipToResults = async () => {
    setOnboardingStep(3);
    setCurrentPage('wallets');
    setActiveSection('wallets');
    
    // Load wallet balances and then start analyzing transactions
    const validWalletAddresses = formData.walletAddresses.filter(addr => addr.length >= 32);
    if (validWalletAddresses.length > 0) {
      await fetchWalletBalances();
      console.log('Starting wallet analysis after balances are fetched...');
      // Process wallets one by one for more reliable processing
      for (const walletAddress of validWalletAddresses) {
        console.log(`Queueing wallet: ${walletAddress}`);
        queueWalletForProcessing(walletAddress);
        // Small delay between queueing wallets
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  // Go back to previous step
  const goBackToPreviousStep = () => {
    if (onboardingStep > 1) {
      setOnboardingStep(onboardingStep - 1);
    } else {
      setShowLandingPage(true);
      setOnboardingStep(0);
    }
  };

  // Handle wallet name changes
  const handleWalletNameChange = (index, value) => {
    const updatedNames = [...formData.walletNames];
    updatedNames[index] = value;
    setFormData(prev => ({
      ...prev,
      walletNames: updatedNames
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Update getFiscalYearDates to use HELIUS_RPC_URL
  const getFiscalYearDates = () => {
    try {
      const connection = new Connection(HELIUS_RPC_URL);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-based
  
    // If we're in the first half of the calendar year, use previous year
    const fiscalYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    
    const startDate = new Date(`${fiscalYear}-07-01`);
    const endDate = new Date(`${fiscalYear + 1}-06-30`);
  
    return { startDate, endDate };
    } catch (error) {
      console.error('Error getting fiscal year dates:', error);
      return null;
    }
  };
  
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const clearAllTransactionCache = () => {
    console.log('Clearing all transaction cache...');
    // First, find all localStorage keys that start with our cache prefix
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    // Then remove them
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`Cleared ${keysToRemove.length} cached items`);
    setTransactions([]);
    setResults(null);
    setLoadingProgress(0);
  };

  // Function to reset all application data (for testing)
  const resetAllAppData = async () => {
    console.log('Resetting all application data...');
    
    // Clear local cache
    clearAllTransactionCache();
    
    // Reset UI state
    setTransactions([]);
    setResults(null);
    setLoadingProgress(0);
    setBatchProgress({
      totalTransactions: 0,
      processedTransactions: 0,
      currentBatch: 0,
      totalBatches: 0,
      isComplete: true
    });
    
    // Clear Supabase data if user is logged in
    if (authUser) {
      try {
        // Import the function from databaseService
        const { deleteAllUserData } = await import('./services/databaseService');
        
        // Delete all user data from Supabase
        const result = await deleteAllUserData(authUser.id);
        
        if (result.success) {
          console.log('Successfully reset all Supabase data');
                      } else {
          console.error('Error resetting Supabase data:', result.error);
        }
      } catch (error) {
        console.error('Error importing or calling deleteAllUserData:', error);
      }
    }
    
    // Show confirmation to user
    alert('All application data has been reset successfully.');
  };

  const clearTransactionCache = () => {
    // Only clear cache for valid wallet addresses
    const validWalletAddresses = formData.walletAddresses.filter(addr => addr.length >= 32);
    
    if (validWalletAddresses.length === 0) {
      alert('Please add valid wallet addresses first.');
      return;
    }
    
    // Clear cache for these wallet addresses
    validWalletAddresses.forEach(address => {
      const cacheKey = `${address}_${getFiscalYearDates().startDate.getTime()}`;
      localStorage.removeItem(CACHE_KEY_PREFIX + cacheKey);
    });
    
    // Set bypassCache to true for the next analyze
    setBypassCache(true);
    
    // Reset transactions and results
    setTransactions([]);
    setResults(null);
    setLoadingProgress(0);
    
    alert('Cache cleared. Click "Calculate All Taxes" to refresh the data.');
  };

  const getFromCache = (key) => {
    if (bypassCache) return null;
    
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
      localStorage.removeItem(CACHE_KEY_PREFIX + key);
    }
    return null;
  };

  const saveToCache = (key, data) => {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  };

  // Enhanced fetchWithRetry function to better handle rate limits
  const fetchWithRetry = async (fn, maxRetries = 5, initialDelay = 1000) => {
    let retries = 0;
    let lastError = null;
    let retryDelay = initialDelay;
    
    const isHeliusApiError = (error) => {
      if (!error) return false;
      const msg = error.message || '';
      return msg.includes('Method not found') || 
             msg.includes('Helius API') || 
             (error.heliusError === true);
    };
    
    console.log(`Making RPC call with retry logic`);
    
    while (retries <= maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        const errorMessage = error.message || '';
        const responseText = error.responseText || '';
        
        // Mark this error as a Helius API error for future detection
        if (errorMessage.includes('Method not found') || responseText.includes('Method not found')) {
          error.heliusError = true;
        }
        
        // Special case for Helius API errors - don't retry the same method call
        if (isHeliusApiError(error)) {
          console.error(`Helius API error detected, not retrying with same method: ${errorMessage}`);
          throw error; // Don't retry Helius API method errors
        }
        
        const isRateLimited = 
          errorMessage.includes('429') || 
          errorMessage.includes('rate limit') || 
          errorMessage.includes('too many requests');
          
        const isNetworkError = 
          errorMessage.includes('network') || 
          errorMessage.includes('ECONNRESET') || 
          errorMessage.includes('ETIMEDOUT') || 
          errorMessage.includes('failed to fetch');
        
        if (retries === maxRetries) {
          console.error(`Max retries (${maxRetries}) reached. Last error: ${errorMessage}`);
          throw error;
        }
        
        if (isRateLimited) {
          console.warn(`Rate limit hit (retry ${retries + 1}/${maxRetries}). Waiting ${retryDelay}ms before retrying...`);
          
          // Update the UI with rate limit info
          setRateLimitInfo({
            isRateLimited: true,
            message: `Rate limit reached. Retrying in ${Math.ceil(retryDelay/1000)}s...`,
            nextRetryTime: new Date(Date.now() + retryDelay)
          });
        } else if (isNetworkError) {
          console.warn(`Network error (retry ${retries + 1}/${maxRetries}): ${errorMessage}. Waiting ${retryDelay}ms before retrying...`);
        } else {
          console.warn(`Error (retry ${retries + 1}/${maxRetries}): ${errorMessage}. Waiting ${retryDelay}ms before retrying...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
        retries++;
      }
    }
    
    // We should never get here due to the final throw in the catch block
    throw lastError || new Error('Max retries reached');
  };

  // Enhanced fetchSolanaTransactions with parallel processing and early display
  const fetchSolanaTransactions = async (walletAddress) => {
    console.log(`Fetching Solana transactions for wallet: ${walletAddress}`);
    
    // Validate wallet address first
    if (!validateWalletAddress(walletAddress)) {
      console.error(`Invalid wallet address format: ${walletAddress}`);
      return [];
    }
    
    if (DEBUG_MODE) {
      console.log('Debug mode enabled - testing wallet address validity...');
      try {
        const testPubKey = new PublicKey(walletAddress);
        console.log('Wallet address is a valid Solana address:', testPubKey.toBase58());
        
        // Test connection to Solana
        console.log('Testing Solana connection...');
        resetConnection();
        const connection = getConnection(true);
        
        // First check connection using getBlockHeight
        const blockHeight = await connection.getBlockHeight();
        console.log('Solana network status - current block height:', blockHeight);
        
        // Also check Helius API health directly
        try {
          const healthStatus = await checkHeliusHealth();
          console.log('Helius API health check result:', healthStatus);
        } catch (healthError) {
          console.warn('Helius API health check failed:', healthError.message);
        }
        
        // Print API endpoints being used
        console.log('Using RPC endpoint:', HELIUS_RPC_URL);
        console.log('Using Helius RPC URL:', HELIUS_RPC_URL);
      } catch (error) {
        console.error('Debug validation error:', error.message);
      }
    }
    
    // Reset batch progress
    setBatchProgress({
      currentBatch: 0,
      totalBatches: 0,
      batchSize: 0,
      processedInBatch: 0,
      totalTransactions: 0,
      processedTransactions: 0,
      isComplete: false
    });
    
    setLoading(true);
    
    try {
      // Check if we already have transactions for this wallet in the cache
      const cacheKey = `transactions_${walletAddress}`;
      const cachedTransactions = getFromCache(cacheKey);
      
      // If we have cached transactions and not forcing refresh, use them
      if (cachedTransactions && cachedTransactions.length > 0 && !formData.forceRefresh) {
        console.log(`Using ${cachedTransactions.length} cached transactions for ${walletAddress}`);
        
        // Make sure to update the UI with the cached transactions
        setTransactions(cachedTransactions);
        
        // Update batch progress to show completion
        setBatchProgress(prev => ({
          ...prev,
          isComplete: true,
          totalTransactions: cachedTransactions.length,
          processedTransactions: cachedTransactions.length
        }));
        
        setLoading(false);
        return cachedTransactions;
      }
      
      // If we don't have cached transactions or we're forcing a refresh, fetch from network
      console.log(`Fetching transactions from network for ${walletAddress}`);
      
      // Reset connection to ensure we're not using a stale connection
      resetConnection();
      
      // Get a fresh connection
      const connection = getConnection(true);
      
      // Clear the transaction state before fetching new data
      setTransactions([]);
      
      // Constants for batching
      const SIGNATURE_BATCH_SIZE = 50;  // Number of signatures to fetch at once
      const DISPLAY_BATCH_SIZE = 10;    // Number of transactions to process and display at once
      const MAX_TRANSACTIONS = 5000;    // Maximum number of transactions to process
      
      let beforeSignature = null;
      let allTransactions = [];
      let batchNumber = 1;
      let fetchingComplete = false;
      let processedSignatures = new Set(); // Track which signatures we've processed
      
      // Process and display transactions in smaller batches
      const processAndDisplayBatch = async (signatures, batchNumber) => {
        if (!signatures || signatures.length === 0) return [];
        
        console.log(`Processing display batch ${batchNumber} with ${signatures.length} signatures`);
        
        // Update loading status
        setLoadingStep(`Processing batch ${batchNumber} with ${signatures.length} transactions...`);
        
        // Update batch progress
        setBatchProgress(prev => ({
          ...prev,
          currentBatch: batchNumber,
          batchSize: signatures.length,
          processedInBatch: 0
        }));
        
        try {
          // Fetch transactions in batch
          const transactions = await fetchTransactionBatch(signatures.map(sig => 
            typeof sig === 'string' ? sig : sig.signature
          ));
          
          console.log(`Successfully fetched ${transactions.length}/${signatures.length} transactions for display batch ${batchNumber}`);
          
          // Process this batch and immediately update the UI
          if (transactions.length > 0) {
            await processBatchAndUpdate(transactions, walletAddress, batchNumber);
            
            // Update the progress counter
            setBatchProgress(prev => ({
              ...prev,
              processedTransactions: prev.processedTransactions + transactions.length
            }));
            
            return transactions;
          }
          
          return [];
        } catch (error) {
          console.error(`Error processing batch ${batchNumber}:`, error);
          return [];
        }
      };
      
      // Function to fetch a batch of signatures
      const fetchSignatureBatch = async () => {
        try {
          setLoadingStep(`Fetching signature batch ${beforeSignature ? '(continued)' : ''}...`);
          
          console.log(`Fetching signature batch ${batchNumber}${beforeSignature ? ' after ' + beforeSignature.substring(0, 8) + '...' : ''}`);
          
          const options = {
            limit: SIGNATURE_BATCH_SIZE,
            commitment: 'confirmed'
          };
          
          if (beforeSignature) {
            options.before = beforeSignature;
          }
          
          // Add more detailed logging
          console.log(`Request options for getSignaturesForAddress: ${JSON.stringify(options)}`);
          console.log(`Using Helius RPC endpoint with API key: ${HELIUS_API_KEY.substring(0, 8)}...`);
          
          // Use fetchWithRetry with our Helius API
          const response = await fetchWithRetry(async () => {
            try {
              // Use the Helius RPC endpoint directly
              const requestBody = {
                jsonrpc: '2.0',
                id: 'helius-test',
                method: 'getSignaturesForAddress',
                params: [
                  walletAddress,
                  options
                ]
              };
              
              console.log(`Making RPC request: ${JSON.stringify({
                ...requestBody,
                params: [walletAddress.substring(0, 8) + '...', options]
              })}`);
              
              let data = null;
              
              try {
                // Try Helius API first
                const fetchResponse = await fetch(HELIUS_RPC_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody)
                });
                
                if (!fetchResponse.ok) {
                  const errorText = await fetchResponse.text();
                  console.error(`API Response for failed request:`, errorText);
                  throw new Error(`Failed to fetch signatures: ${fetchResponse.status} ${fetchResponse.statusText} - ${errorText}`);
                }
                
                data = await fetchResponse.json();
                
                // Check for RPC errors in the response
                if (data.error) {
                  throw new Error(`Helius API RPC error: ${JSON.stringify(data.error)}`);
                }
              } catch (heliusError) {
                // Log the original error for debugging
                console.error("Original Helius API error:", heliusError.message);
                
                // Try using @solana/web3.js directly as a fallback
                console.warn(`Helius API failed, falling back to direct connection: ${heliusError.message}`);
                
                // Get a fresh connection
                resetConnection();
                const connection = getConnection(true);
                
                // Use the connection directly
                try {
                  console.log(`Attempting direct getSignaturesForAddress call with fallback connection...`);
                  const signatures = await connection.getSignaturesForAddress(
                    new PublicKey(walletAddress),
                    {
                      limit: options.limit,
                      before: options.before,
                      commitment: options.commitment
                    }
                  );
                  
                  // Format to match Helius API response format
                  data = { result: signatures };
                  console.log(`Successfully fetched ${signatures.length} signatures via direct connection`);
                } catch (connectionError) {
                  console.error(`Direct connection fallback also failed: ${connectionError.message}`);
                  throw connectionError; // Re-throw the error
                }
              }
              
              // More detailed error logging
              if (data.error) {
                console.error(`Helius API returned an error:`, JSON.stringify(data.error));
                throw new Error(`Helius API error: ${JSON.stringify(data.error)}`);
              }
              
              // Log the entire response for debugging if empty
              if (!data.result || data.result.length === 0) {
                console.log(`Empty signature response for wallet: ${walletAddress}`);
                console.log(`Full API response:`, JSON.stringify(data));
              } else {
                console.log(`Successfully fetched ${data.result.length} signatures`);
              }
              
              return data.result || [];
            } catch (error) {
              console.error(`Error fetching signatures for ${walletAddress}:`, error);
              throw error;
            }
          });
          
          // If no signatures or empty result, we're done
          if (!response || response.length === 0) {
            console.log(`No more signatures for ${walletAddress}`);
            return null;
          }
          
          console.log(`Received ${response.length} signatures for ${walletAddress}`);
          
          // Store last signature for pagination
          if (response.length > 0) {
            beforeSignature = response[response.length - 1].signature;
          }
          
          // Update batch progress with new information
          if (batchNumber === 1) {
            // For the first batch, make a more accurate estimation of total
            setBatchProgress(prev => ({
              ...prev,
              totalTransactions: response.length * 3, // Initial rough estimate
              totalBatches: Math.ceil(response.length / DISPLAY_BATCH_SIZE) + 2, // Add a bit more for future batches
              batchSize: DISPLAY_BATCH_SIZE,
              currentBatch: 1
            }));
          } else {
            // Update the estimate based on additional signatures found
            setBatchProgress(prev => ({
              ...prev,
              totalTransactions: prev.totalTransactions + response.length,
              totalBatches: prev.totalBatches + Math.ceil(response.length / DISPLAY_BATCH_SIZE)
            }));
          }
          
          return response;
        } catch (error) {
          console.error(`Error fetching signature batch: ${error.message}`);
          return null;
        }
      };
      
      // Start fetching and processing signatures
      let pendingBatchPromise = null; // To track the currently processing batch
      
      // Main processing loop - fetch signatures and process in smaller display batches
      while (!fetchingComplete) {
        // Fetch a batch of signatures
        const signaturesResult = await fetchSignatureBatch();
        
        // If no signatures, we're done
        if (!signaturesResult || signaturesResult.length === 0) {
          fetchingComplete = true;
          
          // Wait for any pending batch to complete
          if (pendingBatchPromise) {
            await pendingBatchPromise;
          }
          
          break;
        }
        
        // Process signatures in smaller display batches
        for (let i = 0; i < signaturesResult.length; i += DISPLAY_BATCH_SIZE) {
          const displayBatch = signaturesResult.slice(i, i + DISPLAY_BATCH_SIZE);
          
          // Wait for any pending batch to complete
          if (pendingBatchPromise) {
            await pendingBatchPromise;
          }
          
          // Process this batch asynchronously - but wait for each batch to complete for stability
          pendingBatchPromise = processAndDisplayBatch(displayBatch, batchNumber);
          batchNumber++;
          
          // Wait for this batch to complete before starting the next one
          const processedBatch = await pendingBatchPromise;
          allTransactions = [...allTransactions, ...processedBatch];
          pendingBatchPromise = null;
          
          // If we've processed more than the maximum transactions, stop
          if (allTransactions.length >= MAX_TRANSACTIONS) {
            console.log(`Reached maximum transaction limit (${MAX_TRANSACTIONS}) for ${walletAddress}`);
            fetchingComplete = true;
            break;
          }
        }
        
        // If we got fewer signatures than the batch size, we're done
        if (signaturesResult.length < SIGNATURE_BATCH_SIZE) {
          fetchingComplete = true;
        }
      }
      
      // Update batch progress to show completion
      setBatchProgress(prev => ({
        ...prev,
        isComplete: true,
        totalTransactions: Math.max(allTransactions.length, prev.totalTransactions),
        processedTransactions: allTransactions.length
      }));
      
      console.log(`Completed fetching ${allTransactions.length} transactions for ${walletAddress}`);
      setLoading(false);
      setLoadingStep('');
      
      // Get the final transactions from state
      const finalTransactions = window.transactions || [];
      console.log(`Final transaction count: ${finalTransactions.length}`);
      
      // Add more detailed logging about transaction counts
      if (finalTransactions.length === 0) {
        console.log(`Warning: No transactions were found for wallet: ${walletAddress}`);
        console.log(`Possible causes: 
          1. The wallet may be new or inactive 
          2. Helius API rate limits may have been reached
          3. Network connection issues
          4. The wallet address may be incorrect`);
      }
      
      // Save to cache
      if (finalTransactions.length > 0) {
        saveToCache(cacheKey, finalTransactions);
        console.log(`Saved ${finalTransactions.length} transactions to cache for ${walletAddress}`);
      }
      
      return finalTransactions;
    } catch (error) {
      console.error(`Error fetching transactions for ${walletAddress}:`, error);
      setLoading(false);
      setLoadingStep('');
      
      // Update batch progress to show error
      setBatchProgress(prev => ({
        ...prev,
        isComplete: true
      }));
      
      return [];
    }
  };
  
  // Enhanced processBatchAndUpdate function to add price data and properly save and display each batch
  const processBatchAndUpdate = async (transactions, walletAddress, batchNumber) => {
    try {
      console.log(`Processing batch ${batchNumber} with ${transactions.length} transactions`);
      
      // Process each transaction in the batch
      const processedTransactions = transactions.map(tx => {
        if (!tx) return null;
        
        // Calculate SOL amount changes
          const solChange = calculateSolChange(tx, walletAddress);
          
        // Basic transaction info
        const processedTx = {
          signature: tx.transaction.signatures[0],
          timestamp: tx.blockTime,
          walletAddress,
            solChange,
          successful: tx.meta?.err === null,
          fee: tx.meta?.fee ? tx.meta.fee / LAMPORTS_PER_SOL : 0,
          accounts: tx.transaction.message.accountKeys.map(key => key.toString())
        };

        // Add transaction type and other metadata
        const txType = categorizeTransaction(tx, walletAddress);
        processedTx.type = txType;
        
        // For transfers, try to find if it's an internal transfer
        if (txType === TRANSACTION_TYPES.TRANSFER) {
          const destinationWallet = findDestinationWallet(tx, walletAddress, formData.walletAddresses);
          if (destinationWallet) {
            processedTx.isInternalTransfer = true;
            processedTx.destinationWallet = destinationWallet;
          }
        }

        return processedTx;
      }).filter(tx => tx !== null);

      // Save processed transactions to state
      setTransactions(prev => {
        const newTxs = [...(prev || []), ...processedTransactions];
        newTxs.sort((a, b) => a.timestamp - b.timestamp);
        return newTxs;
      });

      // Save to cache if enabled
      if (processedTransactions.length > 0) {
        const cacheKey = `${CACHE_KEY_PREFIX}${walletAddress}`;
        saveToCache(cacheKey, processedTransactions);
      }

      return processedTransactions;
    } catch (error) {
      console.error(`Error processing batch ${batchNumber}:`, error);
      throw error;
    }
  };

  // Helper function to calculate SOL change
  const calculateSolChange = (tx, walletAddress) => {
    try {
      if (!tx || !tx.transaction || !tx.meta) return 0;

      // Get account keys from the transaction message
      const accountKeys = tx.transaction.message.accountKeys.map(key => 
        typeof key === 'string' ? key : key.pubkey || key.toString()
      );

      const accountIndex = accountKeys.findIndex(key => key === walletAddress);
      if (accountIndex === -1) return 0;

      const preBalance = tx.meta.preBalances?.[accountIndex] || 0;
      const postBalance = tx.meta.postBalances?.[accountIndex] || 0;
      return (postBalance - preBalance) / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error calculating SOL change:', error);
      return 0;
    }
  };

  // Helper function to find destination wallet
  const findDestinationWallet = (tx, sourceWallet, userWallets) => {
    try {
      if (!tx.meta || !tx.accountKeys) return null;

      const sourceIndex = tx.accountKeys.findIndex(key => key === sourceWallet);
      if (sourceIndex === -1) return null;

      // Look for transfers to other user wallets
      return tx.accountKeys.find(key => 
        key !== sourceWallet && 
        userWallets.has(key)
      ) || null;
    } catch (error) {
      console.error('Error finding destination wallet:', error);
      return null;
    }
  };

  // Add state for batch processing
  const [batchProgress, setBatchProgress] = useState({
    totalTransactions: 0,
    processedTransactions: 0,
    currentBatch: 1,
    isComplete: false
  });

  const generateTaxForm = (formType) => {
    const formTemplates = {
      '8949': `Form 8949 - Sales and Other Dispositions of Capital Assets
    Taxpayer: ${formData.firstName} ${formData.lastName}
    Tax Year: ${new Date().getFullYear()}
    
    Part I - Short-term Capital Gains and Losses
    ${results?.crypto?.totalTransactions ? `Total Transactions: ${results.crypto.totalTransactions}
    Total Gains/Losses: $${results.crypto.realizedGains.toFixed(2)}` : 'No transactions to report'}
    `,
      'scheduleD': `Schedule D - Capital Gains and Losses
    Taxpayer: ${formData.firstName} ${formData.lastName}
    Tax Year: ${new Date().getFullYear()}
    
    Part I - Short-term Capital Gains and Losses
    Total Proceeds: $${results?.crypto?.realizedGains?.toFixed(2) || '0.00'}
    Total Cost Basis: $${(results?.crypto?.realizedGains * 0.8).toFixed(2) || '0.00'}
    Net Short-term Gain/Loss: $${results?.crypto?.realizedGains.toFixed(2) || '0.00'}
    `,
      '1040': `Form 1040 - U.S. Individual Income Tax Return
    Taxpayer: ${formData.firstName} ${formData.lastName}
    Tax Year: ${new Date().getFullYear()}
    
    Income:
    1. Wages and Salary: $${formData.salary || '0.00'}
    2. Interest: $0.00
    3. Dividends: $${formData.dividends || '0.00'}
    4. Crypto Gains: $${results?.crypto?.realizedGains.toFixed(2) || '0.00'}
    5. Real Estate: $${formData.realEstateIncome || '0.00'}
    
    Total Income: $${(
        (Number(formData.salary) || 0) + 
        (Number(formData.dividends) || 0) + 
        (results?.crypto?.realizedGains || 0) + 
        (Number(formData.realEstateIncome) || 0)
      ).toFixed(2)}
    `,
      'schedule1': `Schedule 1 - Additional Income and Adjustments
    Taxpayer: ${formData.firstName} ${formData.lastName}
    Tax Year: ${new Date().getFullYear()}
    
    Part I - Additional Income
    1. Crypto Mining Income: $0.00
    2. Staking Rewards: $0.00
    3. NFT Sales: $0.00
    
    Total Additional Income: $0.00
    `
    };

    const content = formTemplates[formType] || 'Form content not available';
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form_${formType}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateAllForms = () => {
    ['8949', 'scheduleD', '1040', 'schedule1'].forEach((formType, index) => {
      setTimeout(() => {
        generateTaxForm(formType);
      }, index * 500);
    });
  };

  // Toggle user info page
  const toggleUserInfoPage = () => {
    setShowUserInfoPage(!showUserInfoPage);
  };

  // Go to dashboard
  const goToDashboard = () => {
    setShowUserInfoPage(false);
    setCurrentPage('dashboard');
    setActiveSection('dashboard');
    
    // Refresh wallet balances when going back to dashboard
    if (results) {
      fetchWalletBalances();
    }
  };

  // Fetch current wallet balances directly from the blockchain
  const fetchWalletBalances = async () => {
    const validWalletAddresses = formData.walletAddresses.filter(addr => addr.length >= 32);
    if (validWalletAddresses.length === 0) return {};
    
    try {
      console.log('Fetching current wallet balances...');
      setLoadingBalances(true);
      const connection = new Connection(HELIUS_RPC_URL, 'confirmed');
      const balances = {};
      
      for (const address of validWalletAddresses) {
        try {
          console.log(`Fetching balance for wallet: ${address}`);
          const pubKey = new PublicKey(address);
          const balance = await connection.getBalance(pubKey);
          balances[address] = balance / LAMPORTS_PER_SOL;
          console.log(`Wallet ${address} balance: ${balances[address]} SOL`);
        } catch (error) {
          console.error(`Error fetching balance for ${address}:`, error);
          balances[address] = 0;
        }
        // Add a small delay to avoid rate limits
        await sleep(200);
      }
      
      console.log('Wallet balances successfully fetched:', balances);
      setWalletBalances(balances);
      return balances;
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
      return {};
    } finally {
      setLoadingBalances(false);
    }
  };

  // Handle navigation between different sections
  const handleNavigate = (page) => {
    setCurrentPage(page);
    
    // Handle different page navigations
    if (page === 'dashboard') {
      setShowUserInfoPage(false);
      setActiveSection('dashboard');
      // Only load transactions if we're not already processing
      if (!backgroundProcessing.active) {
        loadTransactionsFromDatabase();
      }
    } 
    else if (page === 'account') {
      setShowUserInfoPage(true);
    }
    else if (page === 'reports') {
      setShowUserInfoPage(false);
      setActiveSection('reports');
    }
    else if (page === 'wallets') {
      setShowUserInfoPage(false);
      setActiveSection('wallets');
      setShowWalletInputs(true);
    }
  };
  
  // Update current page when showing user info
  useEffect(() => {
    if (showUserInfoPage) {
      setCurrentPage('account');
    }
  }, [showUserInfoPage]);

  // Show wallet inputs on initial load or when adding wallets
  useEffect(() => {
    if (formData.walletAddresses.length === 0 || 
        (formData.walletAddresses.length === 1 && formData.walletAddresses[0] === '')) {
      setShowWalletInputs(true);
    }
  }, [formData.walletAddresses]);

  // Create function shells that use the refs
  const analyzeTaxes = (specificWalletAddress = null) => {
    if (analyzeTaxesRef.current) {
      return analyzeTaxesRef.current(specificWalletAddress);
    } else {
      console.log("analyzeTaxes called but not fully initialized");
      return Promise.resolve(); // Return a resolved promise
    }
  };

  const processNextWalletInQueue = () => {
    if (processNextWalletInQueueRef.current) {
      return processNextWalletInQueueRef.current();
    } else {
      console.log("processNextWalletInQueue called but not fully initialized");
      return Promise.resolve(); // Return a resolved promise
    }
  };

  const queueWalletForProcessing = (walletAddress) => {
    if (queueWalletForProcessingRef.current) {
      return queueWalletForProcessingRef.current(walletAddress);
    } else {
      console.log("queueWalletForProcessing called but not fully initialized");
      return Promise.resolve(); // Return a resolved promise
    }
  };

  // New useEffect to load wallets from Supabase when user logs in
  useEffect(() => {
    const loadUserWalletsFromSupabase = async () => {
      if (!authUser) return;
      
      try {
        console.log('Loading wallets from Supabase for user:', authUser.id);
        
        // Fetch wallets from Supabase
        const { success, data: wallets } = await getUserWallets(authUser.id);
        
        if (success && wallets && wallets.length > 0) {
          // Update form data with the wallets
          const walletAddresses = wallets.map(w => w.wallet_address);
          const walletNames = wallets.map(w => w.wallet_name);
          
          setFormData(prev => ({
            ...prev,
            walletAddresses: walletAddresses.length ? walletAddresses : [''],
            walletNames: walletNames.length ? walletNames : ['My Wallet']
          }));
          
          console.log('Loaded wallets from Supabase:', walletAddresses);
          
          // Load wallet balances for the wallets
          fetchWalletBalances();
        }
      } catch (error) {
        console.error('Error loading wallets from Supabase:', error);
      }
    };
    
    loadUserWalletsFromSupabase();
  }, [authUser]);

  // Add a utility function to save transactions to Supabase
  const saveTransactionsToSupabase = async (walletAddress, transactionData) => {
    if (!authUser || !walletAddress || !transactionData || transactionData.length === 0) {
      console.log('Cannot save transactions: missing required data');
      return false;
    }
    
    try {
      console.log(`Saving ${transactionData.length} transactions for wallet ${walletAddress} to Supabase`);
      
      // Find the wallet in the user's wallet collection
      const { success, data: wallets } = await getUserWallets(authUser.id);
      
      if (success && wallets) {
        const wallet = wallets.find(w => w.wallet_address === walletAddress);
        
        if (wallet) {
          // Format the transactions for Supabase
          const formattedTransactions = transactionData.map(tx => ({
            wallet_id: wallet.id,
            signature: tx.signature,
            block_time: tx.timestamp ? new Date(tx.timestamp * 1000) : null,
            success: tx.success,
            transaction_type: tx.type || 'unknown',
            amount: tx.solChange || null,
            token_symbol: tx.tokenInfo?.symbol || null,
            usd_value: tx.valueUSD || null,
            raw_data: JSON.stringify(tx)
          }));
          
          // Save transactions to Supabase
          const result = await saveTransactions(wallet.id, formattedTransactions);
          
          if (result.success) {
            console.log(`Successfully saved ${formattedTransactions.length} transactions to Supabase`);
            return true;
          }
        } else {
          console.error(`Wallet ${walletAddress} not found in user's wallets`);
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error saving transactions to Supabase:', error);
      return false;
    }
  };

  // Skip landing page for authenticated users
  useEffect(() => {
    if (user || authUser) {
      setShowLandingPage(false);
      setCurrentPage('wallets');
      setActiveSection('wallets');
    }
  }, [user, authUser]);

  // Define variables and functions for UserInformationPage
  const [walletSaving, setWalletSaving] = useState(false);
  const [activeWalletIndex, setActiveWalletIndex] = useState(null);
  
  // Function to save wallet and initiate transaction fetch
  const saveWalletAndPull = async (walletAddress, walletName, index) => {
    if (!authUser) {
      console.error('No authenticated user found');
      return false;
    }

    try {
    setWalletSaving(true);
    setActiveWalletIndex(index);
    
      // Validate the wallet address first
      if (!walletAddress || walletAddress.length < 32) {
        throw new Error('Invalid wallet address');
      }

      // Check if wallet already exists for this user
      const { data: existingWallets } = await supabase
        .from('wallets')
        .select('wallet_address, wallet_name')
        .eq('user_id', authUser.id)
        .eq('wallet_address', walletAddress);

      let walletSaved = false;

      if (existingWallets && existingWallets.length > 0) {
        console.log('Wallet already exists for this user');
        // Update the wallet name if it changed
        if (existingWallets[0].wallet_name !== walletName) {
          const { error } = await supabase
            .from('wallets')
            .update({ wallet_name: walletName })
            .eq('user_id', authUser.id)
            .eq('wallet_address', walletAddress);
          
          if (error) throw error;
        }
        walletSaved = true;
      } else {
        // If wallet doesn't exist, add it
        const { error } = await supabase
          .from('wallets')
          .insert([{
            user_id: authUser.id,
            wallet_address: walletAddress,
            wallet_name: walletName
          }]);

        if (error) throw error;
        walletSaved = true;
      }

      if (walletSaved) {
        console.log('Wallet saved successfully, initiating transaction fetch...');
        
        // Get the wallet balance
        const connection = new Connection(HELIUS_RPC_URL);
        const balance = await connection.getBalance(new PublicKey(walletAddress));
        setWalletBalances(prev => ({
          ...prev,
          [walletAddress]: balance / LAMPORTS_PER_SOL
        }));

        // Initiate transaction fetch
        setWalletProcessingStatus(prev => ({
          ...prev,
          currentWallet: walletAddress,
          queuedWallets: prev.queuedWallets.filter(addr => addr !== walletAddress),
          completedWallets: prev.completedWallets.filter(addr => addr !== walletAddress)
        }));

        // Start fetching transactions
        await fetchAndProcessTransactions(walletAddress);
      }

      return true;
    } catch (error) {
      console.error('Failed to save wallet or fetch transactions:', error);
      setResults(prev => ({
        ...prev,
        error: error.message
      }));
      return false;
    } finally {
      setWalletSaving(false);
      setActiveWalletIndex(null);
    }
  };

  // Function to load user's wallets from Supabase
  const loadUserWalletsFromSupabase = async () => {
    if (!authUser) return;
    
    try {
      console.log('Loading wallets from Supabase for user:', authUser.id);
      
      const { data: wallets, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', authUser.id);
      
      if (error) throw error;
      
      if (wallets && wallets.length > 0) {
        // Update form data with the wallets
        const walletAddresses = wallets.map(w => w.wallet_address);
        const walletNames = wallets.map(w => w.wallet_name);
        
        setFormData(prev => ({
          ...prev,
          walletAddresses: walletAddresses.length ? walletAddresses : [''],
          walletNames: walletNames.length ? walletNames : ['My Wallet']
        }));
        
        console.log('Loaded wallets from Supabase:', wallets);
        
        // Load wallet balances
        await fetchWalletBalances();
        
        // Update UI state for each wallet
        const walletStats = {};
        wallets.forEach(wallet => {
          walletStats[wallet.wallet_address] = {
            status: 'loaded',
            lastUpdated: wallet.updated_at
          };
        });
        
        setResults(prev => ({
          ...prev,
          walletStats
        }));
          }
        } catch (error) {
      console.error('Error loading wallets from Supabase:', error);
      setResults(prev => ({
        ...prev,
        error: 'Failed to load wallets: ' + error.message
      }));
    }
  };
  
  // Function to delete a specific wallet from the database
  const deleteWalletFromDatabase = async (walletAddress) => {
    if (!authUser) return false;
    
    try {
      console.log(`Deleting wallet ${walletAddress} from database...`);
      
      // Find the wallet in the user's wallet collection
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('id, wallet_address')
        .eq('user_id', authUser.id)
        .eq('wallet_address', walletAddress);
      
      if (walletsError) throw walletsError;
      
      if (!wallets || wallets.length === 0) {
        console.log('Wallet not found in database');
        return false;
      }
      
      const walletId = wallets[0].id;
      
      // Delete the wallet (this will cascade delete all associated transactions)
      const { error: deleteError } = await supabase
        .from('wallets')
        .delete()
        .eq('id', walletId);
      
      if (deleteError) throw deleteError;
      
      console.log(`Successfully deleted wallet ${walletAddress} and its transactions`);
      return true;
    } catch (error) {
      console.error('Error deleting wallet from database:', error);
      return false;
    }
  };
  
  // Function to remove a wallet
  const removeWallet = async (index) => {
    const walletAddress = formData.walletAddresses[index];
    
    // Show confirmation dialog
    if (!window.confirm(`Are you sure you want to remove this wallet? This will delete all associated transaction data.`)) {
      return;
    }
    
    try {
      // Delete from database first
      if (authUser) {
        const deleted = await deleteWalletFromDatabase(walletAddress);
        if (!deleted) {
          console.error('Failed to delete wallet from database');
          return;
        }
      }
      
      // Update local state
    const updatedAddresses = [...formData.walletAddresses];
    const updatedNames = [...formData.walletNames];
    
    updatedAddresses.splice(index, 1);
    updatedNames.splice(index, 1);
      
      // If removing the last wallet, add an empty one
      if (updatedAddresses.length === 0) {
        updatedAddresses.push('');
        updatedNames.push('My Wallet');
      }
    
    setFormData({
      ...formData,
      walletAddresses: updatedAddresses,
      walletNames: updatedNames
    });
      
      // Clear the wallet's balance
      setWalletBalances(prev => {
        const updated = { ...prev };
        delete updated[walletAddress];
        return updated;
      });
      
      // Remove from processing status if needed
      setWalletProcessingStatus(prev => ({
        ...prev,
        currentWallet: prev.currentWallet === walletAddress ? null : prev.currentWallet,
        queuedWallets: prev.queuedWallets.filter(addr => addr !== walletAddress),
        completedWallets: prev.completedWallets.filter(addr => addr !== walletAddress)
      }));
      
      // Reload transactions to remove the deleted wallet's transactions
      await loadTransactionsFromDatabase();
      
    } catch (error) {
      console.error('Error removing wallet:', error);
    }
  };

  // Update checkConnectionStatus to use HELIUS_RPC_URL
  const checkConnectionStatus = async () => {
    try {
      // Reset any existing connection to ensure we're starting fresh
      resetConnection();
      
      // Get a new connection and validate it
      const connection = new Connection(HELIUS_RPC_URL);
      
      console.log("Checking Solana connection status...");
      
      // Simple test to verify connection is working
      const blockHeight = await executeWithRetry(async () => {
        return await connection.getBlockHeight();
      });
      
      console.log(`Solana network status - current block height: ${blockHeight}`);
      
      // Also try to check Helius API health directly
      try {
        const healthStatus = await checkHeliusHealth();
        console.log(`Helius API health check result: ${healthStatus}`);
      } catch (healthError) {
        // Log but continue as the main connection is working
        console.warn(`Helius API health check failed, but main connection is working: ${healthError.message}`);
      }
      
      return true;
    } catch (error) {
      console.error("Solana connection check failed:", error.message);
      return false;
    }
  };

  // Simplified function to fetch wallet transactions
  const fetchWalletTransactionsFromHelius = async (walletAddress, limit = 100, beforeSignature = null) => {
    try {
      console.log(`Fetching transactions for wallet: ${walletAddress}`);
      
      const params = [
        walletAddress,
        {
          limit,
          before: beforeSignature,
          commitment: 'confirmed'
        }
      ];

      const response = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'my-id',
          method: 'getSignaturesForAddress',
          params
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Helius API error: ${data.error.message}`);
      }

      if (!data.result || !Array.isArray(data.result)) {
        console.warn('Invalid response format from Helius API:', data);
        return [];
      }

      console.log(`Successfully fetched ${data.result.length} transactions`);
      return data.result;

    } catch (error) {
      console.error('Error fetching wallet transactions:', error.message);
      throw error;
    }
  };

  // Fetch detailed transaction information
  const fetchTransactionDetails = async (signature) => {
    try {
      // Ensure signature is a string
      if (typeof signature !== 'string') {
        console.error('Invalid signature type:', typeof signature, signature);
        throw new Error('Invalid signature type');
      }

      const response = await fetchWithRetry(async () => {
        const result = await fetch(HELIUS_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getTransaction',
            params: [
              signature,
              { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
            ]
          }),
        });

        if (!result.ok) {
          if (result.status === 429) {
            throw new Error('RATE_LIMIT');
          }
          throw new Error(`HTTP error! status: ${result.status}`);
        }

        return result;
      }, 3, 1000); // 3 retries, 1 second initial delay

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Helius API error: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      console.error(`Error fetching transaction details for ${signature}:`, error);
      throw error;
    }
  };

  // Helper function to get price data
  const getPriceData = async (tx, txType, solChange) => {
    try {
      const timestamp = tx.blockTime || tx.timestamp || Date.now() / 1000;
      
      // Get current price at transaction time
      const currentPrice = await priceService.getPriceAtTimestamp(timestamp);
      
      // For sales, we need acquisition price to calculate realized gain
      let realizedGain = 0;
      if (solChange < 0 && txType !== 'gas') {
        // For simplicity, use a random past time for acquisition price
        // In a real app, you'd track actual acquisition time/price
        const acquireTimestamp = timestamp - (Math.random() * 365 * 24 * 60 * 60);
        const acquirePrice = await priceService.getPriceAtTimestamp(acquireTimestamp);
        realizedGain = Math.abs(solChange) * (currentPrice - acquirePrice);
      }
      
      // Calculate USD value
      const valueUSD = solChange * (currentPrice || 0);
      
      return {
        currentPrice,
        valueUSD,
        realizedGain
      };
    } catch (error) {
      console.error('Error getting price data:', error);
      return {
        currentPrice: 0,
        valueUSD: 0,
        realizedGain: 0
      };
    }
  };

  // Add new state for background processing
  const [backgroundProcessing, setBackgroundProcessing] = useState({
    active: false,
    walletAddress: null,
    progress: 0
  });

  // Modified fetchAndProcessTransactions function
  const fetchAndProcessTransactions = async (walletAddress) => {
    try {
      console.log(`Starting transaction fetch for wallet: ${walletAddress}`);
      
      // Set background processing state
      setBackgroundProcessing(prev => ({
        active: true,
        walletAddress,
        progress: 0
      }));
      
      let allTransactions = [];
      let beforeSignature = null;
      let hasMore = true;
      let batchNumber = 1;
      let consecutiveEmptyBatches = 0;
      const MAX_EMPTY_BATCHES = 3;
      
      // Clear existing transactions for this wallet
      setTransactions(prev => prev.filter(tx => tx.walletAddress !== walletAddress));
      setDbTransactions(prev => prev.filter(tx => tx.walletAddress !== walletAddress));
      
      while (hasMore) {
        console.log(`Fetching batch ${batchNumber} for wallet ${walletAddress}...`);
        try {
          const batchResult = await fetchTransactionBatch(walletAddress, beforeSignature);
          
          if (!batchResult.transactions.length) {
            console.log(`Empty batch received (${consecutiveEmptyBatches + 1}/${MAX_EMPTY_BATCHES})`);
            consecutiveEmptyBatches++;
            if (consecutiveEmptyBatches >= MAX_EMPTY_BATCHES) {
              console.log('Max empty batches reached, stopping fetch');
              hasMore = false;
              break;
            }
            await sleep(Math.min(1000 * Math.pow(2, consecutiveEmptyBatches), 5000));
            continue;
          }
          
          consecutiveEmptyBatches = 0;
          
          const processedBatch = await processTransactionBatch(batchResult.transactions, walletAddress);
          console.log(`Processed ${processedBatch.length} transactions in batch ${batchNumber}`);
          
          if (processedBatch.length > 0) {
            console.log(`Saving ${processedBatch.length} transactions to database...`);
            await saveTransactionsToDatabase(processedBatch);
            
            // Update transactions in state, preserving other wallet transactions
            setTransactions(prev => {
              const withoutCurrentWallet = prev.filter(tx => tx.walletAddress !== walletAddress);
              return [...withoutCurrentWallet, ...processedBatch];
            });
            
            setDbTransactions(prev => {
              const withoutCurrentWallet = prev.filter(tx => tx.walletAddress !== walletAddress);
              return [...withoutCurrentWallet, ...processedBatch];
            });
          }
          
          allTransactions = [...allTransactions, ...processedBatch];
          beforeSignature = batchResult.lastSignature;
          
          // Update background processing progress
          setBackgroundProcessing(prev => ({
            ...prev,
            progress: Math.min((batchNumber * 5), 100)
          }));
          
          const dynamicDelay = Math.max(
            100,
            Math.min(
              500,
              processedBatch.length * 10
            )
          );
          await sleep(dynamicDelay);
          
          batchNumber++;
    } catch (error) {
          console.error(`Error processing batch ${batchNumber}:`, error);
          await sleep(Math.min(1000 * Math.pow(2, consecutiveEmptyBatches), 5000));
          continue;
        }
      }
      
      // Update final states
      setBackgroundProcessing(prev => ({
        ...prev,
        active: false,
        progress: 100
      }));
      
      console.log(`Completed processing ${allTransactions.length} transactions for ${walletAddress}`);
      
      // Update wallet processing status
      setWalletProcessingStatus(prev => ({
        ...prev,
        currentWallet: null,
        completedWallets: [...prev.completedWallets, walletAddress],
        queuedWallets: prev.queuedWallets.filter(w => w !== walletAddress)
      }));
      
      return allTransactions;
    } catch (error) {
      console.error('Error in fetchAndProcessTransactions:', error);
      setBackgroundProcessing(prev => ({
        ...prev,
        active: false
      }));
      throw error;
    }
  };

  // Fetch a batch of transactions
  const fetchTransactionBatch = async (walletAddress, beforeSignature = null) => {
    try {
      console.log(`Fetching transaction batch for wallet: ${walletAddress}`);
      
      const result = await fetchWithRetry(async () => {
        const fetchResponse = await fetch(HELIUS_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getSignaturesForAddress',
            params: [
              walletAddress,
              {
                limit: 10,
                before: beforeSignature,
                commitment: 'confirmed'
              }
            ]
          })
        });

        if (!fetchResponse.ok) {
          if (fetchResponse.status === 429) {
            throw new Error('RATE_LIMIT');
          }
          throw new Error(`HTTP error! status: ${fetchResponse.status}`);
        }

        const data = await fetchResponse.json();
        if (data.error) {
          throw new Error(`Helius API error: ${data.error.message}`);
        }

        return data;
      }, 5, 2000);

      if (!result || !result.result) {
        console.log('No transaction data received from API');
        return {
          transactions: [],
          lastSignature: null
        };
      }

      const signatures = result.result || [];
      console.log(`Found ${signatures.length} signatures to process`);
      
      // Process each signature one at a time with delay to avoid rate limits
      const transactions = [];
      for (const sig of signatures) {
        try {
          // Add delay between requests to avoid rate limits
          await sleep(500);
          
          const tx = await fetchWithRetry(async () => {
            const txResponse = await fetchTransactionDetails(sig.signature);
            if (!txResponse) throw new Error('No transaction data received');
            return txResponse;
          }, 3, 1000); // 3 retries, 1 second initial delay
          
          if (tx) {
            transactions.push(tx);
          }
        } catch (error) {
          console.error(`Error fetching transaction ${sig.signature}:`, error);
          // Continue with next signature if one fails
        }
      }

      return {
        transactions,
        lastSignature: signatures[signatures.length - 1]?.signature
      };
    } catch (error) {
      console.error('Error fetching transaction batch:', error);
      if (error.message === 'RATE_LIMIT') {
        // Wait longer for rate limit
        await sleep(5000);
      }
      throw error;
    }
  };

  // Process a batch of transactions
  const processTransactionBatch = async (transactions, walletAddress) => {
    return Promise.all(transactions.map(async (tx) => {
      try {
        // Get transaction type and details
        const txTypeAndDetails = categorizeTransaction(tx, walletAddress);
        const solChange = calculateSolChange(tx, walletAddress);
        const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();
        
        // Get USD value using price service
        const { currentPrice, valueUSD } = await getPriceData(tx, txTypeAndDetails.type, solChange);
        
        // Extract transfer details
        let transferDetails = null;
        if (txTypeAndDetails.type === TRANSACTION_TYPES.TRANSFER && txTypeAndDetails.details) {
            transferDetails = {
                destination: txTypeAndDetails.details.destination,
                amount: txTypeAndDetails.details.amount,
                isInternalTransfer: formData.walletAddresses.includes(txTypeAndDetails.details.destination)
            };
        }
        
        return {
            signature: tx.transaction.signatures[0],
            wallet_address: walletAddress,
            block_time: timestamp,
            transaction_type: txTypeAndDetails.type,
            amount: solChange,
            usd_value: valueUSD,
            fee: tx.meta?.fee ? tx.meta.fee / LAMPORTS_PER_SOL : 0,
            success: tx.meta?.err === null,
            destination_address: transferDetails?.destination || null,
            is_internal_transfer: transferDetails?.isInternalTransfer || false,
            raw_data: JSON.stringify({
                ...tx,
                type: txTypeAndDetails,
                transferDetails,
                solChange,
                valueUSD
            })
        };
      } catch (error) {
        console.error('Error processing transaction:', error);
        return null;
      }
    })).then(results => results.filter(Boolean));
  };

  // Save processed transactions to database
  const saveTransactionsToDatabase = async (transactions) => {
    try {
        if (!transactions || transactions.length === 0) return true;
        
        // Get the wallet address from the first transaction
        const walletAddress = transactions[0].wallet_address;
        
        // Get all user's wallets to map addresses to IDs
        const { data: userWallets, error: walletsError } = await supabase
            .from('wallets')
            .select('id, wallet_address');
        
        if (walletsError) throw walletsError;
        
        // Create a map of wallet addresses to IDs
        const walletAddressToId = Object.fromEntries(
            userWallets.map(w => [w.wallet_address, w.id])
        );
        
        // Format transactions for database
        const formattedTransactions = transactions.map(tx => {
            // Get the wallet ID for this transaction
            const wallet_id = walletAddressToId[tx.wallet_address];
            
            // If this is a transfer, try to find the destination wallet ID
            let destination_wallet_id = null;
            if (tx.destination_address && walletAddressToId[tx.destination_address]) {
                destination_wallet_id = walletAddressToId[tx.destination_address];
            }
            
            return {
                signature: tx.signature,
                block_time: tx.block_time,
                transaction_type: tx.transaction_type,
                amount: tx.amount,
                usd_value: tx.usd_value,
                fee: tx.fee,
                success: tx.success,
                raw_data: tx.raw_data,
                wallet_id: wallet_id,
                // New fields
                destination_address: tx.destination_address || null,
                is_internal_transfer: tx.is_internal_transfer || false,
                destination_wallet_id: destination_wallet_id
            };
        });

        // Save to database using upsert
        const { error } = await supabase
            .from('transactions')
            .upsert(
                formattedTransactions,
                { 
                    onConflict: 'signature',
                    ignoreDuplicates: true 
                }
            );

        if (error) throw error;
        
        console.log(`Successfully saved ${formattedTransactions.length} transactions to database`);
        return true;
    } catch (error) {
        console.error('Error saving transactions to database:', error);
        return false;
    }
};

  // Add this near the other state declarations in the App component
  const [dbTransactions, setDbTransactions] = useState([]);
  
  // Add this function to load transactions from the database
  const loadTransactionsFromDatabase = async () => {
    if (!authUser) return;
    
    try {
      console.log('Loading transactions from database...');
      
      // First get all user's wallets
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('id, wallet_address')
        .eq('user_id', authUser.id);
        
      if (walletsError) throw walletsError;
      
      if (!wallets || wallets.length === 0) {
        console.log('No wallets found for user');
        return;
      }
      
      const walletIds = wallets.map(w => w.id);
      
      // Get all transactions for these wallets
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .in('wallet_id', walletIds)
        .order('block_time', { ascending: false });
        
      if (error) throw error;
      
      console.log(`Found ${transactions?.length || 0} transactions in database`);
      
      if (!transactions || transactions.length === 0) {
        setTransactions([]);
        setDbTransactions([]);
        return;
      }
      
      // Create a map of wallet_id to wallet_address
      const walletAddressMap = Object.fromEntries(
        wallets.map(w => [w.id, w.wallet_address])
      );
      
      // Transform transactions to match the expected format
      const formattedTransactions = transactions.map(tx => {
        // Parse the raw data if it exists
        let rawData = {};
        try {
          if (tx.raw_data) {
            rawData = JSON.parse(tx.raw_data);
          }
        } catch (e) {
          console.error('Error parsing raw data:', e);
        }
        
        return {
          signature: tx.signature,
          timestamp: new Date(tx.block_time).getTime() / 1000,
          type: tx.transaction_type,
          solChange: tx.amount,
          success: tx.success,
          fee: tx.fee,
          walletAddress: walletAddressMap[tx.wallet_id],
          walletName: formData.walletNames[formData.walletAddresses.indexOf(walletAddressMap[tx.wallet_id])] || 'Unknown',
          usdValue: parseFloat(tx.usd_value) || null,
          tokenInfo: tx.token_symbol ? {
            symbol: tx.token_symbol,
            address: tx.token_address
          } : null,
          rawData: rawData
        };
      });
      
      console.log(`Formatted ${formattedTransactions.length} transactions for display`);
      
      // Update both transaction states
      setTransactions(formattedTransactions);
      setDbTransactions(formattedTransactions);
    } catch (error) {
      console.error('Error loading transactions from database:', error);
    }
  };
  
  // Add an effect to load transactions when the component mounts or when wallets change
  useEffect(() => {
    loadTransactionsFromDatabase();
  }, [authUser, formData.walletAddresses, formData.walletNames]);

  return (
    <div className={`${appLoaded ? 'fade-in' : 'opacity-0'}`}>
      {showLandingPage ? (
        <LandingPage onGetStarted={startOnboarding} />
      ) : (
        <AppLayout 
          toggleUserInfoPage={toggleUserInfoPage}
          currentPage={currentPage}
          userProfile={formData}
          onNavigate={handleNavigate}
        >
          {showUserInfoPage ? (
            <UserInformationPage 
              formData={formData}
              setFormData={setFormData}
              handleInputChange={handleInputChange}
              handleWalletNameChange={handleWalletNameChange}
              analyzeTaxes={analyzeTaxes}
              loading={loading}
              loadingProgress={loadingProgress}
              results={results}
              clearTransactionCache={clearTransactionCache}
              clearAllTransactionCache={clearAllTransactionCache}
              resetAllAppData={resetAllAppData}
              goBackToDashboard={goToDashboard}
              walletProcessingStatus={walletProcessingStatus}
              queueWalletForProcessing={queueWalletForProcessing}
              user={authUser}
              saveTransactionsToSupabase={saveTransactionsToSupabase}
              saveWalletAndPull={saveWalletAndPull}
              removeWallet={removeWallet}
              walletSaving={walletSaving}
              activeWalletIndex={activeWalletIndex}
            />
          ) : (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {/* Conditional rendering based on active section */}
              {activeSection === 'wallets' && (
                <WalletsPage 
                  formData={formData}
                  setFormData={setFormData}
                  handleWalletNameChange={handleWalletNameChange}
                  analyzeTaxes={analyzeTaxes}
                  loading={loading}
                  loadingProgress={loadingProgress}
                  results={results}
                  walletProcessingStatus={walletProcessingStatus}
                  queueWalletForProcessing={queueWalletForProcessing}
                  saveWalletAndPull={saveWalletAndPull}
                  removeWallet={removeWallet}
                  walletSaving={walletSaving}
                  activeWalletIndex={activeWalletIndex}
                  validateWalletAddress={validateWalletAddress}
                />
              )}
              
              {activeSection === 'dashboard' && (
                <div className="mt-6 grid grid-cols-1 gap-4">
                  {/* Background Processing Indicator */}
                  {backgroundProcessing.active && (
                    <div className="bg-white dark:bg-geist-accent-800 rounded-xl shadow-sm border border-geist-accent-200 dark:border-geist-accent-700 p-3 animate-fade-in">
                      <div className="flex items-center gap-3">
                          <div className="flex-1">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                            Processing {walletMap[backgroundProcessing.walletAddress] || 'wallet'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-full h-1.5">
                            <div 
                              className="bg-geist-success h-full rounded-full transition-all duration-500"
                              style={{ width: `${backgroundProcessing.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-geist-accent-500 dark:text-geist-accent-400 tabular-nums">
                            {backgroundProcessing.progress}%
                                  </span>
                            </div>
                          </div>
                    </div>
                  )}
                  
                  {/* Wallet Stats Overview */}
                  <div className="bg-white dark:bg-geist-accent-800 rounded-xl shadow-sm border border-geist-accent-200 dark:border-geist-accent-700 animate-fade-in">
                    {/* Mobile View */}
                    <div className="lg:hidden">
                      <div className="p-4 border-b border-geist-accent-200 dark:border-geist-accent-700">
                        <div className="flex items-center justify-between">
                          <h2 className="text-base font-semibold text-geist-accent-900 dark:text-geist-foreground">Wallet Overview</h2>
                          <span className="text-xs text-geist-accent-500 dark:text-geist-accent-400">
                            {formData.walletAddresses.filter(addr => addr.length >= 32).length} wallets
                          </span>
                        </div>
                    </div>
                
                      <div className="divide-y divide-geist-accent-200 dark:divide-geist-accent-700">
                        {/* Total Balance */}
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-geist-accent-600 dark:text-geist-accent-400">Total Balance</span>
                            {loadingBalances ? (
                              <div className="flex items-center justify-center h-6">
                                <svg className="animate-spin h-4 w-4 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                              </div>
                            ) : (
                              <span className="text-base font-medium text-geist-success dark:text-green-300">
                                {Object.values(walletBalances).reduce((sum, balance) => sum + balance, 0).toFixed(4)} SOL
                              </span>
                            )}
                    </div>
                  </div>

                        {/* Transaction Count */}
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-geist-accent-600 dark:text-geist-accent-400">Transactions</span>
                            {loadingTransactions ? (
                              <div className="flex items-center justify-center h-6">
                                <svg className="animate-spin h-4 w-4 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                              </div>
                      ) : (
                              <span className="text-base font-medium text-geist-accent-900 dark:text-geist-foreground">
                                {transactions.length}
                        </span>
                      )}
              </div>
            </div>
                      </div>
                    </div>

                    {/* Desktop View */}
                    <div className="hidden lg:block p-6">
                    <h2 className="text-xl font-bold mb-6 text-geist-accent-900 dark:text-geist-foreground">Wallet Overview</h2>
                      <div className="grid grid-cols-3 gap-8">
                      <div className="p-4 bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl">
                        <div className="text-3xl font-bold text-geist-accent-900 dark:text-geist-foreground mb-2">
                          {formData.walletAddresses.filter(addr => addr.length >= 32).length}
                    </div>
                        <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                          Connected Wallets
                    </div>
                    </div>

                      <div className="p-4 bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl">
                        {loadingBalances ? (
                          <div className="flex items-center justify-center h-full">
                            <svg className="animate-spin h-6 w-6 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                    </div>
                        ) : (
                          <>
                            <div className="text-3xl font-bold text-geist-success dark:text-green-300 mb-2">
                              {Object.values(walletBalances).reduce((sum, balance) => sum + balance, 0).toFixed(4)} SOL
                    </div>
                            <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                              Current Balance
                  </div>
                          </>
                        )}
                </div>

                      <div className="p-4 bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl">
                        <div className="text-3xl font-bold text-geist-accent-900 dark:text-geist-foreground mb-2">
                          {loadingTransactions ? (
                            <div className="flex items-center justify-center">
                              <svg className="animate-spin h-6 w-6 text-geist-accent-900 dark:text-geist-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                    </div>
                          ) : transactions.length}
                    </div>
                        <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                          Total Transactions
                          </div>
                    </div>
                    </div>
                  </div>
                </div>

                {/* Transaction Dashboard */}
                  <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-lg border border-geist-accent-200 dark:border-geist-accent-700 p-6 animate-fade-in">
                    <h2 className="text-xl font-bold mb-6 text-geist-accent-900 dark:text-geist-foreground">Transaction Dashboard</h2>
                    
                    <TransactionDashboard 
                      transactions={dbTransactions} 
                      selectedWallet={selectedWallet}
                      walletMap={walletMap}
                      walletAddresses={formData.walletAddresses}
                      walletNames={formData.walletNames}
                      onWalletSelect={setSelectedWallet}
                      loading={loading}
                      batchProgress={batchProgress}
                      walletProcessingStatus={walletProcessingStatus}
                      queueWalletForProcessing={queueWalletForProcessing}
                      validateWalletAddress={validateWalletAddress}
                    />
                      </div>
                    </div>
                  )}

              {activeSection === 'reports' && (
                <div className="mt-6 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-lg border border-geist-accent-200 dark:border-geist-accent-700 p-6 animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-geist-accent-900 dark:text-geist-foreground">Tax Reports</h2>
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm rounded-full">
                      Coming Soon
                    </span>
                    </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 opacity-60">
                    {/* Reports content */}
                </div>
              </div>
            )}
        </div>
          )}
        </AppLayout>
      )}
    </div>
  );
}

export default App;
export { DarkModeToggle };