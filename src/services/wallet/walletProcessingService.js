/**
 * Service for handling wallet processing queue and status
 */
export default class WalletProcessingService {
  constructor(cacheService, transactionService) {
    this.cacheService = cacheService;
    this.transactionService = transactionService;
  }

  /**
   * Queue a wallet for processing if another wallet is currently being processed
   * @param {string} walletAddress - The wallet address to queue 
   * @param {object} currentStatus - Current wallet processing status
   * @param {function} onStatusChange - Callback to update wallet status
   * @param {function} onProcessWallet - Callback to process a wallet immediately
   * @returns {boolean} - Whether the wallet was queued (true) or processed immediately (false)
   */
  queueWalletForProcessing(walletAddress, currentStatus, onStatusChange, onProcessWallet) {
    if (walletAddress.length < 32) {
      return false;
    }

    // Check if a wallet is currently being processed
    if (currentStatus.currentWallet) {
      // If this wallet is already in the queue or completed, no need to add it again
      if (currentStatus.queuedWallets.includes(walletAddress) || 
          currentStatus.completedWallets.includes(walletAddress)) {
        return false;
      }
      
      // Add the wallet to the queue
      onStatusChange(prev => ({
        ...prev,
        queuedWallets: [...prev.queuedWallets, walletAddress]
      }));
      return true; // Wallet was successfully queued
    }
    
    // If no wallet is currently being processed, process this one immediately
    onProcessWallet(walletAddress);
    return false; // Wallet was not queued, but processed immediately
  }

  /**
   * Process the next wallet in the queue
   * @param {object} currentStatus - Current wallet processing status
   * @param {function} onStatusChange - Callback to update wallet status
   * @param {function} onProcessWallet - Callback to process a wallet
   * @param {number} delay - Delay in ms before processing the next wallet
   * @returns {boolean} - Whether there was a next wallet to process
   */
  processNextWallet(currentStatus, onStatusChange, onProcessWallet, delay = 500) {
    // If there are no queued wallets, nothing to do
    if (!currentStatus.queuedWallets || currentStatus.queuedWallets.length === 0) {
      return false;
    }
    
    const nextWallet = currentStatus.queuedWallets[0];
    const remainingQueue = currentStatus.queuedWallets.slice(1);
    
    // Update the queue immediately
    onStatusChange(prev => ({
      ...prev,
      currentWallet: nextWallet,
      queuedWallets: remainingQueue
    }));
    
    // Start processing the next wallet after a delay
    setTimeout(() => {
      onProcessWallet(nextWallet);
    }, delay);
    
    return true;
  }
  
  /**
   * Mark a wallet as completed
   * @param {string} walletAddress - The wallet address to mark as completed
   * @param {object} currentStatus - Current wallet processing status
   * @param {function} onStatusChange - Callback to update wallet status
   * @returns {object} - Updated wallet status
   */
  markWalletAsCompleted(walletAddress, currentStatus, onStatusChange) {
    // If the wallet is already completed, no need to update
    if (currentStatus.completedWallets.includes(walletAddress)) {
      return currentStatus;
    }
    
    // Update the wallet status to mark as completed
    const updatedStatus = {
      ...currentStatus,
      currentWallet: null,
      completedWallets: [...currentStatus.completedWallets, walletAddress]
    };
    
    onStatusChange(updatedStatus);
    return updatedStatus;
  }
} 