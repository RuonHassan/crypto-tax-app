// src/utils/transactionUtils.js
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import tokenRegistryService from '../services/tokenRegistryService';
import { JUPITER_PERPS_PROGRAM_IDS, PERPS_TRANSACTION_TYPES, isJupiterPerpsTransaction, parseJupiterPerpsTransaction } from './jupiterPerpsUtils';

export const TRANSACTION_TYPES = {
    TRANSFER: 'transfer',
    SWAP: 'swap',
    GAS: 'gas',
    INTERNAL_TRANSFER: 'internal_transfer',
    TOKEN_TRANSACTION: 'token_transaction',
    BUY: 'buy',
    SELL: 'sell',
    PERPS_ORDER: 'perps-order',
    PERPS_CLOSE: 'perps-close',
    PERPS_INCREASE: 'perps-increase',
    PERPS_DECREASE: 'perps-decrease',
    PERPS_INSTANT_INCREASE: 'perps-instant-increase',
    PERPS_INSTANT_DECREASE: 'perps-instant-decrease',
    PERPS_LIQUIDATION: 'perps-liquidation',
    PERPS_MARGIN: 'perps-margin',
    FEE: 'fee',
    UNKNOWN: 'unknown'
};

// Known DEX program IDs for transaction identification
export const DEX_PROGRAMS = {
    '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca',
    'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter',
    'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX': 'Serum',
    'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr': 'Raydium',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
    'JPPooLEqRb2LuVYJx6mjSfJA7YWcqQz2iCfBdz7k9Cn': 'Jupiter Perps',
    'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K': 'Meteora'
};

// Enhanced token metadata extraction leveraging the tokenRegistryService
const extractTokenInfoFromAccounts = async (accounts = [], programId) => {
    // Use the token registry service for more reliable token detection
    if (!accounts || !accounts.length) return null;
    
    try {
        // Extract potential token addresses first
        let potentialTokens = [];
        
        // If it's a DEX transaction, all accounts are potential token addresses
        if (programId && DEX_PROGRAMS[programId]) {
            potentialTokens = [...accounts];
        } else {
            // Otherwise, just check a sample of accounts (to avoid unnecessary lookups)
            potentialTokens = accounts.slice(0, 5);
        }
        
        // Use token registry service to identify tokens
        const tokenPromises = potentialTokens.map(account => {
            const accountStr = typeof account === 'string' ? account : account?.toString();
            if (!accountStr) return null;
            return tokenRegistryService.getTokenMetadata(accountStr);
        });
        
        // Get results and filter out null values
        const tokens = (await Promise.all(tokenPromises)).filter(Boolean);
        
        // Return the first valid token found, or null if none
        return tokens.length > 0 ? tokens[0] : null;
    } catch (error) {
        console.error('Error extracting token info:', error);
        return null;
    }
};

