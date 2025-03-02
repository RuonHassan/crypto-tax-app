import React, { useState, useEffect, useRef, useCallback } from 'react';
// Add CSS import for animations if not already included in your app
import './styles/animations.css';

import LandingPage from './components/LandingPage';
import UserInformationPage from './components/UserInformationPage';
import { useAuth } from './contexts/AuthContext';

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

  return (
    <div className={`min-h-screen bg-gradient-to-b from-geist-accent-100 to-white dark:from-geist-background dark:to-geist-accent-800 ${appLoaded ? 'fade-in' : 'opacity-0'}`}>
      <DarkModeToggle />
      
      {showLandingPage ? (
        <LandingPage onGetStarted={startOnboarding} />
      ) : showUserInfoPage ? (
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
        />
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="py-6">
            <div className="flex justify-between items-center">
              <div className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground flex items-center">
                <span className="text-3xl mr-2 bg-geist-success bg-opacity-90 text-white px-3 py-1 rounded-lg transform -rotate-3">Tax</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500">AI</span>
              </div>
              <button 
                onClick={toggleUserInfoPage} 
                className="px-4 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-lg hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Manage Information
              </button>
            </div>
          </nav>

          {/* Step 1: Wallet Input */}
          {onboardingStep === 1 && (
            <div className="py-12 text-center relative">
              {/* Decorative elements */}
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-geist-success bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500 bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
              
              <h1 className="text-4xl font-bold mb-2 animate-fade-in">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500 dark:from-blue-400 dark:to-green-300">
                  Add Your Wallets
                </span>
            </h1>
              <p className="text-xl text-geist-accent-600 dark:text-geist-accent-300 animate-fade-in-delay mb-12">
                Let's connect your crypto wallets to analyze your transactions
              </p>

              <div className="max-w-2xl mx-auto">
                <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
                  <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Your Wallets</h2>
                  
                  {formData.walletAddresses.map((address, index) => (
                    <div key={index} className="mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                            Wallet Name
                  </label>
                  <input
                    type="text"
                            value={formData.walletNames[index] || `Wallet ${index + 1}`}
                            onChange={(e) => handleWalletNameChange(index, e.target.value)}
                            className="input w-full"
                            placeholder="My Main Wallet"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                            Solana Wallet Address
                  </label>
                          <div className="flex gap-2">
                  <input
                    type="text"
                              value={address}
                              onChange={(e) => {
                                const updatedAddresses = [...formData.walletAddresses];
                                updatedAddresses[index] = e.target.value;
                                handleInputChange({ 
                                  target: { name: 'walletAddresses', value: updatedAddresses }
                                });
                              }}
                              className="input w-full"
                              placeholder="Solana Wallet Address"
                            />
                            {index > 0 && (
                              <button
                                onClick={() => {
                                  const updatedAddresses = formData.walletAddresses.filter((_, i) => i !== index);
                                  const updatedNames = formData.walletNames.filter((_, i) => i !== index);
                                  setFormData(prev => ({
                                    ...prev,
                                    walletAddresses: updatedAddresses,
                                    walletNames: updatedNames
                                  }));
                                }}
                                className="px-4 py-2 bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-800 transition-colors"
                              >
                                Remove
                              </button>
                            )}
                </div>
              </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex justify-between mt-8">
                    <button 
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          walletAddresses: [...prev.walletAddresses, ''],
                          walletNames: [...prev.walletNames, `Wallet ${prev.walletAddresses.length + 1}`]
                        }));
                      }}
                      className="px-4 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-lg hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors"
                    >
                      Add Another Wallet
                    </button>
                    
                    <button
                      onClick={goToTraditionalIncomeStep}
                      disabled={!formData.walletAddresses.some(addr => addr.length >= 32)}
                      className="px-8 py-3 bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={goBackToPreviousStep}
                  className="px-6 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-xl font-medium hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors inline-flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Landing Page
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Traditional Income */}
          {onboardingStep === 2 && (
            <div className="py-12 text-center relative">
              {/* Decorative elements */}
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-geist-success bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500 bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
              
              <h1 className="text-4xl font-bold mb-2 animate-fade-in">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500 dark:from-blue-400 dark:to-green-300">
                  Non-Crypto Income
                </span>
              </h1>
              <p className="text-xl text-geist-accent-600 dark:text-geist-accent-300 animate-fade-in-delay mb-12">
                Add your other income sources for a complete tax picture
              </p>

              <div className="max-w-2xl mx-auto">
                <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
                  <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Traditional Income</h2>
                  
                  <div className="grid grid-cols-1 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                      Salary Income
                    </label>
                    <input
                      type="number"
                      name="salary"
                      value={formData.salary}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                      Stock Trading Income
                    </label>
                    <input
                      type="number"
                      name="stockIncome"
                      value={formData.stockIncome}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                      Real Estate Income
                    </label>
                    <input
                      type="number"
                      name="realEstateIncome"
                      value={formData.realEstateIncome}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
                      Dividend Income
                    </label>
                    <input
                      type="number"
                      name="dividends"
                      value={formData.dividends}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="0.00"
                    />
                </div>
              </div>

                  <div className="flex justify-between">
                <button
                      onClick={goBackToPreviousStep}
                      className="px-6 py-3 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-xl font-semibold hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors"
                    >
                      <span className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                    </span>
                </button>
                
                    <div className="flex space-x-3">
                  <button
                        onClick={skipToResults}
                        className="px-6 py-3 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-xl font-semibold hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors"
                  >
                        Skip
                  </button>
                
                  <button
                        onClick={skipToResults}
                        className="px-8 py-3 bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1"
                  >
                        Continue to Dashboard
                  </button>
                    </div>
                  </div>
              </div>
            </div>

              {loadingBalances && (
                <div className="mt-8 bg-white dark:bg-geist-accent-800 rounded-xl p-4 max-w-md mx-auto animate-fade-in-delay">
                  <p className="mb-2 text-geist-accent-600 dark:text-geist-accent-300">Fetching your wallet balances...</p>
                  <div className="flex justify-center">
                    <svg className="animate-spin h-6 w-6 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <p className="mt-2 text-sm text-geist-accent-500">This information will be displayed in your dashboard.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Dashboard - Restructured */}
          {onboardingStep === 3 && (
            <div>
              <div className="py-8 text-center relative">
                {/* Decorative elements */}
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-geist-success bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500 bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
                
                <h1 className="text-4xl font-bold mb-2 animate-fade-in">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500 dark:from-blue-400 dark:to-green-300">
                    Crypto Tax Dashboard
                  </span>
                </h1>
                <p className="text-xl text-geist-accent-600 dark:text-geist-accent-300 animate-fade-in-delay">
                  Track all your assets in one place
                      </p>
                    </div>

              <div className="max-w-6xl mx-auto px-4 py-4">
                {/* Transaction Status Section - Always visible at the top */}
                <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 mb-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
                  <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Transaction Status</h2>
                  
                  {loadingTransactions ? (
                    <div className="text-center">
                      <div className="w-full bg-geist-accent-200 dark:bg-geist-accent-700 rounded-full h-4 mb-6">
                        <div 
                          className="bg-gradient-to-r from-geist-success to-blue-500 h-4 rounded-full transition-all duration-300" 
                          style={{ width: `${loadingProgress}%` }}
                        ></div>
                    </div>
                      <p className="text-geist-accent-900 dark:text-geist-foreground font-medium mb-2">
                        Processing Transactions... {loadingProgress.toFixed(0)}%
                      </p>
                      
                      {/* Wallet Processing Queue Status */}
                      {walletProcessingStatus.processingAll && (
                        <div className="mb-4">
                          <div className="bg-geist-accent-50 dark:bg-geist-accent-700/50 p-4 rounded-lg text-left">
                            <h3 className="text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">Wallet Processing Queue:</h3>
                            
                            {walletProcessingStatus.currentWallet && (
                              <div className="flex items-center mb-3 bg-geist-accent-100 dark:bg-geist-accent-700 p-2 rounded-md">
                                <div className="mr-2 relative">
                                  <svg className="animate-spin h-5 w-5 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                    </div>
                                <div>
                                  <div className="text-sm font-medium text-geist-accent-900 dark:text-geist-foreground">
                                    {formData.walletNames[formData.walletAddresses.indexOf(walletProcessingStatus.currentWallet)] || 'Wallet'}
                                  </div>
                                  <div className="text-xs text-geist-accent-500">
                                    Currently Processing: {walletProcessingStatus.currentWallet.slice(0, 6)}...{walletProcessingStatus.currentWallet.slice(-4)}
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {walletProcessingStatus.queuedWallets.length > 0 && (
                              <div className="mb-2">
                                <div className="text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-1">In Queue:</div>
                                {walletProcessingStatus.queuedWallets.map((address, index) => (
                                  <div key={address} className="flex items-center mb-1 ml-2 text-sm text-geist-accent-600 dark:text-geist-accent-400">
                                    <div className="w-5 h-5 mr-2 flex items-center justify-center">
                                      <span className="h-2 w-2 bg-geist-accent-400 dark:bg-geist-accent-500 rounded-full"></span>
                                    </div>
                                    <span>
                                      {formData.walletNames[formData.walletAddresses.indexOf(address)] || `Wallet ${index + 1}`} 
                                      <span className="text-xs ml-1 text-geist-accent-500">
                                        ({address.slice(0, 6)}...{address.slice(-4)})
                                      </span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {walletProcessingStatus.completedWallets.length > 0 && (
                              <div>
                                <div className="text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-1">Completed:</div>
                                {walletProcessingStatus.completedWallets.map((address, index) => (
                                  <div key={address} className="flex items-center mb-1 ml-2 text-sm text-geist-success dark:text-green-400">
                                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>
                                      {formData.walletNames[formData.walletAddresses.indexOf(address)] || `Wallet ${index + 1}`} 
                                      <span className="text-xs ml-1 text-geist-accent-500">
                                        ({address.slice(0, 6)}...{address.slice(-4)})
                                      </span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className="text-xs text-geist-accent-500 mt-3">
                              Data for completed wallets is already visible in the dashboard below.
                              <br />Select a wallet from the Portfolio section to view its specific transactions.
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <p className="text-geist-accent-600 dark:text-geist-accent-300 mb-4">
                        We're analyzing your wallet transactions and calculating your taxes. Your portfolio is already visible above.
                      </p>
                      
                      {/* Rate limiting info */}
                      {rateLimitInfo.isLimited && (
                        <div className="mt-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-left">
                          <p className="text-amber-700 dark:text-amber-400 flex items-center mb-1">
                            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="font-medium">API Rate Limiting Detected</span>
                          </p>
                          <p className="text-sm text-amber-600 dark:text-amber-300">
                            We're being rate-limited by the blockchain API. This is normal for large wallets and will resolve automatically. 
                            The analysis will continue but may take longer than expected.
                          </p>
                          <div className="mt-2 flex items-center justify-between text-xs text-amber-500">
                            <span>Retry attempts: {rateLimitInfo.retryCount}/{RATE_LIMIT.MAX_RETRIES}</span>
                            <span>Throttle events: {rateLimitInfo.totalDelays}</span>
                    </div>
                        </div>
                      )}
                      
                      <div className="mt-4 text-xs text-geist-accent-500 bg-geist-accent-50 dark:bg-geist-accent-700/50 p-3 rounded">
                        <p className="mb-1"><span className="font-medium">Processing large wallets:</span> Wallets with many transactions will take longer to analyze.</p>
                        <p><span className="font-medium">API rate limits:</span> Blockchain API rate limits may slow down processing of very active wallets.</p>
                      </div>
                    </div>
                  ) : !transactions.length ? (
                    <div className="text-center px-4 py-12 border-2 border-dashed border-geist-accent-300 dark:border-geist-accent-600 rounded-xl">
                      <div className="w-16 h-16 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-geist-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-medium text-geist-accent-900 dark:text-geist-foreground mb-2">No Transaction Data Yet</h3>
                      <p className="text-geist-accent-600 dark:text-geist-accent-300 mb-6">
                        Click "Analyze Transactions" to begin processing your wallet activity. Your wallet balances are already displayed above.
                      </p>
                      <button
                        onClick={analyzeTaxes}
                        className="px-6 py-3 bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1"
                      >
                        Analyze Transactions
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-geist-success dark:text-green-300 mb-2">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="font-medium">Transaction data loaded successfully!</p>
                      <div className="flex justify-center mt-4 gap-4">
                        <button
                          onClick={analyzeTaxes}
                          className="px-6 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-lg hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors"
                        >
                          Refresh Data
                        </button>
                        <button
                          onClick={toggleUserInfoPage}
                          className="px-6 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-lg hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors"
                        >
                          Edit Information
                        </button>
                  </div>
                    </div>
                  )}
                </div>

                {/* Dashboard Sections */}
                <div className="animate-fade-in-delay-2">
                  {/* Portfolio Section */}
                  <div className="mb-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8">
                    <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Portfolio</h2>
                    
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-medium text-geist-accent-700 dark:text-geist-accent-300">Balance Overview</h3>
                      <button 
                        onClick={fetchWalletBalances}
                        disabled={loadingBalances}
                        className="px-3 py-1 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-lg hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors flex items-center text-sm"
                      >
                        {loadingBalances ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-geist-accent-900 dark:text-geist-accent-100" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Fetching...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh Balances
                          </>
                        )}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                    
                    {/* Wallet Breakdown */}
                    <div className="mt-8 pt-6 border-t border-geist-accent-200 dark:border-geist-accent-700">
                      <h3 className="text-lg font-medium text-geist-accent-900 dark:text-geist-foreground mb-4">Wallet Breakdown</h3>
                      
                      {loadingBalances ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-geist-accent-600 dark:text-geist-accent-300">Loading wallet balances...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-hidden bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-700 rounded-lg">
                          <table className="min-w-full divide-y divide-geist-accent-200 dark:divide-geist-accent-700">
                            <thead className="bg-geist-accent-50 dark:bg-geist-accent-700">
                              <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-geist-accent-600 dark:text-geist-accent-300 uppercase tracking-wider">
                                  Wallet Name
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-geist-accent-600 dark:text-geist-accent-300 uppercase tracking-wider">
                                  Transactions
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-geist-accent-600 dark:text-geist-accent-300 uppercase tracking-wider">
                                  Balance
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-geist-accent-600 dark:text-geist-accent-300 uppercase tracking-wider">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-geist-accent-800 divide-y divide-geist-accent-200 dark:divide-geist-accent-700">
                              {formData.walletAddresses.filter(addr => addr.length >= 32).map((address, index) => {
                                // Get wallet transactions
                                const walletTxs = transactions.filter(tx => tx.sourceWallet === address);
                                // Get on-chain balance for this wallet
                                const onChainBalance = walletBalances[address] || 0;
                                
                                // Determine wallet status
                                const isProcessing = walletProcessingStatus.currentWallet === address;
                                const isQueued = walletProcessingStatus.queuedWallets.includes(address);
                                const isCompleted = walletProcessingStatus.completedWallets.includes(address);
                                const isProcessingAll = walletProcessingStatus.processingAll;
                                
                                return (
                                  <tr key={address} className={`${isProcessing ? 'bg-geist-accent-50 dark:bg-geist-accent-700/50' : ''} hover:bg-geist-accent-50 dark:hover:bg-geist-accent-700 cursor-pointer`}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <div className="mr-3">
                                          {isProcessing && (
                                            <svg className="animate-spin h-5 w-5 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                          )}
                                          {isQueued && isProcessingAll && (
                                            <div className="w-5 h-5 flex items-center justify-center">
                                              <span className="h-2 w-2 bg-geist-accent-400 dark:bg-geist-accent-500 rounded-full"></span>
                                            </div>
                                          )}
                                          {isCompleted && (
                                            <svg className="w-5 h-5 text-geist-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-sm font-medium text-geist-accent-900 dark:text-geist-foreground">
                                            {formData.walletNames[formData.walletAddresses.indexOf(address)]}
                                            {isProcessing && <span className="ml-2 text-xs bg-geist-success text-white px-2 py-0.5 rounded-full">Processing</span>}
                                            {isQueued && isProcessingAll && <span className="ml-2 text-xs bg-geist-accent-400 dark:bg-geist-accent-600 text-white px-2 py-0.5 rounded-full">Queued</span>}
                                          </div>
                                          <div className="text-xs text-geist-accent-500">
                                            {address.slice(0, 6)}...{address.slice(-4)}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-geist-accent-600 dark:text-geist-accent-300">
                                      {loadingTransactions && (isProcessing || isQueued) ? (
                                        <div className="flex items-center">
                                          {isProcessing ? (
                                            <svg className="animate-spin h-4 w-4 text-geist-accent-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                          ) : (
                                            <span className="text-xs text-geist-accent-500 inline-block mr-2">In-Queue</span>
                                          )}
                                          {isProcessing ? 'Loading...' : '—'}
                                        </div>
                                      ) : walletTxs.length}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-geist-success">
                                      {onChainBalance.toFixed(4)} SOL
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                      <button 
                                        onClick={() => setSelectedWallet(address)}
                                        className={`px-3 py-1 bg-geist-success text-white rounded-lg hover:bg-opacity-90 text-xs font-medium ${(isQueued && !isCompleted && loadingTransactions) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        disabled={isQueued && !isCompleted && loadingTransactions}
                                      >
                                        {(isQueued && !isCompleted && loadingTransactions) ? 'In-Queue' : 'View'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Your Crypto Section */}
                  <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 mb-8">
                    <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6 flex items-center justify-between">
                      <span>Your Crypto</span>
                      {selectedWallet !== 'all' && (
                        <span className="text-sm font-normal bg-geist-accent-100 dark:bg-geist-accent-700 px-3 py-1 rounded-lg">
                          Viewing: {formData.walletNames[formData.walletAddresses.indexOf(selectedWallet)] || 'Selected Wallet'}
                        </span>
                      )}
                    </h2>
                    
                    {/* Show different content based on loading state */}
                    {loadingTransactions && selectedWallet !== 'all' && walletProcessingStatus.currentWallet === selectedWallet && (
                      <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                          <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="text-geist-accent-700 dark:text-geist-accent-300 font-medium">Currently processing this wallet...</p>
                          <p className="text-sm text-geist-accent-500 mt-2">Transaction data will appear here once processing is complete.</p>
                        </div>
                      </div>
                    )}

                    {loadingTransactions && selectedWallet !== 'all' && walletProcessingStatus.queuedWallets.includes(selectedWallet) && (
                      <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                          <div className="w-10 h-10 mx-auto mb-4 bg-geist-accent-200 dark:bg-geist-accent-700 rounded-full flex items-center justify-center">
                            <div className="h-3 w-3 bg-geist-accent-400 dark:bg-geist-accent-500 rounded-full"></div>
                          </div>
                          <p className="text-geist-accent-700 dark:text-geist-accent-300 font-medium">This wallet is queued for processing</p>
                          <p className="text-sm text-geist-accent-500 mt-2">
                            Waiting for {walletProcessingStatus.currentWallet ? 
                              `${formData.walletNames[formData.walletAddresses.indexOf(walletProcessingStatus.currentWallet)] || 'current wallet'}` : 
                              'previous wallets'} to complete.
                      </p>
                    </div>
                      </div>
                    )}

                    {loadingTransactions && selectedWallet !== 'all' && walletProcessingStatus.completedWallets.includes(selectedWallet) && (
                      <TransactionDashboard 
                        transactions={transactions.filter(tx => selectedWallet === 'all' || tx.sourceWallet === selectedWallet)} 
                        selectedWallet={selectedWallet}
                        walletMap={formData.walletAddresses.reduce((map, address, index) => {
                          if (address.length >= 32) {
                            map[address] = formData.walletNames[index];
                          }
                          return map;
                        }, {})}
                        walletAddresses={formData.walletAddresses.filter(addr => addr.length >= 32)}
                        walletNames={formData.walletNames.filter((_, index) => formData.walletAddresses[index].length >= 32)}
                        onWalletSelect={setSelectedWallet}
                      />
                    )}

                    {loadingTransactions && selectedWallet !== 'all' && 
                      walletProcessingStatus.currentWallet !== selectedWallet && 
                      !walletProcessingStatus.queuedWallets.includes(selectedWallet) &&
                      !walletProcessingStatus.completedWallets.includes(selectedWallet) && (
                      <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                          <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="text-geist-accent-700 dark:text-geist-accent-300 font-medium">Loading transactions...</p>
                          <p className="text-sm text-geist-accent-500 mt-2">Transaction data will appear here once loading is complete.</p>
                        </div>
                      </div>
                    )}

                    {loadingTransactions && selectedWallet === 'all' && (
                      <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                          <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-geist-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="text-geist-accent-700 dark:text-geist-accent-300 font-medium">Loading transactions...</p>
                          <p className="text-sm text-geist-accent-500 mt-2">
                            Currently processing: {walletProcessingStatus.currentWallet ? 
                              formData.walletNames[formData.walletAddresses.indexOf(walletProcessingStatus.currentWallet)] || 'Wallet' : 
                              'All wallets'}
                          </p>
                          <p className="text-sm text-geist-accent-500 mt-1">
                            {walletProcessingStatus.completedWallets.length > 0 && (
                              <span>Completed wallets: {walletProcessingStatus.completedWallets.length}</span>
                            )}
                            {walletProcessingStatus.queuedWallets.length > 0 && (
                              <span> • Queued wallets: {walletProcessingStatus.queuedWallets.length}</span>
                            )}
                      </p>
                    </div>
                      </div>
                    )}
                    
                    {!loadingTransactions && transactions.length > 0 && (
                      <TransactionDashboard 
                        transactions={transactions.filter(tx => selectedWallet === 'all' || tx.sourceWallet === selectedWallet)} 
                        selectedWallet={selectedWallet}
                        walletMap={formData.walletAddresses.reduce((map, address, index) => {
                          if (address.length >= 32) {
                            map[address] = formData.walletNames[index];
                          }
                          return map;
                        }, {})}
                        walletAddresses={formData.walletAddresses.filter(addr => addr.length >= 32)}
                        walletNames={formData.walletNames.filter((_, index) => formData.walletAddresses[index].length >= 32)}
                        onWalletSelect={setSelectedWallet}
                      />
                    )}
                    
                    {!loadingTransactions && transactions.length === 0 && (
                      <div className="text-center py-10 border-2 border-dashed border-geist-accent-300 dark:border-geist-accent-600 rounded-xl">
                        <div className="w-16 h-16 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-geist-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-medium text-geist-accent-900 dark:text-geist-foreground mb-2">No Transactions Yet</h3>
                        <p className="text-geist-accent-600 dark:text-geist-accent-300 mb-4 max-w-md mx-auto">
                          Click "Analyze Transactions" in the Transaction Status section above to load your transaction data.
                      </p>
                    </div>
                    )}
                  </div>

                  {/* Tax Summary Section */}
                  <div className="mb-8 bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8">
                    <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Tax Summary</h2>
                    
                    {loadingTransactions ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[1, 2, 3].map((item) => (
                          <div key={item} className="p-4 bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl flex items-center justify-center">
                            <svg className="animate-pulse h-6 w-6 text-geist-accent-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <rect width="18" height="4" x="3" y="6" rx="2" fill="currentColor" opacity="0.3" />
                              <rect width="10" height="4" x="3" y="14" rx="2" fill="currentColor" opacity="0.3" />
                            </svg>
                          </div>
                        ))}
                      </div>
                    ) : results ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-4 bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl">
                          <div className="text-3xl font-bold text-geist-accent-900 dark:text-geist-foreground mb-2">
                            ${Math.abs(results.crypto.realizedGains).toFixed(2)}
                          </div>
                          <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                            Total {results.crypto.realizedGains >= 0 ? 'Gains' : 'Losses'}
                  </div>
                </div>

                        <div className="p-4 bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl">
                          <div className="text-3xl font-bold text-geist-accent-900 dark:text-geist-foreground mb-2">
                            ${Math.abs(results.crypto.estimatedTax).toFixed(2)}
                          </div>
                          <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                            Estimated Tax
                          </div>
                </div>

                        <div className="p-4 bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl">
                          <div className="text-3xl font-bold text-geist-accent-900 dark:text-geist-foreground mb-2">
                            ${Math.abs(results.crypto.totalVolume).toFixed(2)}
                          </div>
                          <div className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                            Total Volume
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-geist-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-medium text-geist-accent-900 dark:text-geist-foreground mb-2">No Tax Data Yet</h3>
                        <p className="text-geist-accent-600 dark:text-geist-accent-300 mb-4 max-w-md mx-auto">
                          Your tax summary will appear here after transaction analysis is complete.
                        </p>
                      </div>
                    )}

                {/* Tax Forms Section */}
                    {results && (
                <div className="mt-8 pt-8 border-t border-geist-accent-200 dark:border-geist-accent-700">
                  <h3 className="text-lg font-medium text-geist-accent-900 dark:text-geist-foreground mb-4">Required Tax Forms</h3>
                  
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="border border-geist-accent-200 dark:border-geist-accent-700 rounded-lg p-4 hover:border-geist-accent-400 transition-all duration-300 bg-white dark:bg-geist-accent-800 hover:shadow-lg hover:-translate-y-1 group">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                                <h4 className="font-medium text-geist-accent-800 dark:text-geist-foreground">Form 8949</h4>
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">Sales and Other Dispositions of Capital Assets</p>
                        </div>
                        <button
                          onClick={() => generateTaxForm('8949')}
                                className="px-4 py-1 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 rounded-lg transition-all duration-300 group-hover:scale-105"
                        >
                          Download
                        </button>
                      </div>
                      <p className="text-xs text-geist-accent-500">Required for reporting your crypto trades</p>
                    </div>

                          <div className="border border-geist-accent-200 dark:border-geist-accent-700 rounded-lg p-4 hover:border-geist-accent-400 transition-all duration-300 bg-white dark:bg-geist-accent-800 hover:shadow-lg hover:-translate-y-1 group">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                                <h4 className="font-medium text-geist-accent-800 dark:text-geist-foreground">Schedule D</h4>
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">Capital Gains and Losses</p>
                        </div>
                        <button
                          onClick={() => generateTaxForm('scheduleD')}
                                className="px-4 py-1 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 rounded-lg transition-all duration-300 group-hover:scale-105"
                        >
                          Download
                        </button>
                      </div>
                      <p className="text-xs text-geist-accent-500">Summary of all capital gains/losses</p>
                    </div>

                          <div className="border border-geist-accent-200 dark:border-geist-accent-700 rounded-lg p-4 hover:border-geist-accent-400 transition-all duration-300 bg-white dark:bg-geist-accent-800 hover:shadow-lg hover:-translate-y-1 group">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                                <h4 className="font-medium text-geist-accent-800 dark:text-geist-foreground">Form 1040</h4>
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">U.S. Individual Income Tax Return</p>
                        </div>
                        <button
                          onClick={() => generateTaxForm('1040')}
                                className="px-4 py-1 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 rounded-lg transition-all duration-300 group-hover:scale-105"
                        >
                          Download
                        </button>
                      </div>
                      <p className="text-xs text-geist-accent-500">Main tax return form</p>
                    </div>
                  </div>

                        <div className="mt-4 flex justify-center">
                    <button
                      onClick={generateAllForms}
                            className="px-6 py-3 bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1"
                    >
                      Download All Forms
                    </button>
                </div>
              </div>
            )}
                  </div>
                </div>
          </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
export { DarkModeToggle };