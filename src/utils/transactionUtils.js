// src/utils/transactionUtils.js

export const TRANSACTION_TYPES = {
    TRANSFER: 'transfer',
    SWAP: 'swap',
    GAS: 'gas',
    INTERNAL_TRANSFER: 'internal_transfer',
    TOKEN_TRANSACTION: 'token_transaction'
};

// Known DEX program IDs for transaction identification
export const DEX_PROGRAMS = {
    '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca',
    'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter',
    'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX': 'Serum',
    'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr': 'Raydium',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM'
};

// Simplified token metadata detection from Jupiter-like transactions
const extractTokenInfoFromAccounts = (accounts = [], programId) => {
    // This is a simplified approach - in a production app, we'd want to use
    // a token registry or on-chain token metadata program to lookup details
    
    // Look for token accounts (typically SPL token accounts show up as transaction participants)
    const tokenInfo = {
        symbol: '',
        name: '',
        amount: 0
    };
    
    // For Jupiter or Raydium transactions, we can make some assumptions about token transactions
    if (accounts.length > 5 && (
        programId === 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB' || // Jupiter
        programId === 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr' || // Raydium
        programId === '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'    // Raydium AMM
    )) {
        // From the example, for simplicity, we'll recognize common token swaps
        // In a real app, we would identify the token mint addresses and look them up
        
        // Example token name extraction - this is just for demonstration
        // In a real app, we'd decode the transaction instructions
        const knownTokens = {
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
            'So11111111111111111111111111111111111111112': 'SOL',
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
            'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL'
        };
        
        // Check if we have tokens in the accounts list
        for (const account of accounts) {
            if (knownTokens[account]) {
                tokenInfo.symbol = knownTokens[account];
                tokenInfo.name = knownTokens[account];
                break;
            }
        }
        
        // If we didn't find a known token but it's from a DEX, it might be an unknown token
        if (!tokenInfo.symbol && DEX_PROGRAMS[programId]) {
            tokenInfo.symbol = "Unknown Token";
            tokenInfo.name = "Unknown Token";
        }
    }
    
    return tokenInfo;
};

export const groupTransactions = (transactions) => {
    let gasFees = 0;
    let linkedTransactions = new Map(); // Map to store linked transactions
    let processedTxs = new Set(); // Keep track of processed transactions

    // First pass: identify and link related transactions
    transactions.forEach(tx => {
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
    });

    // Second pass: process remaining transactions
    const groupedTransactions = transactions
        .filter(tx => !processedTxs.has(tx.signature))
        .map(tx => {
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
                const tokenInfo = extractTokenInfoFromAccounts(tx.accounts, tx.programId);
                
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

export const categorizeTransaction = (tx) => {
    if (tx.type === TRANSACTION_TYPES.GAS) {
        return 'Gas Fee';
    }
    if (tx.type === TRANSACTION_TYPES.INTERNAL_TRANSFER) {
        return 'Internal Transfer';
    }
    if (tx.type === TRANSACTION_TYPES.SWAP) {
        return 'Token Swap';
    }
    if (tx.type === TRANSACTION_TYPES.TOKEN_TRANSACTION) {
        const tokenSymbol = tx.tokenInfo?.symbol || 'Token';
        return `${tx.tokenAction || 'Swap'} ${tokenSymbol}`;
    }
    return tx.solChange > 0 ? 'Receive' : 'Send';
};

export const calculateGasFees = (transactions) => {
    return transactions
        .filter(tx => tx.type === TRANSACTION_TYPES.GAS)
        .reduce((sum, tx) => sum + Math.abs(tx.solChange), 0);
};