export const groupTransactions = async (transactions) => {
    let gasFees = 0;
    let linkedTransactions = new Map(); // Map to store linked transactions
    let processedTxs = new Set(); // Keep track of processed transactions

    // First pass: identify and link related transactions
    for (const tx of transactions) {
        if (tx.isInternalTransfer && !processedTxs.has(tx.signature)) {
            // Find the corresponding transaction in the destination wallet
            const relatedTx = transactions.find(t => 
                t.sourceWallet === tx.destinationWallet && 
                t.timestamp >= tx.timestamp && 
                t.timestamp <= tx.timestamp + 60 && // Within 60 seconds
                Math.abs(t.solChange) === Math.abs(tx.solChange)
            );

            if (relatedTx) {
                linkedTransactions.set(tx.signature, {
                    type: TRANSACTION_TYPES.INTERNAL_TRANSFER,
                    from: tx.sourceWallet,
                    to: tx.destinationWallet,
                    amount: Math.abs(tx.solChange),
                    timestamp: tx.timestamp,
                    signatures: [tx.signature, relatedTx.signature]
                });
                processedTxs.add(tx.signature);
                processedTxs.add(relatedTx.signature);
            }
        }
    }

    // Second pass: process remaining transactions
    const groupedTransactionsPromises = transactions
        .filter(tx => !processedTxs.has(tx.signature))
        .map(async tx => {
            if (Math.abs(tx.solChange) < 0.001) {
                gasFees += Math.abs(tx.solChange);
                return {
                    ...tx,
                    type: TRANSACTION_TYPES.GAS
                };
            }

            // Check if this is part of a swap or token transaction
            const isDexTransaction = tx.programId && DEX_PROGRAMS[tx.programId];
            
            // For token transactions, extract token info
            if (isDexTransaction) {
                const tokenInfo = await extractTokenInfoFromAccounts(tx.accounts, tx.programId);
                
                // If negative SOL change and DEX transaction, likely buying a token
                if (tx.solChange < 0) {
                    return {
                        ...tx,
                        type: TRANSACTION_TYPES.TOKEN_TRANSACTION,
                        tokenAction: "Buy",
                        tokenInfo,
                        dex: DEX_PROGRAMS[tx.programId]
                    };
                }
                // If positive SOL change and DEX transaction, likely selling a token
                else if (tx.solChange > 0) {
                    return {
                        ...tx,
                        type: TRANSACTION_TYPES.TOKEN_TRANSACTION,
                        tokenAction: "Sell",
                        tokenInfo,
                        dex: DEX_PROGRAMS[tx.programId]
                    };
                }
                
                // More generic swap if we can't determine buy/sell
                return {
                    ...tx,
                    type: TRANSACTION_TYPES.SWAP,
                    tokenInfo,
                    dex: DEX_PROGRAMS[tx.programId]
                };
            }

            return {
                ...tx,
                type: TRANSACTION_TYPES.TRANSFER
            };
        });

    // Wait for all promises to resolve
    const groupedTransactions = await Promise.all(groupedTransactionsPromises);

    // Combine regular and linked transactions
    const allTransactions = [
        ...groupedTransactions,
        ...Array.from(linkedTransactions.values())
    ].sort((a, b) => a.timestamp - b.timestamp);

    return {
        transactions: allTransactions,
        gasFees
    };
};

export const calculateVolume = (transactions) => {
    return transactions.reduce((sum, tx) => {
        if (tx.type === TRANSACTION_TYPES.GAS || tx.type === TRANSACTION_TYPES.INTERNAL_TRANSFER) {
            return sum;
        }
        return sum + Math.abs(tx.valueUSD || 0);
    }, 0);
};

