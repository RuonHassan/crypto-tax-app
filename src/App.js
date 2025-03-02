import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// Add CSS import for animations if not already included in your app
import './styles/animations.css';

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
  groupTransactions 
} from './utils/transactionUtils';

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

import calculateTaxes from './calculateTaxes';

import priceService from './services/priceService';

import TransactionDashboard from './components/TransactionDashboard.js';

const CACHE_KEY_PREFIX = 'solana_tx_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const SOLANA_RPC_ENDPOINT = 'https://rpc.helius.xyz/?api-key=268519a5-accf-40b1-9fe3-d0d61fe3a5ce';

const RATE_LIMIT = {
  WALLET_DELAY: 2000,      // Reduced from 3000ms to 2000ms
  REQUEST_DELAY: 500,      // Reduced from 800ms to 500ms
  BATCH_DELAY: 1500,       // Reduced from 2000ms to 1500ms
  MAX_RETRIES: 5,
  INITIAL_BACKOFF: 2000    // 2 seconds initial backoff
};

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

function App() {
  const { user } = useAuth();
  
  // Create refs for functions to break circular dependencies
  const analyzeTaxesRef = useRef(null);
  const processNextWalletInQueueRef = useRef(null);
  
  // Initialize refs after all functions are defined
  useEffect(() => {
    // Use a small timeout to ensure all functions are defined
    const timer = setTimeout(() => {
      // At this point, all functions should be defined
      analyzeTaxesRef.current = analyzeTaxes;
      
      // Replace the check with assignment to an empty function as a fallback
      processNextWalletInQueueRef.current = () => {
        console.log("processNextWalletInQueue called but not fully initialized");
      };
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    walletAddresses: [''],
    walletNames: ['My Wallet'],
    salary: '',
    stockIncome: '',
    realEstateIncome: '',
    dividends: ''
  });


  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
const [showLandingPage, setShowLandingPage] = useState(true);
const [bypassCache, setBypassCache] = useState(false);
  // Add state for rate limiting info
  const [rateLimitInfo, setRateLimitInfo] = useState({
    isLimited: false,
    retryCount: 0,
    totalDelays: 0
  });
  
  // Add state for selected wallet
  const [selectedWallet, setSelectedWallet] = useState('all');
  
  // Add onboarding step tracking
  const [onboardingStep, setOnboardingStep] = useState(0);
  // 0 = Landing page
  // 1 = Wallet input
  // 2 = Traditional income input
  // 3 = Dashboard

  // Add a state to track if the user info page is shown
  const [showUserInfoPage, setShowUserInfoPage] = useState(false);

  // Add a state to track if the app has loaded
  const [appLoaded, setAppLoaded] = useState(false);
  
  // Add state variable for wallet balances
  const [walletBalances, setWalletBalances] = useState({});
  
  // Add separate loading states for balances and transactions
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  
  // Add state for tracking wallet processing status
  const [walletProcessingStatus, setWalletProcessingStatus] = useState({
    currentWallet: null,
    queuedWallets: [],
    completedWallets: [],
    processingAll: false
  });
  
  const [userProfile, setUserProfile] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showWalletInputs, setShowWalletInputs] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard'); // To track which section is active
  
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
    
    // Load wallet balances and then start analyzing transactions
    const validWalletAddresses = formData.walletAddresses.filter(addr => addr.length >= 32);
    if (validWalletAddresses.length > 0) {
      await fetchWalletBalances();
      analyzeTaxes();
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
  
  const getFiscalYearDates = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-based
  
    // If we're in the first half of the calendar year, use previous year
    const fiscalYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    
    const startDate = new Date(`${fiscalYear}-07-01`);
    const endDate = new Date(`${fiscalYear + 1}-06-30`);
  
    return { startDate, endDate };
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
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  };

  const fetchWithRetry = async (fn, maxRetries = RATE_LIMIT.MAX_RETRIES, initialDelay = RATE_LIMIT.INITIAL_BACKOFF) => {
    let retries = 0;
    let delay = initialDelay;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        retries++;
        if (retries > maxRetries || !error.message?.includes('429')) {
          throw error;
        }
        
        // Update rate limit info for UI feedback
        setRateLimitInfo(prev => ({
          isLimited: true,
          retryCount: retries,
          totalDelays: prev.totalDelays + 1
        }));
        
        console.log(`Rate limited. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
        await sleep(delay);
        delay *= 2; // Exponential backoff
      }
    }
  };

  const fetchSolanaTransactions = async (walletAddress) => {
    console.log('Starting transaction fetch for wallet:', walletAddress);
    
    if (!walletAddress || walletAddress.length < 32) {
      throw new Error('Invalid wallet address format');
    }

    // Check cache first
    const cacheKey = `${walletAddress}_${getFiscalYearDates().startDate.getTime()}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log('Found cached transactions');
      return cachedData;
    }

    try {
      const connection = new Connection(SOLANA_RPC_ENDPOINT, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
        httpHeaders: {
          'Cache-Control': 'max-age=3600',
          'Retry-After': '5'
        }
      });
      
      const publicKey = new PublicKey(walletAddress);
      const { startDate, endDate } = getFiscalYearDates();
      const startTime = startDate.getTime() / 1000;
      const endTime = endDate.getTime() / 1000;

      // Further optimized batch settings
      const BATCH_SIZE = 75;           // Increased from 50 to 75
      const PARALLEL_BATCHES = 3;      // Increased from 2 to 3
      const SIGNATURE_BATCH_SIZE = 100; // Separate larger batch size for signatures
      
      let allTransactions = [];
      let before = undefined;
      let hasMore = true;
      let totalSignatures = [];

      // First phase: Get all signatures with smart rate limiting
      console.log('Phase 1: Fetching transaction signatures...');
      let signatureBatchCounter = 0;
      
      while (hasMore) {
        try {
          signatureBatchCounter++;
          const signatures = await fetchWithRetry(async () => {
            return await connection.getSignaturesForAddress(
              publicKey,
              { before, limit: SIGNATURE_BATCH_SIZE }
            );
          });

          if (!signatures || signatures.length === 0) {
            hasMore = false;
            continue;
          }

          // Filter signatures by date range - do this immediately to reduce memory usage
          const validSignatures = signatures.filter(sig => 
            sig.blockTime && sig.blockTime >= startTime && sig.blockTime <= endTime
          );

          if (validSignatures.length === 0) {
            if (signatures[signatures.length - 1].blockTime < startTime) {
              hasMore = false;
              continue;
            }
          }

          totalSignatures.push(...validSignatures);
          before = signatures[signatures.length - 1].signature;

          // More granular progress updates
          setLoadingProgress(Math.min((totalSignatures.length / 1000) * 50, 49));
          
          // Adaptive rate limiting based on batch count to avoid hitting rate limits
          const currentDelay = signatureBatchCounter % 5 === 0 
            ? RATE_LIMIT.REQUEST_DELAY * 2  // Every 5th batch, wait a bit longer
            : RATE_LIMIT.REQUEST_DELAY;
            
          await sleep(currentDelay);
        } catch (error) {
          if (error.message?.includes('429')) {
            console.log('Rate limit hit during signature fetch, waiting...');
            await sleep(RATE_LIMIT.WALLET_DELAY);
            continue;
          }
          throw error;
        }
      }

      console.log(`Found ${totalSignatures.length} transactions in date range`);

      // Second phase: Process transactions in optimized parallel batches
      console.log('Phase 2: Processing transaction details...');
      const processedTxs = [];
      
      // Pre-sort signatures by timestamp to process most recent first (often more relevant)
      totalSignatures.sort((a, b) => b.blockTime - a.blockTime);
      
      // Process in chunks to avoid memory issues with large transaction counts
      const chunkSize = 75; // Increase chunk size for better throughput
      
      for (let i = 0; i < totalSignatures.length; i += chunkSize) {
        const chunk = totalSignatures.slice(i, i + chunkSize);
        console.log(`Processing chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(totalSignatures.length/chunkSize)}`);
        
        // Process the current chunk in parallel batches
        for (let j = 0; j < chunk.length; j += PARALLEL_BATCHES) {
          const batchPromises = [];
          
          // Create a batch of promises
          for (let k = 0; k < PARALLEL_BATCHES && j + k < chunk.length; k++) {
            const idx = j + k;
            const sig = chunk[idx];
            
            batchPromises.push(
              (async () => {
                try {
                  // Use pre-fetch caching to improve performance
                  const cacheSubKey = `tx_${sig.signature}`;
                  const cachedTx = getFromCache(cacheSubKey);
                  
                  if (cachedTx) {
                    return cachedTx;
                  }
                  
                  const tx = await fetchWithRetry(async () => {
                    return await connection.getTransaction(sig.signature, {
                      maxSupportedTransactionVersion: 0
                    });
                  });
                  
                  if (!tx || !tx.transaction || !tx.meta) return null;
                  
                  const accountKeys = tx.transaction.message.accountKeys || [];
                  const walletIndexes = accountKeys
                    .map((key, index) => ({ key: key?.toString() || '', index }))
                    .filter(({ key }) => key === walletAddress);
                  
                  if (!walletIndexes.length) return null;
                  
                  let txSolChange = 0;
                  walletIndexes.forEach(({ index }) => {
                    const preBalance = tx.meta.preBalances?.[index] ?? 0;
                    const postBalance = tx.meta.postBalances?.[index] ?? 0;
                    const change = (postBalance - preBalance) / LAMPORTS_PER_SOL;
                    
                    if (tx.transaction.message.isAccountWritable?.(index)) {
                      txSolChange += change;
                    }
                  });
                  
                  if (Math.abs(txSolChange) > 0.000001) {
                    // Fetch prices in parallel
                    const [currentPrice, acquirePrice] = await Promise.all([
                      priceService.getPriceAtTimestamp(tx.blockTime),
                      priceService.getPriceAtTimestamp(tx.blockTime - (Math.random() * 365 * 24 * 60 * 60))
                    ]);
                    
                    // Extract program IDs for token identification - more efficiently
                    const programIds = new Set(); // Use a Set for deduplication
                    try {
                      tx.transaction.message.instructions.forEach(instruction => {
                        if (instruction.programIdIndex !== undefined) {
                          const programId = accountKeys[instruction.programIdIndex]?.toString();
                          if (programId) {
                            programIds.add(programId);
                          }
                        }
                      });
                    } catch (e) {
                      // Skip if we can't extract program IDs
                    }
                    
                    const programIdsArray = Array.from(programIds);
                    
                    // More efficient DEX checking
                    const DEX_PROGRAM_IDS = {
                      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter',
                      '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca',
                      'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX': 'Serum',
                      'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr': 'Raydium',
                      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM'
                    };
                    
                    // Check if any program ID is a DEX - more efficient
                    const isDexTransaction = programIdsArray.some(id => DEX_PROGRAM_IDS[id]);
                    
                    // Find the DEX program ID if it exists
                    const dexProgramId = programIdsArray.find(id => DEX_PROGRAM_IDS[id]);
                    
                    // Known token accounts - expanded list
                    const knownTokens = {
                      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
                      'So11111111111111111111111111111111111111112': 'SOL',
                      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
                      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
                      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
                      '7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx': 'JUNGLE',
                      'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6': 'KIN'
                    };
                    
                    // More efficient token account detection
                    const transactionTokens = [];
                    const accountSet = new Set(accountKeys.map(key => key?.toString()).filter(Boolean));
                    
                    for (const [mint, symbol] of Object.entries(knownTokens)) {
                      if (accountSet.has(mint)) {
                        transactionTokens.push({
                          mint,
                          symbol,
                          name: symbol
                        });
                      }
                    }
                    
                    // Determine transaction type (using proper constants from transactionUtils)
                    let txType = TRANSACTION_TYPES.TRANSFER;
                    let tokenAction = null;
                    
                    if (Math.abs(txSolChange) < 0.001) {
                      txType = TRANSACTION_TYPES.GAS;
                    } else if (isDexTransaction) {
                      // Token buy/sell transactions
                      if (transactionTokens.length > 0) {
                        txType = TRANSACTION_TYPES.TOKEN_TRANSACTION;
                        tokenAction = txSolChange < 0 ? "Buy" : "Sell";
                      } else {
                        // Generic swap if we can't determine the token
                        txType = TRANSACTION_TYPES.SWAP;
                      }
                    }
                    
                    const processedTx = {
                      signature: sig.signature,
                      timestamp: tx.blockTime,
                      solChange: txSolChange,
                      success: !tx.meta.err,
                      priceAtSale: currentPrice || 30,
                      priceAtAcquisition: acquirePrice || 25,
                      valueUSD: txSolChange * (currentPrice || 30),
                      programId: dexProgramId || (programIdsArray[0] || 'unknown'),
                      type: txType,
                      tokenAction: tokenAction,
                      tokenInfo: transactionTokens.length > 0 ? {
                        symbol: transactionTokens[0].symbol,
                        name: transactionTokens[0].name
                      } : null,
                      accounts: Array.from(accountSet),
                      tokens: transactionTokens,
                      programIds: programIdsArray,
                      isDexTransaction: isDexTransaction,
                      dex: dexProgramId ? DEX_PROGRAM_IDS[dexProgramId] : null
                    };
                    
                    // Cache individual transaction
                    saveToCache(cacheSubKey, processedTx);
                    
                    return processedTx;
                  }
                  
                  return null;
                } catch (error) {
                  if (error.message?.includes('429')) {
                    console.log('Rate limit hit, will retry in the next batch');
                    throw error; // Let fetchWithRetry handle the retry logic
                  }
                  console.error(`Error processing transaction: ${error.message}`);
                  return null;
                }
              })()
            );
          }
          
          // Wait for the current batch to complete
          const results = await Promise.allSettled(batchPromises);
          const successfulTxs = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);
          
          processedTxs.push(...successfulTxs);
          
          // Update progress - more granular
          const progressPercent = 50 + Math.min((processedTxs.length / totalSignatures.length) * 50, 49);
          setLoadingProgress(progressPercent);
          
          // Adaptive batch delay based on success rate
          const successRate = successfulTxs.length / batchPromises.length;
          const adjustedDelay = successRate < 0.5 
            ? RATE_LIMIT.BATCH_DELAY * 1.5  // If seeing high failure rate, slow down
            : RATE_LIMIT.BATCH_DELAY;
            
          await sleep(adjustedDelay);
        }
      }

      // Process and sort transactions
      let runningBalance = 0;
      const processedTransactions = processedTxs
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(tx => {
          const oldBalance = runningBalance;
          runningBalance += tx.solChange;
          return {
            ...tx,
            runningBalance,
            balanceBefore: oldBalance,
            realizedGain: tx.solChange < 0 ? 
              Math.abs(tx.solChange) * (tx.priceAtSale - tx.priceAtAcquisition) : 0
          };
        });

      // Cache the results
      saveToCache(cacheKey, processedTransactions);
      setLoadingProgress(100);
      return processedTransactions;

    } catch (error) {
      console.error('Error in fetchSolanaTransactions:', error);
      throw error;
    }
  };

  // Fetch current wallet balance directly from blockchain
  const fetchCurrentBalance = async (walletAddress) => {
    try {
      console.log('Fetching current balance for:', walletAddress);
      const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
      
      const pubKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(pubKey);
      
      // Convert lamports to SOL
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error fetching current balance:', error);
      return null;
    }
  };

  // Fetch all wallet balances
  const fetchAllWalletBalances = async () => {
    const validWalletAddresses = formData.walletAddresses.filter(addr => addr.length >= 32);
    const walletBalances = {};
    
    for (const address of validWalletAddresses) {
      try {
        const balance = await fetchCurrentBalance(address);
        if (balance !== null) {
          walletBalances[address] = balance;
        }
      } catch (error) {
        console.error(`Error fetching balance for ${address}:`, error);
        walletBalances[address] = 0;
      }
      // Add a small delay to avoid rate limits
      await sleep(200);
    }
    
    setWalletBalances(walletBalances);
    return walletBalances;
  };

  // Function to add a wallet to the processing queue if there's already one being processed
  const queueWalletForProcessing = (walletAddress) => {
    if (walletAddress.length < 32) {
      alert('Please enter a valid Solana wallet address (minimum 32 characters)');
      return false;
    }

    // Check if a wallet is currently being processed
    if (walletProcessingStatus.currentWallet) {
      // If this wallet is already in the queue or completed, no need to add it again
      if (walletProcessingStatus.queuedWallets.includes(walletAddress) || 
          walletProcessingStatus.completedWallets.includes(walletAddress)) {
        return false;
      }
      
      // Add the wallet to the queue
      setWalletProcessingStatus(prev => ({
        ...prev,
        queuedWallets: [...prev.queuedWallets, walletAddress]
      }));
      return true; // Wallet was successfully queued
    }
    
    // If no wallet is currently being processed, process this one immediately
    analyzeTaxes(walletAddress);
    return false; // Wallet was not queued, but processed immediately
  };

  // Function to analyze taxes with updated wallet balance fetching
  const analyzeTaxes = async (specificWalletAddress = null) => {
    console.log('Starting tax analysis...');
    
    // Reset bypass flag for future runs and rate limiting info
    setBypassCache(false);
    setRateLimitInfo({
      isLimited: false,
      retryCount: 0,
      totalDelays: 0
    });
    
    // Only reset selected wallet to 'all' when doing a full analysis
    if (!specificWalletAddress) {
      setSelectedWallet('all');
    }
    
    try {
      // First step: Fetch current on-chain balances
      await fetchWalletBalances();
      
      // Second step: Process transactions
      console.log('Starting transaction processing...');
      setLoadingTransactions(true);
      setLoadingProgress(0);
      
      let allTransactions = [];
      let validWalletAddresses = formData.walletAddresses.filter(addr => addr.length >= 32);
      
      // If a specific wallet address is provided, only process that one
      if (specificWalletAddress) {
        console.log(`Analyzing specific wallet: ${specificWalletAddress}`);
        validWalletAddresses = validWalletAddresses.filter(addr => addr === specificWalletAddress);
        
        // Set the selected wallet to the specified one
        setSelectedWallet(specificWalletAddress);
        
        // Update wallet processing status for a single wallet
        setWalletProcessingStatus(prev => ({
          currentWallet: specificWalletAddress,
          queuedWallets: [],
          // Preserve existing completed wallets instead of resetting them
          completedWallets: prev.completedWallets || [],
          processingAll: false
        }));
      } else {
        // If processing all wallets, set up a processing queue
      if (validWalletAddresses.length > 0) {
          setWalletProcessingStatus({
            currentWallet: validWalletAddresses[0],
            queuedWallets: validWalletAddresses.slice(1),
            completedWallets: [],
            processingAll: true
          });
        }
      }
      
      if (validWalletAddresses.length > 0) {
        const userWallets = new Set(formData.walletAddresses.filter(addr => addr.length >= 32));

        // Process wallets sequentially with delays
        for (let i = 0; i < validWalletAddresses.length; i++) {
          const walletAddress = validWalletAddresses[i];
          
          // Update current processing wallet
          if (!specificWalletAddress) {
            console.log(`Processing wallet ${i+1}/${validWalletAddresses.length}: ${walletAddress}`);
            setWalletProcessingStatus(prev => ({
              ...prev,
              currentWallet: walletAddress,
              queuedWallets: validWalletAddresses.slice(i + 1),
              completedWallets: prev.completedWallets
            }));
          }
          
          try {
            const walletTransactions = await fetchSolanaTransactions(walletAddress);
            
            // Get the wallet name
            const walletName = formData.walletNames[formData.walletAddresses.indexOf(walletAddress)] || `Wallet ${i+1}`;
            
            const taggedTransactions = walletTransactions.map(tx => {
              // Find if this is an internal transfer and identify destination wallet
              const destinationWalletAddress = tx.accounts.find(account => 
                account !== walletAddress && userWallets.has(account)
              );
              
              // Get destination wallet name if this is an internal transfer
              let destinationWalletName = null;
              if (destinationWalletAddress) {
                const destIndex = formData.walletAddresses.findIndex(addr => addr === destinationWalletAddress);
                destinationWalletName = destIndex >= 0 ? formData.walletNames[destIndex] : 'Unknown Wallet';
              }
              
              return {
              ...tx,
              sourceWallet: walletAddress,
                sourceWalletName: walletName,
                isInternalTransfer: !!destinationWalletAddress,
                destinationWallet: destinationWalletAddress,
                destinationWalletName: destinationWalletName
              };
            });
            
            // For a specific wallet, replace transactions rather than append
            if (specificWalletAddress) {
              // Filter out old transactions for this wallet if they exist 
              const otherWalletTxs = transactions.filter(tx => tx.sourceWallet !== specificWalletAddress);
              allTransactions = [...otherWalletTxs, ...taggedTransactions];
            } else {
            allTransactions = [...allTransactions, ...taggedTransactions];
            }
            
            setLoadingProgress((i + 1) / validWalletAddresses.length * 100);
            
            // Mark this wallet as completed
            if (!specificWalletAddress) {
              setWalletProcessingStatus(prev => ({
                ...prev,
                completedWallets: [...prev.completedWallets, walletAddress]
              }));
            } else {
              // For single wallet processing, mark it as completed when done
              setWalletProcessingStatus(prev => {
                const updatedStatus = {
                  ...prev,
                  currentWallet: null,
                  // Add the wallet to completed wallets if not already there
                  completedWallets: prev.completedWallets.includes(specificWalletAddress) 
                    ? prev.completedWallets 
                    : [...prev.completedWallets, specificWalletAddress]
                };
                
                // Process the next wallet in the queue if there are any
                if (prev.queuedWallets.length > 0) {
                  const nextWallet = prev.queuedWallets[0];
                  const remainingQueue = prev.queuedWallets.slice(1);
                  
                  // Start processing the next wallet in the queue
                  setTimeout(() => {
                    analyzeTaxes(nextWallet);
                  }, 500); // Small delay before starting the next wallet
                  
                  // Update the queue
                  updatedStatus.currentWallet = nextWallet;
                  updatedStatus.queuedWallets = remainingQueue;
                }
                
                return updatedStatus;
              });
            }
            
            // Set transactions after each wallet is processed so user can see
            // partial results while other wallets are loading
            const tempTxs = [...allTransactions];
            tempTxs.sort((a, b) => a.timestamp - b.timestamp);
            const { transactions: groupedTxs } = groupTransactions(tempTxs);
            setTransactions(groupedTxs);
            
            // Add delay between wallet processing
            if (i < validWalletAddresses.length - 1) {
              await sleep(RATE_LIMIT.WALLET_DELAY);
            }
          } catch (error) {
            console.error(`Error processing wallet ${walletAddress}: ${error.message}`);
            
            // Even if there's an error, mark this wallet as completed to move on
            if (!specificWalletAddress) {
              setWalletProcessingStatus(prev => ({
                ...prev,
                completedWallets: [...prev.completedWallets, walletAddress]
              }));
            } else if (specificWalletAddress === walletAddress) {
              // For single wallet processing with error, still mark it as completed
              setWalletProcessingStatus(prev => {
                const updatedStatus = {
                  ...prev,
                  currentWallet: null,
                  completedWallets: prev.completedWallets.includes(specificWalletAddress)
                    ? prev.completedWallets
                    : [...prev.completedWallets, specificWalletAddress]
                };
                
                // Process the next wallet in the queue if there are any
                if (prev.queuedWallets.length > 0) {
                  const nextWallet = prev.queuedWallets[0];
                  const remainingQueue = prev.queuedWallets.slice(1);
                  
                  // Start processing the next wallet in the queue
                  setTimeout(() => {
                    analyzeTaxes(nextWallet);
                  }, 500); // Small delay before starting the next wallet
                  
                  // Update the queue
                  updatedStatus.currentWallet = nextWallet;
                  updatedStatus.queuedWallets = remainingQueue;
                }
                
                return updatedStatus;
              });
            }
            
            // Continue with next wallet
          }
        }

        // Sort all transactions by timestamp
        allTransactions.sort((a, b) => a.timestamp - b.timestamp);

        // Group related transactions (internal transfers, swaps, etc.)
        const { transactions: groupedTxs, gasFees } = groupTransactions(allTransactions);
        
        // Process transactions for tax calculations
        const processedTransactions = groupedTxs.map(tx => {
          if (tx.isInternalTransfer) {
            return {
              ...tx,
              type: TRANSACTION_TYPES.INTERNAL_TRANSFER,
              taxableEvent: false, // Internal transfers aren't taxable
              realizedGain: 0
            };
          }
          return tx;
        });

        console.log('Setting transactions:', processedTransactions);
        setTransactions(processedTransactions);

        // Calculate tax implications
        const nonGasTransactions = processedTransactions.filter(tx => 
          tx.type !== 'gas' && !tx.isInternalTransfer
        );

        const results = {
          crypto: {
            totalTrades: nonGasTransactions.length,
            totalVolume: calculateVolume(nonGasTransactions),
            realizedGains: nonGasTransactions.reduce((sum, tx) => sum + (tx.realizedGain || 0), 0),
            estimatedTax: nonGasTransactions.reduce((sum, tx) => sum + ((tx.realizedGain || 0) * 0.30), 0),
            gasFees: gasFees,
            internalTransfers: processedTransactions.filter(tx => tx.isInternalTransfer).length
          },
          traditional: {
            totalIncome: Number(formData.salary) || 0,
            stockGains: Number(formData.stockIncome) || 0,
            realEstateGains: Number(formData.realEstateIncome) || 0,
            dividendIncome: Number(formData.dividends) || 0,
            estimatedTax: calculateTaxes({
              salary: Number(formData.salary) || 0,
              stockIncome: Number(formData.stockIncome) || 0,
              realEstateIncome: Number(formData.realEstateIncome) || 0,
              dividends: Number(formData.dividends) || 0
            }, processedTransactions).incomeTax
          }
        };

        console.log('Setting results:', results);
        setResults(results);
        
        // Reset wallet processing status when done
        setWalletProcessingStatus({
          currentWallet: null,
          queuedWallets: [],
          completedWallets: validWalletAddresses,
          processingAll: false
        });
      }
    } catch (error) {
      console.error('Error in analyzeTaxes:', error);
      
      // Reset wallet processing status on error
      setWalletProcessingStatus({
        currentWallet: null,
        queuedWallets: [],
        completedWallets: [],
        processingAll: false
      });
    } finally {
      setLoadingTransactions(false);
      setLoadingProgress(100);
    }
  };

  const generateTaxForm = (formType) => {
    const formTemplates = {
      '8949': `Form 8949 - Sales and Other Dispositions of Capital Assets
    Taxpayer: ${formData.firstName} ${formData.lastName}
    Tax Year: ${new Date().getFullYear()}
    
    Part I - Short-term Capital Gains and Losses
    ${results?.crypto?.totalTrades ? `Total Trades: ${results.crypto.totalTrades}
    Total Gains/Losses: $${results.crypto.realizedGains.toFixed(2)}` : 'No trades to report'}
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
      const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
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
              handleInputChange={handleInputChange}
              handleWalletNameChange={handleWalletNameChange}
              analyzeTaxes={analyzeTaxes}
              loading={loading}
              loadingProgress={loadingProgress}
              results={results}
              clearTransactionCache={clearTransactionCache}
              clearAllTransactionCache={clearAllTransactionCache}
              setFormData={setFormData}
              goBackToDashboard={goToDashboard}
              walletProcessingStatus={walletProcessingStatus}
              queueWalletForProcessing={queueWalletForProcessing}
              user={user}
            />
          ) : (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {/* Conditional rendering based on active section */}
              {activeSection === 'wallets' && showWalletInputs && (
                /* Wallet Input Section */
                <div className="mt-12 max-w-3xl mx-auto text-center">
                  <h1 className="text-4xl font-bold mb-2 animate-fade-in">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500 dark:from-blue-400 dark:to-green-300">
                      Connect Your Wallets
                    </span>
            </h1>
                  <p className="text-xl text-geist-accent-600 dark:text-geist-accent-300 animate-fade-in-delay mb-12">
                    Add your Solana wallet addresses to begin transaction analysis
                  </p>
                  
                  <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-lg border border-geist-accent-200 dark:border-geist-accent-700 p-8 animate-fade-in-delay-2">
                    <div className="space-y-6">
                      {/* Dynamic wallet inputs */}
                      {formData.walletAddresses.map((address, index) => (
                        <div key={index} className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 text-left mb-2">
                              Wallet Name
                  </label>
                  <input
                    type="text"
                              value={formData.walletNames[index] || ''}
                              onChange={(e) => handleWalletNameChange(index, e.target.value)}
                              className="block w-full px-4 py-3 bg-geist-accent-100 dark:bg-geist-accent-700 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success transition-colors"
                              placeholder="My Wallet"
                  />
                </div>
                          
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 text-left mb-2">
                              Wallet Address
                  </label>
                            <div className="flex">
                  <input
                    type="text"
                                value={address}
                                onChange={(e) => {
                                  const newAddresses = [...formData.walletAddresses];
                                  newAddresses[index] = e.target.value;
                                  setFormData({
                                    ...formData,
                                    walletAddresses: newAddresses
                                  });
                                }}
                                className="block w-full px-4 py-3 bg-geist-accent-100 dark:bg-geist-accent-700 border border-geist-accent-200 dark:border-geist-accent-600 rounded-l-xl focus:ring-geist-success focus:border-geist-success transition-colors"
                                placeholder="Enter Solana wallet address"
                              />
                              <button
                                onClick={() => queueWalletForProcessing(address)}
                                disabled={!address || address.length < 32 || walletProcessingStatus.currentWallet === address || walletProcessingStatus.queuedWallets.includes(address)}
                                className="px-4 py-3 bg-geist-success text-white font-medium rounded-r-xl hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {walletProcessingStatus.currentWallet === address ? (
                                  <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing
                                  </span>
                                ) : walletProcessingStatus.queuedWallets.includes(address) ? (
                                  <span className="flex items-center">
                                    Queued
                                  </span>
                                ) : (
                                  <span className="flex items-center">
                                    Connect
                                  </span>
                                )}
                              </button>
                </div>
              </div>

                          {index > 0 && (
                            <button
                              onClick={() => {
                                const newAddresses = [...formData.walletAddresses];
                                newAddresses.splice(index, 1);
                                const newNames = [...formData.walletNames];
                                newNames.splice(index, 1);
                                setFormData({
                                  ...formData,
                                  walletAddresses: newAddresses,
                                  walletNames: newNames
                                });
                              }}
                              className="self-end px-3 py-3 text-geist-accent-600 hover:text-geist-accent-900 dark:text-geist-accent-400 dark:hover:text-geist-accent-100"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                </div>
                      ))}
              </div>

                    <div className="mt-6 flex">
                      <button
                        onClick={() => {
                          setFormData({
                            ...formData,
                            walletAddresses: [...formData.walletAddresses, ''],
                            walletNames: [...formData.walletNames, `My Wallet ${formData.walletAddresses.length + 1}`]
                          });
                        }}
                        className="flex items-center px-4 py-2 text-geist-accent-700 dark:text-geist-accent-300 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-lg hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 transition-colors"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Another Wallet
                      </button>
                </div>
              </div>

                  <div className="mt-8 flex justify-center">
                <button
                      onClick={() => {
                        if (formData.walletAddresses.some(addr => addr.length >= 32)) {
                          // Skip straight to analyzing taxes if we have a valid wallet address
                          skipToResults();
                        }
                      }}
                      disabled={!formData.walletAddresses.some(addr => addr.length >= 32) || loading}
                      className="px-8 py-3 bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-md"
                >
                  {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                    </span>
                  ) : (
                        <span>
                          Continue to Dashboard
                        </span>
                  )}
                </button>
                  </div>
                </div>
              )}
              
              {activeSection === 'dashboard' && (
                /* Dashboard Content */
                <div className="mt-6 grid grid-cols-1 gap-8">
                  {/* Transaction Dashboard */}
                  <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-lg border border-geist-accent-200 dark:border-geist-accent-700 p-6 animate-fade-in">
                    <h2 className="text-xl font-bold mb-6 text-geist-accent-900 dark:text-geist-foreground">Transaction Dashboard</h2>
                    
                    <TransactionDashboard 
                      transactions={transactions} 
                      selectedWallet={selectedWallet}
                      walletMap={walletMap}
                      walletAddresses={formData.walletAddresses}
                      walletNames={formData.walletNames}
                      onWalletSelect={setSelectedWallet}
                    />
                  </div>
                  
                  {/* Tax forms and calculations */}
                {results && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Tax Forms */}
                      <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-lg border border-geist-accent-200 dark:border-geist-accent-700 p-6 animate-fade-in col-span-1">
                        <h2 className="text-xl font-bold mb-6 text-geist-accent-900 dark:text-geist-foreground">Tax Forms</h2>
                        
                        <div className="space-y-4">
                  <button
                            onClick={() => generateTaxForm('8949')}
                            className="w-full flex items-center justify-between px-4 py-3 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 transition-colors"
                  >
                            <span className="font-medium text-geist-accent-900 dark:text-geist-foreground">Form 8949</span>
                            <svg className="w-5 h-5 text-geist-accent-500 dark:text-geist-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                  </button>
                
                  <button
                            onClick={() => generateTaxForm('schedule-d')}
                            className="w-full flex items-center justify-between px-4 py-3 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 transition-colors"
                  >
                            <span className="font-medium text-geist-accent-900 dark:text-geist-foreground">Schedule D</span>
                            <svg className="w-5 h-5 text-geist-accent-500 dark:text-geist-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                  </button>
                          
                          <button 
                            onClick={() => generateTaxForm('1040')}
                            className="w-full flex items-center justify-between px-4 py-3 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 transition-colors"
                          >
                            <span className="font-medium text-geist-accent-900 dark:text-geist-foreground">Form 1040</span>
                            <svg className="w-5 h-5 text-geist-accent-500 dark:text-geist-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          
                          <button 
                            onClick={() => generateTaxForm('schedule-1')}
                            className="w-full flex items-center justify-between px-4 py-3 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl hover:bg-geist-accent-200 dark:hover:bg-geist-accent-600 transition-colors"
                          >
                            <span className="font-medium text-geist-accent-900 dark:text-geist-foreground">Schedule 1</span>
                            <svg className="w-5 h-5 text-geist-accent-500 dark:text-geist-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          
                          <button 
                            onClick={generateAllForms}
                            className="w-full mt-4 px-4 py-3 bg-geist-success bg-opacity-90 text-white rounded-xl font-medium hover:bg-opacity-100 transition-colors"
                          >
                            Generate All Forms
                          </button>
              </div>
            </div>

                      {/* Tax Summary */}
                      <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-lg border border-geist-accent-200 dark:border-geist-accent-700 p-6 animate-fade-in col-span-2">
                        <h2 className="text-xl font-bold mb-6 text-geist-accent-900 dark:text-geist-foreground">
                          Tax Summary for {getFiscalYearDates().year}
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl p-5">
                            <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Total Capital Gains</div>
                            <div className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                              {results.totalCapitalGains > 0 ? '+' : ''}{results.totalCapitalGains.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'USD'
                              })}
                    </div>
                    </div>
                          
                          <div className="bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl p-5">
                            <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Estimated Tax Obligation</div>
                            <div className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                              {results.estimatedTaxes.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'USD'
                              })}
                    </div>
                    </div>
                          
                          <div className="bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl p-5">
                            <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Short-term Gains</div>
                            <div className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                              {results.shortTermGains > 0 ? '+' : ''}{results.shortTermGains.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'USD'
                              })}
                  </div>
                </div>

                          <div className="bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl p-5">
                            <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Long-term Gains</div>
                            <div className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                              {results.longTermGains > 0 ? '+' : ''}{results.longTermGains.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'USD'
                              })}
                    </div>
                    </div>
                    </div>
                    </div>
                  </div>
                  )}
                </div>
              )}
              {activeSection === 'reports' && (
                /* Tax Reports Section */
                <div className="mt-6 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-lg border border-geist-accent-200 dark:border-geist-accent-700 p-6 animate-fade-in">
                  <h2 className="text-xl font-bold mb-6 text-geist-accent-900 dark:text-geist-foreground">Tax Reports</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div 
                          onClick={() => generateTaxForm('8949')}
                      className="bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl p-5 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-geist-accent-900 dark:text-geist-foreground">Form 8949</h3>
                        <svg className="w-5 h-5 text-geist-accent-500 dark:text-geist-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </div>
                      <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                        Sales and Other Dispositions of Capital Assets
                      </p>
                    </div>

                    <div 
                      onClick={() => generateTaxForm('schedule-d')}
                      className="bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl p-5 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-geist-accent-900 dark:text-geist-foreground">Schedule D</h3>
                        <svg className="w-5 h-5 text-geist-accent-500 dark:text-geist-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </div>
                      <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                        Capital Gains and Losses
                      </p>
                    </div>

                    <div 
                          onClick={() => generateTaxForm('1040')}
                      className="bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl p-5 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-geist-accent-900 dark:text-geist-foreground">Form 1040</h3>
                        <svg className="w-5 h-5 text-geist-accent-500 dark:text-geist-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </div>
                      <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                        U.S. Individual Income Tax Return
                      </p>
                    </div>

                    <div 
                      onClick={() => generateTaxForm('schedule-1')}
                      className="bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl p-5 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-geist-accent-900 dark:text-geist-foreground">Schedule 1</h3>
                        <svg className="w-5 h-5 text-geist-accent-500 dark:text-geist-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </div>
                      <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                        Additional Income and Adjustments
                      </p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      onClick={generateAllForms}
                      className="px-6 py-3 bg-geist-success text-white rounded-xl font-medium hover:bg-opacity-90 transition-colors flex items-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Generate All Forms
                    </button>
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