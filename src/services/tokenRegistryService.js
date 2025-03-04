import { PublicKey } from '@solana/web3.js';
import { getConnection } from './solanaConnectionService';

/**
 * Service to handle token metadata fetching and caching
 */
class TokenRegistryService {
  constructor() {
    // Token metadata cache
    this.tokenCache = new Map();
    // Default known tokens as fallback
    this.knownTokens = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
      },
      'So11111111111111111111111111111111111111112': {
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      },
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png'
      },
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
        symbol: 'mSOL',
        name: 'Marinade staked SOL',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png'
      },
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
        symbol: 'BONK',
        name: 'Bonk',
        decimals: 5,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png'
      }
    };
    
    // Token Metadata Program ID
    this.TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    
    // Cache expiration time (24 hours)
    this.CACHE_EXPIRATION = 24 * 60 * 60 * 1000;
    
    // Maximum batch size for token fetching
    this.MAX_BATCH_SIZE = 10;
    
    // Fetch queue for rate limiting
    this.fetchQueue = [];
    this.isFetching = false;
  }
  
  /**
   * Get token metadata from cache or fetch from on-chain sources
   * @param {string} tokenAddress - The token mint address
   * @param {boolean} forceRefresh - Force refresh from chain instead of using cache
   * @returns {Promise<Object>} The token metadata
   */
  async getTokenMetadata(tokenAddress, forceRefresh = false) {
    if (!tokenAddress) return null;
    
    // Normalize the token address
    try {
      tokenAddress = new PublicKey(tokenAddress).toString();
    } catch (error) {
      console.error(`Invalid token address: ${tokenAddress}`);
      return null;
    }
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh) {
      const cachedToken = this.getCachedToken(tokenAddress);
      if (cachedToken) return cachedToken;
    }
    
    // Check known tokens list as fallback
    if (this.knownTokens[tokenAddress]) {
      // Cache the result
      this.cacheToken(tokenAddress, this.knownTokens[tokenAddress]);
      return this.knownTokens[tokenAddress];
    }
    
    // Queue fetch request
    return this.queueTokenFetch(tokenAddress);
  }
  
  /**
   * Queue a token fetch request
   * @param {string} tokenAddress 
   * @returns {Promise<Object>} The token metadata
   */
  async queueTokenFetch(tokenAddress) {
    return new Promise((resolve) => {
      this.fetchQueue.push({
        tokenAddress,
        resolve
      });
      
      // Start processing the queue if not already processing
      if (!this.isFetching) {
        this.processFetchQueue();
      }
    });
  }
  
  /**
   * Process the token fetch queue
   */
  async processFetchQueue() {
    if (this.fetchQueue.length === 0 || this.isFetching) {
      return;
    }
    
    this.isFetching = true;
    
    try {
      // Take a batch of requests from the queue
      const batch = this.fetchQueue.splice(0, this.MAX_BATCH_SIZE);
      const tokenAddresses = batch.map(item => item.tokenAddress);
      
      // Fetch metadata for all tokens in batch
      const metadataResults = await this.fetchBatchTokenMetadata(tokenAddresses);
      
      // Resolve each promise with its result
      batch.forEach((item, index) => {
        const result = metadataResults[index] || this.createDefaultTokenInfo(item.tokenAddress);
        // Cache the result
        this.cacheToken(item.tokenAddress, result);
        // Resolve the promise
        item.resolve(result);
      });
    } catch (error) {
      console.error('Error processing token fetch queue:', error);
      // If there was an error, resolve remaining items in this batch with default values
      const batch = this.fetchQueue.splice(0, this.MAX_BATCH_SIZE);
      batch.forEach(item => {
        const result = this.createDefaultTokenInfo(item.tokenAddress);
        item.resolve(result);
      });
    } finally {
      this.isFetching = false;
      
      // If there are more items in the queue, continue processing
      if (this.fetchQueue.length > 0) {
        setTimeout(() => this.processFetchQueue(), 100); // Small delay to prevent rate limiting
      }
    }
  }
  
  /**
   * Fetch metadata for a batch of tokens
   * @param {string[]} tokenAddresses 
   * @returns {Promise<Object[]>} Array of token metadata objects
   */
  async fetchBatchTokenMetadata(tokenAddresses) {
    try {
      const connection = getConnection();
      const results = await Promise.allSettled(
        tokenAddresses.map(address => this.fetchTokenMetadata(connection, address))
      );
      
      return results.map(result => 
        result.status === 'fulfilled' ? result.value : null
      );
    } catch (error) {
      console.error('Error fetching batch token metadata:', error);
      return tokenAddresses.map(() => null);
    }
  }
  
  /**
   * Fetch token metadata from on-chain
   * @param {Connection} connection - Solana connection
   * @param {string} tokenAddress - Token mint address
   * @returns {Promise<Object>} Token metadata
   */
  async fetchTokenMetadata(connection, tokenAddress) {
    try {
      // First try to get token account info
      const mintInfo = await connection.getAccountInfo(new PublicKey(tokenAddress));
      if (!mintInfo) {
        return this.createDefaultTokenInfo(tokenAddress);
      }
      
      // Find the token metadata PDA
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          this.TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          new PublicKey(tokenAddress).toBuffer()
        ],
        this.TOKEN_METADATA_PROGRAM_ID
      );
      
      // Get metadata account info
      const metadataInfo = await connection.getAccountInfo(metadataPDA);
      if (!metadataInfo) {
        // If metadata doesn't exist, try to get on-chain info
        return await this.fetchTokenOnChainInfo(connection, tokenAddress);
      }
      
      // Parse metadata (simplified for demonstration)
      // In a real implementation, use proper metadata deserialization
      const metadata = this.parseTokenMetadata(metadataInfo.data);
      
      return {
        address: tokenAddress,
        symbol: metadata.symbol || this.createSymbolFromAddress(tokenAddress),
        name: metadata.name || `Token ${this.createSymbolFromAddress(tokenAddress)}`,
        decimals: metadata.decimals || 0,
        logoURI: metadata.uri || null
      };
    } catch (error) {
      console.error(`Error fetching token metadata for ${tokenAddress}:`, error);
      return this.createDefaultTokenInfo(tokenAddress);
    }
  }
  
  /**
   * Fallback to fetch basic token info from on-chain
   * @param {Connection} connection 
   * @param {string} tokenAddress 
   * @returns {Promise<Object>} Basic token info
   */
  async fetchTokenOnChainInfo(connection, tokenAddress) {
    try {
      // Get mint info
      const mintInfo = await connection.getTokenSupply(new PublicKey(tokenAddress));
      
      return {
        address: tokenAddress,
        symbol: this.createSymbolFromAddress(tokenAddress),
        name: `Token ${this.createSymbolFromAddress(tokenAddress)}`,
        decimals: mintInfo?.value?.decimals || 0,
        logoURI: null
      };
    } catch (error) {
      console.error(`Error fetching on-chain info for ${tokenAddress}:`, error);
      return this.createDefaultTokenInfo(tokenAddress);
    }
  }
  
  /**
   * Parse token metadata from buffer (simplified)
   * In a production app, use proper metadata deserialization
   * @param {Buffer} data 
   * @returns {Object} Parsed metadata
   */
  parseTokenMetadata(data) {
    // This is a placeholder - in a real app, properly deserialize the metadata
    // For example, using @metaplex-foundation/mpl-token-metadata
    try {
      // Basic parsing for demonstration
      // Skip first 1 + 32 + 32 bytes (version, update auth, mint)
      let offset = 1 + 32 + 32;
      
      // Read name length and name
      const nameLen = new DataView(data.buffer).getUint32(offset, true);
      offset += 4;
      const name = data.slice(offset, offset + nameLen).toString('utf8').replace(/\0/g, '');
      offset += nameLen;
      
      // Read symbol length and symbol
      const symbolLen = new DataView(data.buffer).getUint32(offset, true);
      offset += 4;
      const symbol = data.slice(offset, offset + symbolLen).toString('utf8').replace(/\0/g, '');
      offset += symbolLen;
      
      // Read uri length and uri
      const uriLen = new DataView(data.buffer).getUint32(offset, true);
      offset += 4;
      const uri = data.slice(offset, offset + uriLen).toString('utf8').replace(/\0/g, '');
      
      return { name, symbol, uri };
    } catch (error) {
      console.error('Error parsing token metadata:', error);
      return { name: '', symbol: '', uri: '' };
    }
  }
  
  /**
   * Get a token from cache if it exists and is not expired
   * @param {string} tokenAddress 
   * @returns {Object|null} Token metadata or null if not in cache
   */
  getCachedToken(tokenAddress) {
    const cacheItem = this.tokenCache.get(tokenAddress);
    if (!cacheItem) return null;
    
    // Check if cache is expired
    if (Date.now() - cacheItem.timestamp > this.CACHE_EXPIRATION) {
      this.tokenCache.delete(tokenAddress);
      return null;
    }
    
    return cacheItem.data;
  }
  
  /**
   * Cache a token
   * @param {string} tokenAddress 
   * @param {Object} tokenData 
   */
  cacheToken(tokenAddress, tokenData) {
    this.tokenCache.set(tokenAddress, {
      data: tokenData,
      timestamp: Date.now()
    });
  }
  
  /**
   * Create a default token info object
   * @param {string} tokenAddress 
   * @returns {Object} Default token info
   */
  createDefaultTokenInfo(tokenAddress) {
    const symbol = this.createSymbolFromAddress(tokenAddress);
    return {
      address: tokenAddress,
      symbol,
      name: `Unknown Token (${symbol})`,
      decimals: 0,
      logoURI: null
    };
  }
  
  /**
   * Extract tokens from a transaction
   * @param {Object} transaction - Transaction object
   * @param {Array} accountKeys - Array of account keys in the transaction
   * @returns {Promise<Array>} Array of token metadata objects
   */
  async extractTokensFromTransaction(transaction, accountKeys) {
    if (!transaction || !accountKeys || !Array.isArray(accountKeys)) {
      return [];
    }
    
    try {
      const tokenAddresses = new Set();
      
      // Check accounts against known token mints
      accountKeys.forEach(account => {
        const accountStr = account?.toString();
        if (accountStr && this.knownTokens[accountStr]) {
          tokenAddresses.add(accountStr);
        }
      });
      
      // Check for token program invocations
      const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      const programIds = new Set();
      
      try {
        transaction.transaction.message.instructions.forEach(instruction => {
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
      
      // If token program is invoked, check accounts for potential tokens
      if (programIds.has(TOKEN_PROGRAM_ID)) {
        for (const account of accountKeys) {
          const accountStr = account?.toString();
          if (accountStr && accountStr !== TOKEN_PROGRAM_ID) {
            // This is a potential token account, queue it for fetching
            tokenAddresses.add(accountStr);
          }
        }
      }
      
      // Fetch metadata for all potential tokens
      const tokenPromises = Array.from(tokenAddresses).map(address => 
        this.getTokenMetadata(address)
      );
      
      // Wait for all token metadata to be fetched
      const tokens = await Promise.all(tokenPromises);
      
      // Filter out null values and return
      return tokens.filter(Boolean);
    } catch (error) {
      console.error('Error extracting tokens from transaction:', error);
      return [];
    }
  }
  
  /**
   * Create a short symbol from a token address
   * @param {string} address 
   * @returns {string} Short symbol
   */
  createSymbolFromAddress(address) {
    try {
      // Use first 3 and last 3 characters of the address
      return `${address.substring(0, 3)}...${address.substring(address.length - 3)}`.toUpperCase();
    } catch (error) {
      return 'UNKNOWN';
    }
  }
  
  /**
   * Clear expired cache items
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.tokenCache.entries()) {
      if (now - value.timestamp > this.CACHE_EXPIRATION) {
        this.tokenCache.delete(key);
      }
    }
  }
}

// Export singleton instance
const tokenRegistryService = new TokenRegistryService();
export default tokenRegistryService; 