import React, { useState, useEffect } from 'react';
// Add CSS import for animations if not already included in your app
import './styles/animations.css';

import LandingPage from './components/LandingPage';

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
  
  // Add onboarding step tracking
  const [onboardingStep, setOnboardingStep] = useState(0);
  // 0 = Landing page
  // 1 = Wallet input
  // 2 = Traditional income input
  // 3 = Dashboard

  // Add a state to track if the app has loaded
  const [appLoaded, setAppLoaded] = useState(false);
  
  // Set app as loaded after a small delay
  useEffect(() => {
    const timer = setTimeout(() => setAppLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Start onboarding process
  const startOnboarding = () => {
    setShowLandingPage(false);
    setOnboardingStep(1);
  };

  // Move to traditional income step
  const goToTraditionalIncomeStep = () => {
    // Start loading transactions in background
    if (formData.walletAddresses.filter(addr => addr.length >= 32).length > 0) {
      analyzeTaxes();
    }
    setOnboardingStep(2);
  };

  // Skip traditional income and go to dashboard
  const skipToResults = () => {
    setOnboardingStep(3);
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
      const connection = new Connection('https://rpc.helius.xyz/?api-key=268519a5-accf-40b1-9fe3-d0d61fe3a5ce', {
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

  const analyzeTaxes = async () => {
    console.log('Starting tax analysis...');
    setLoading(true);
    setLoadingProgress(0);
    setBypassCache(false); // Reset bypass flag for future runs
    // Reset rate limiting info
    setRateLimitInfo({
      isLimited: false,
      retryCount: 0,
      totalDelays: 0
    });
    
    try {
      let allTransactions = [];
      const validWalletAddresses = formData.walletAddresses.filter(addr => addr.length >= 32);
      
      if (validWalletAddresses.length > 0) {
        const userWallets = new Set(validWalletAddresses);

        // Process wallets sequentially with delays
        for (let i = 0; i < validWalletAddresses.length; i++) {
          const walletAddress = validWalletAddresses[i];
          try {
            const walletTransactions = await fetchSolanaTransactions(walletAddress);
            
            const taggedTransactions = walletTransactions.map(tx => ({
              ...tx,
              sourceWallet: walletAddress,
              isInternalTransfer: tx.accounts.some(account => 
                account !== walletAddress && userWallets.has(account)
              ),
              destinationWallet: tx.accounts.find(account => 
                account !== walletAddress && userWallets.has(account)
              )
            }));
            
            allTransactions = [...allTransactions, ...taggedTransactions];
            
            setLoadingProgress((i + 1) / validWalletAddresses.length * 100);
            
            // Add delay between wallet processing
            if (i < validWalletAddresses.length - 1) {
              await sleep(RATE_LIMIT.WALLET_DELAY);
            }
          } catch (error) {
            console.error(`Error processing wallet ${walletAddress}: ${error.message}`);
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
              type: 'internal_transfer',
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
      }
    } catch (error) {
      console.error('Error in analyzeTaxes:', error);
    } finally {
      setLoading(false);
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
  return (
    <div className={`min-h-screen bg-gradient-to-b from-geist-accent-100 to-white dark:from-geist-background dark:to-geist-accent-800 ${appLoaded ? 'fade-in' : 'opacity-0'}`}>
      <DarkModeToggle />
      
      {showLandingPage ? (
        <LandingPage onGetStarted={startOnboarding} />
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="py-6">
            <div className="flex justify-between items-center">
              <div className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground flex items-center">
                <span className="text-3xl mr-2 bg-geist-success bg-opacity-90 text-white px-3 py-1 rounded-lg transform -rotate-3">Tax</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500">AI</span>
              </div>
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
              
              {loading && (
                <div className="mt-8 bg-white dark:bg-geist-accent-800 rounded-xl p-4 max-w-md mx-auto animate-fade-in-delay">
                  <p className="mb-2 text-geist-accent-600 dark:text-geist-accent-300">Loading your transactions...</p>
                  <div className="w-full bg-geist-accent-200 dark:bg-geist-accent-700 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-geist-success to-blue-500 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>
                  <p className="mt-2 text-sm text-geist-accent-500">This may take a few minutes. You can continue setup while we load.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Dashboard */}
          {onboardingStep === 3 && (
            <div>
              <div className="py-12 text-center relative">
                {/* Decorative elements */}
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-geist-success bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500 bg-opacity-10 rounded-full blur-3xl dark:bg-opacity-20 pointer-events-none"></div>
                
                <h1 className="text-4xl font-bold mb-2 animate-fade-in">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-geist-success to-blue-500 dark:from-blue-400 dark:to-green-300">
                    Complete Tax Assistant
                  </span>
                </h1>
                <p className="text-xl text-geist-accent-600 dark:text-geist-accent-300 animate-fade-in-delay">
                  Track all your assets in one place
                </p>
                <button
                  onClick={goBackToPreviousStep}
                  className="mt-4 px-6 py-2 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-xl font-medium hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 transition-colors inline-flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Income Form
                </button>
              </div>

              <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Main Form - Always visible */}
                <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 mb-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
                  <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Your Information</h2>
                  
                  {/* Wallets Section */}
                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-geist-accent-900 dark:text-geist-foreground mb-4">Your Wallets</h3>
                    <div className="space-y-2">
                      {formData.walletAddresses.map((address, index) => (
                        address.length >= 32 && (
                          <div key={index} className="flex justify-between items-center p-3 bg-geist-accent-50 dark:bg-geist-accent-700 rounded-lg">
                            <div>
                              <span className="font-medium">{formData.walletNames[index]}</span>
                              <div className="text-sm text-geist-accent-500">{address.slice(0, 8)}...{address.slice(-8)}</div>
                            </div>
                            <div className="text-geist-success">Connected</div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex justify-center gap-4">
                    <button
                      onClick={analyzeTaxes}
                      disabled={loading || formData.walletAddresses.filter(addr => addr.length >= 32).length === 0}
                      className="px-6 py-3 bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                    >
                      {loading ? (
                        <span>
                          Processing... {loadingProgress.toFixed(0)}%
                        </span>
                      ) : (
                        'Calculate Taxes'
                      )}
                    </button>
                    
                    {results && (
                      <button
                        onClick={clearTransactionCache}
                        className="px-6 py-3 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 rounded-xl font-semibold hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1"
                      >
                        Re-analyze Transactions
                      </button>
                    )}
                    
                    {results && (
                      <button
                        onClick={clearAllTransactionCache}
                        className="px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transform transition-all duration-300 hover:-translate-y-1"
                      >
                        Clear All Cache
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Transaction Status Section - Always visible */}
                <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 mb-8 transition-all duration-300 hover:shadow-lg animate-fade-in">
                  <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Transaction Status</h2>
                  
                  {loading ? (
                    <div className="text-center">
                      <div className="w-full bg-geist-accent-200 dark:bg-geist-accent-700 rounded-full h-4 mb-6">
                        <div 
                          className="bg-gradient-to-r from-geist-success to-blue-500 h-4 rounded-full transition-all duration-300" 
                          style={{ width: `${loadingProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-geist-accent-900 dark:text-geist-foreground font-medium mb-2">
                        Processing... {loadingProgress.toFixed(0)}%
                      </p>
                      <p className="text-geist-accent-600 dark:text-geist-accent-300 mb-4">
                        We're analyzing your wallet transactions and calculating your taxes.
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
                  ) : !results ? (
                    <div className="text-center px-4 py-12 border-2 border-dashed border-geist-accent-300 dark:border-geist-accent-600 rounded-xl">
                      <div className="w-16 h-16 bg-geist-accent-100 dark:bg-geist-accent-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-geist-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-medium text-geist-accent-900 dark:text-geist-foreground mb-2">No Transaction Data Yet</h3>
                      <p className="text-geist-accent-600 dark:text-geist-accent-300 mb-6">
                        Click "Calculate Taxes" to analyze your wallet transactions. Note that analyzing large wallets or multiple wallets may take several minutes to complete.
                      </p>
                      <div className="bg-geist-accent-50 dark:bg-geist-accent-700 p-4 rounded-lg inline-block">
                        <p className="text-sm text-geist-accent-700 dark:text-geist-accent-200">
                          <span className="font-medium">Pro tip:</span> The first time you analyze a wallet, it may take longer. Results will be cached for faster access later.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-geist-success dark:text-green-300 mb-2">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="font-medium">Transaction data loaded successfully!</p>
                    </div>
                  )}
                </div>

                {/* Results Section - Only visible if results exist */}
                {results !== null && (
                  <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-md border border-geist-accent-200 dark:border-geist-accent-700 p-8 transition-all duration-300 hover:shadow-lg animate-fade-in-delay">
                    <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">Tax Summary</h2>
                    
                    {/* Crypto Results */}
                    <div className="mb-8">
                      <h3 className="text-lg font-medium text-geist-accent-900 dark:text-geist-foreground mb-4">Crypto Assets</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Total Trades</p>
                          <p className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                            {results?.crypto?.totalTrades || 0}
                          </p>
                        </div>
                        <div className="bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Trading Volume</p>
                          <p className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                            ${(results?.crypto?.totalVolume || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Realized Gains</p>
                          <p className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                            ${(results?.crypto?.realizedGains || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Est. Tax</p>
                          <p className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                            ${(results?.crypto?.estimatedTax || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Gas Fees</p>
                          <p className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                            {(results?.crypto?.gasFees || 0).toFixed(4)} SOL
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Traditional Results */}
                    <div className="mb-8">
                      <h3 className="text-lg font-medium text-geist-accent-900 dark:text-geist-foreground mb-4">Traditional Assets</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Total Income</p>
                          <p className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                            ${results.traditional.totalIncome.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Stock Gains</p>
                          <p className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                            ${results.traditional.stockGains.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Real Estate</p>
                          <p className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                            ${results.traditional.realEstateGains.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-geist-accent-100 dark:bg-geist-accent-700 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
                          <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300 mb-1">Est. Tax</p>
                          <p className="text-2xl font-bold text-geist-accent-900 dark:text-geist-foreground">
                            ${results.traditional.estimatedTax.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Dashboard */}
                    <div className="mb-8 animate-fade-in-delay-2">
                      <h3 className="text-lg font-medium text-geist-accent-900 dark:text-geist-foreground mb-4">Transaction History</h3>
                      <TransactionDashboard transactions={transactions} />
                    </div>

                    {/* Tax Forms Section */}
                    <div className="mt-8 pt-8 border-t border-geist-accent-200 dark:border-geist-accent-700 animate-fade-in-delay-3">
                      <h3 className="text-lg font-medium text-geist-accent-900 dark:text-geist-foreground mb-4">Required Tax Forms</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                        <div className="border border-geist-accent-200 dark:border-geist-accent-700 rounded-lg p-4 hover:border-geist-accent-400 transition-all duration-300 bg-white dark:bg-geist-accent-800 hover:shadow-lg hover:-translate-y-1 group">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-medium text-geist-accent-800 dark:text-geist-foreground">Schedule 1</h4>
                              <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">Additional Income and Adjustments</p>
                            </div>
                            <button
                              onClick={() => generateTaxForm('schedule1')}
                              className="px-4 py-1 bg-geist-accent-200 dark:bg-geist-accent-700 text-geist-accent-900 dark:text-geist-accent-100 hover:bg-geist-accent-300 dark:hover:bg-geist-accent-600 rounded-lg transition-all duration-300 group-hover:scale-105"
                            >
                              Download
                            </button>
                          </div>
                          <p className="text-xs text-geist-accent-500">For reporting crypto mining and staking income</p>
                        </div>
                      </div>

                      {/* Download All Button */}
                      <div className="mt-6 pt-6 border-t border-geist-accent-200 dark:border-geist-accent-700">
                        <button
                          onClick={generateAllForms}
                          className="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-geist-success to-blue-500 hover:from-geist-success hover:to-blue-600 text-white rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 font-semibold"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download All Forms
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;