export const categorizeTransaction = (tx, walletAddress) => {
    if (!tx) return TRANSACTION_TYPES.UNKNOWN;

    try {
        // Check for Jupiter Perps transactions first
        if (isJupiterPerpsTransaction(tx)) {
            const perpsDetails = parseJupiterPerpsTransaction(tx);
            if (perpsDetails) {
                // Map Jupiter Perps transaction types to our transaction types
                switch (perpsDetails.type) {
                    case PERPS_TRANSACTION_TYPES.OPEN_POSITION:
                        return {
                            type: TRANSACTION_TYPES.PERPS_ORDER,
                            details: perpsDetails.details
                        };
                    case PERPS_TRANSACTION_TYPES.CLOSE_POSITION:
                        return {
                            type: TRANSACTION_TYPES.PERPS_CLOSE,
                            details: perpsDetails.details
                        };
                    case PERPS_TRANSACTION_TYPES.INCREASE_POSITION:
                        return {
                            type: TRANSACTION_TYPES.PERPS_INCREASE,
                            details: perpsDetails.details
                        };
                    case PERPS_TRANSACTION_TYPES.DECREASE_POSITION:
                        return {
                            type: TRANSACTION_TYPES.PERPS_DECREASE,
                            details: perpsDetails.details
                        };
                    case PERPS_TRANSACTION_TYPES.INSTANT_INCREASE:
                        return {
                            type: TRANSACTION_TYPES.PERPS_INSTANT_INCREASE,
                            details: perpsDetails.details
                        };
                    case PERPS_TRANSACTION_TYPES.INSTANT_DECREASE:
                        return {
                            type: TRANSACTION_TYPES.PERPS_INSTANT_DECREASE,
                            details: perpsDetails.details
                        };
                    case PERPS_TRANSACTION_TYPES.LIQUIDATION:
                        return {
                            type: TRANSACTION_TYPES.PERPS_LIQUIDATION,
                            details: perpsDetails.details
                        };
                    case PERPS_TRANSACTION_TYPES.ADD_MARGIN:
                    case PERPS_TRANSACTION_TYPES.REMOVE_MARGIN:
                        return {
                            type: TRANSACTION_TYPES.PERPS_MARGIN,
                            details: perpsDetails.details
                        };
                    default:
                        // Only categorize as fee if we're sure it's not another type
                        if (perpsDetails.type === PERPS_TRANSACTION_TYPES.FEE) {
                            return {
                                type: TRANSACTION_TYPES.FEE,
                                details: perpsDetails.details
                            };
                        }
                }
            }
        }

        // Check for transfers between wallets
        const accountKeys = tx.transaction.message.accountKeys.map(key => 
            typeof key === 'string' ? key : key.pubkey || key.toString()
        );
        const preBalances = tx.meta?.preBalances || [];
        const postBalances = tx.meta?.postBalances || [];
        
        // Find the wallet's index in the transaction
        const walletIndex = accountKeys.findIndex(key => key === walletAddress);
        
        if (walletIndex !== -1) {
            const walletBalanceChange = (postBalances[walletIndex] || 0) - (preBalances[walletIndex] || 0);
            
            // Look for significant balance changes (more than 5000 lamports to filter out gas fees)
            if (Math.abs(walletBalanceChange) > 5000) {
                // For outgoing transfers
                if (walletBalanceChange < 0) {
                    // Find the receiving account
                    const destinationIndex = accountKeys.findIndex((key, index) => {
                        if (index !== walletIndex) {
                            const balanceChange = (postBalances[index] || 0) - (preBalances[index] || 0);
                            return balanceChange > 5000; // Significant positive change
                        }
                        return false;
                    });

                    if (destinationIndex !== -1) {
                        return {
                            type: TRANSACTION_TYPES.TRANSFER,
                            details: {
                                source: walletAddress,
                                destination: accountKeys[destinationIndex],
                                amount: Math.abs(walletBalanceChange) / LAMPORTS_PER_SOL,
                                timestamp: tx.blockTime
                            }
                        };
                    }
                }
                // For incoming transfers
                else {
                    // Find the sending account
                    const sourceIndex = accountKeys.findIndex((key, index) => {
                        if (index !== walletIndex) {
                            const balanceChange = (postBalances[index] || 0) - (preBalances[index] || 0);
                            return balanceChange < -5000; // Significant negative change
                        }
                        return false;
                    });

                    if (sourceIndex !== -1) {
                        return {
                            type: TRANSACTION_TYPES.TRANSFER,
                            details: {
                                source: accountKeys[sourceIndex],
                                destination: walletAddress,
                                amount: walletBalanceChange / LAMPORTS_PER_SOL,
                                timestamp: tx.blockTime
                            }
                        };
                    }
                }
            }
        }

        // If not a perps transaction or transfer, check for regular fee transactions
        if (tx.meta?.fee && !tx.meta?.logMessages?.some(log => {
            const lowerLog = log.toLowerCase();
            return lowerLog.includes('perp') || 
                   lowerLog.includes('position') || 
                   lowerLog.includes('margin') || 
                   lowerLog.includes('liquidate');
        })) {
            return {
                type: TRANSACTION_TYPES.FEE,
                details: {
                    amount: tx.meta.fee,
                    timestamp: tx.blockTime,
                    signature: tx.transaction.signatures[0]
                }
            };
        }

        return TRANSACTION_TYPES.UNKNOWN;
    } catch (error) {
        console.error('Error categorizing transaction:', error);
        return TRANSACTION_TYPES.UNKNOWN;
    }
};

export const calculateGasFees = (transactions) => {
    return transactions
        .filter(tx => tx.type === TRANSACTION_TYPES.GAS)
        .reduce((sum, tx) => sum + Math.abs(tx.solChange), 0);
};

export const calculateUniqueTokens = (transactions) => {
    // Extract unique token symbols from transactions
    const uniqueTokens = new Set();
    
    // Always include SOL
    uniqueTokens.add('SOL');
    
    transactions.forEach(tx => {
        // Add token from token transactions
        if (tx.tokenInfo && tx.tokenInfo.symbol) {
            uniqueTokens.add(tx.tokenInfo.symbol);
        }
        
        // Add tokens from accounts that have token metadata
        if (tx.accounts && Array.isArray(tx.accounts)) {
            tx.accounts.forEach(account => {
                if (typeof account === 'object' && account.symbol) {
                    uniqueTokens.add(account.symbol);
                }
            });
        }
    });
    
    return uniqueTokens.size;
};