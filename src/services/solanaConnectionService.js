import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';

let connection = null;
const RATE_LIMIT_RETRY_DELAY = 1000; // 1 second
const CONNECTION_TIMEOUT = 10000; // 10 seconds
const CONNECTION_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
let lastConnectionCheck = 0;

/**
 * Get a Solana connection instance
 * @param {boolean} forceNew - Force creation of a new connection
 * @returns {Connection} Solana connection
 */
export const getConnection = (forceNew = false) => {
  const now = Date.now();
  
  // Force new connection if:
  // 1. Explicitly requested OR
  // 2. No existing connection OR
  // 3. Connection hasn't been checked/validated in a while
  if (forceNew || !connection || (now - lastConnectionCheck > CONNECTION_CHECK_INTERVAL)) {
    // Check if Helius API endpoint is available in global scope (from App.js)
    const heliusEndpoint = window.SOLANA_RPC_ENDPOINT || process.env.REACT_APP_SOLANA_RPC_URL;
    
    // Use environment variable, Helius endpoint or fallback to public node
    const endpoint = heliusEndpoint || clusterApiUrl('mainnet-beta');
    
    console.log(`Creating new Solana connection to: ${endpoint}`);
    
    const opts = {
      commitment: 'confirmed',
      disableRetryOnRateLimit: false,
      confirmTransactionInitialTimeout: 60000
    };
    
    try {
      connection = new Connection(endpoint, opts);
      lastConnectionCheck = now;
      
      // Validate the connection (will log but not block)
      validateConnection().catch(err => 
        console.warn("Connection validation failed, but proceeding:", err.message)
      );
    } catch (error) {
      console.error("Failed to create Solana connection:", error.message);
      // Fallback to mainnet-beta if custom endpoint fails
      console.log("Falling back to public Solana endpoint");
      connection = new Connection(clusterApiUrl('mainnet-beta'), opts);
    }
  }
  
  return connection;
};

/**
 * Validate that the current connection is working
 * @returns {Promise<boolean>} True if connection is valid
 */
export const validateConnection = async () => {
  if (!connection) {
    throw new Error("No connection to validate");
  }
  
  try {
    // Simple validation by getting a recent blockhash
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Connection validation timed out")), CONNECTION_TIMEOUT)
    );
    
    const validationPromise = connection.getRecentBlockhash();
    
    // Race the validation against a timeout
    await Promise.race([validationPromise, timeoutPromise]);
    
    console.log("Solana connection validated successfully");
    lastConnectionCheck = Date.now();
    return true;
  } catch (error) {
    console.error("Invalid Solana connection:", error.message);
    resetConnection();
    throw error;
  }
};

/**
 * Validate a Solana wallet address
 * @param {string} address - Wallet address to validate
 * @returns {boolean} True if address is valid
 */
export const validateWalletAddress = (address) => {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Execute a Solana RPC call with retry for rate limit errors
 * @param {Function} call - Function that returns a promise to execute
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the call
 */
export const executeWithRetry = async (call, maxRetries = 3) => {
  let retries = 0;
  
  while (true) {
    try {
      // Make sure we have a valid connection before executing call
      getConnection();
      
      return await call();
    } catch (error) {
      const errorMsg = error.message || '';
      const isRateLimitError = 
        errorMsg.includes('429') || 
        errorMsg.includes('rate limit') || 
        error.name === 'TransportRateLimitExceeded';
      
      const isConnectionError = 
        errorMsg.includes('connection') || 
        errorMsg.includes('network') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('econnrefused');
      
      if (retries < maxRetries && (isRateLimitError || isConnectionError)) {
        retries++;
        const delay = RATE_LIMIT_RETRY_DELAY * Math.pow(2, retries - 1);
        
        // For connection errors, force a new connection on next attempt
        if (isConnectionError) {
          console.warn(`Connection error, resetting connection. Retry ${retries}/${maxRetries} in ${delay}ms`);
          resetConnection();
        } else {
          console.warn(`Rate limit hit, retrying (${retries}/${maxRetries}) in ${delay}ms...`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
};

/**
 * Reset the connection (useful after network errors)
 */
export const resetConnection = () => {
  console.log("Resetting Solana connection");
  connection = null;
  lastConnectionCheck = 0;
};

/**
 * Check Helius API health status directly via RPC call
 * @returns {Promise<string>} Health status string
 */
export const checkHeliusHealth = async () => {
  try {
    const heliusEndpoint = window.SOLANA_RPC_ENDPOINT || process.env.REACT_APP_SOLANA_RPC_URL;
    
    if (!heliusEndpoint) {
      throw new Error("No Helius endpoint configured");
    }
    
    const response = await fetch(heliusEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'health-check',
        method: 'getHealth',
        params: []
      })
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Health check error: ${JSON.stringify(data.error)}`);
    }
    
    console.log(`Helius API health status: ${data.result}`);
    return data.result;
  } catch (error) {
    console.error("Failed to check Helius API health:", error.message);
    throw error;
  }
};

export default {
  getConnection,
  executeWithRetry,
  resetConnection,
  validateConnection,
  validateWalletAddress,
  checkHeliusHealth
}; 