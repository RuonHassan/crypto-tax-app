// transactionProcessor.js
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import priceService from './services/priceService';
import { categorizeTransaction } from './utils/transactionUtils';

// Safe property access utility
const safeGet = (obj, path, defaultValue = null) => {
  try {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : defaultValue), obj);
  } catch (e) {
    console.debug(`Error accessing path ${path}:`, e);
    return defaultValue;
  }
};

// Transaction validation
const isValidTransaction = (tx) => {
  if (!tx || typeof tx !== 'object') return false;
  
  const hasRequiredProps = Boolean(
    safeGet(tx, 'transaction.message') &&
    safeGet(tx, 'meta.preBalances') &&
    safeGet(tx, 'meta.postBalances') &&
    safeGet(tx, 'blockTime')
  );
  
  return hasRequiredProps;
};

// Safe account key access
const getAccountKeys = (tx) => {
  const message = safeGet(tx, 'transaction.message', {});
  const accountKeys = safeGet(message, 'accountKeys', []);
  
  return Array.isArray(accountKeys) ? accountKeys : [];
};

// Process a single transaction
const processTransaction = async (tx, sig, walletAddress) => {
  try {
    if (!isValidTransaction(tx)) {
      console.warn(`Invalid transaction structure for ${sig}`);
      return null;
    }

    const accountKeys = getAccountKeys(tx);
    
    // Find wallet instances safely
    const walletIndexes = accountKeys
      .map((key, index) => ({
        key: typeof key?.toString === 'function' ? key.toString() : '',
        index
      }))
      .filter(({ key }) => key === walletAddress);

    if (!walletIndexes.length) {
      console.warn(`No wallet instances found in transaction ${sig}`);
      return null;
    }

    // Calculate balance changes safely
    let txSolChange = 0;
    const balanceDetails = [];

    for (const { index } of walletIndexes) {
      const preBalance = safeGet(tx, `meta.preBalances.${index}`, 0);
      const postBalance = safeGet(tx, `meta.postBalances.${index}`, 0);
      const change = (postBalance - preBalance) / LAMPORTS_PER_SOL;
      
      let isWritable = false;
      try {
        isWritable = safeGet(tx, 'transaction.message.isAccountWritable')(index);
      } catch (err) {
        console.debug(`Could not determine if account ${index} is writable`);
      }
      
      balanceDetails.push({
        index,
        preBalance: preBalance / LAMPORTS_PER_SOL,
        postBalance: postBalance / LAMPORTS_PER_SOL,
        change,
        isWritable
      });
      
      if (isWritable) {
        txSolChange += change;
      }
    }

    // Get price data
    const currentPrice = await priceService.getPriceAtTimestamp(tx.blockTime);
    const acquireTime = tx.blockTime - (Math.random() * 365 * 24 * 60 * 60);
    const acquirePrice = await priceService.getPriceAtTimestamp(acquireTime);

    const programId = safeGet(tx, 'transaction.message.instructions.0.programId.toString', () => 'unknown')();

    return {
      signature: sig,
      timestamp: tx.blockTime,
      date: new Date(tx.blockTime * 1000).toLocaleDateString(),
      solChange: txSolChange,
      success: !safeGet(tx, 'meta.err'),
      acquisitionTimestamp: acquireTime,
      priceAtSale: currentPrice || 30,
      priceAtAcquisition: acquirePrice || 25,
      valueUSD: txSolChange * (currentPrice || 30),
      programId,
      type: categorizeTransaction({ 
        solChange: txSolChange, 
        programId 
      }),
      volume: Math.abs(txSolChange) * (currentPrice || 30),
      isGasFee: Math.abs(txSolChange) < 0.001,
      balanceDetails,
      accounts: accountKeys.map(key => key?.toString() || '')
    };
  } catch (error) {
    console.error(`Error processing transaction ${sig}:`, error);
    return null;
  }
};

// Process transaction with retry mechanism
const processTransactionWithRetry = async (tx, sig, walletAddress, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await processTransaction(tx, sig, walletAddress);
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    } catch (error) {
      console.warn(`Retry ${i + 1} failed for transaction ${sig}:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return null;
};

export {
  processTransaction,
  processTransactionWithRetry,
  isValidTransaction,
  safeGet
};