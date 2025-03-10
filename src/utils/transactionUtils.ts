import { Transaction, TransactionType } from '../types';
import { PublicKey } from '@solana/web3.js';

export const KNOWN_PROGRAM_IDS = {
    SERUM_V3: 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',
    RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    ORCA_V2: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
    MARINADE: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
    LIDO: 'LidoStake268hsy8Kf58aBGhNypJp1RvYuEJUdrQpZok',
    NFT_MARKETPLACE: 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K'
};

export const isKnownProgram = (programId: string): boolean => {
    return Object.values(KNOWN_PROGRAM_IDS).includes(programId);
};

export const categorizeTransaction = (tx: any): TransactionType => {
    const accountKeys = tx.transaction?.message?.accountKeys || [];
    const programId = accountKeys[accountKeys.length - 1]?.pubkey;

    if (!programId) return TransactionType.UNKNOWN;

    // Check for NFT transactions
    if (programId === KNOWN_PROGRAM_IDS.NFT_MARKETPLACE) {
        return tx.type === 'buy' ? TransactionType.NFT_PURCHASE : TransactionType.NFT_SALE;
    }

    // Check for DEX transactions
    if ([KNOWN_PROGRAM_IDS.SERUM_V3, KNOWN_PROGRAM_IDS.RAYDIUM_V4, KNOWN_PROGRAM_IDS.ORCA_V2].includes(programId)) {
        return TransactionType.SWAP;
    }

    // Check for staking transactions
    if ([KNOWN_PROGRAM_IDS.MARINADE, KNOWN_PROGRAM_IDS.LIDO].includes(programId)) {
        return tx.type === 'stake' ? TransactionType.STAKE : TransactionType.UNSTAKE;
    }

    // Check for rewards
    if (tx.type === 'reward') {
        return TransactionType.REWARD;
    }

    // Check for transfers
    if (tx.type === 'transfer') {
        return TransactionType.TRANSFER;
    }

    return TransactionType.UNKNOWN;
};

export const calculateTransactionFee = (tx: any): number => {
    if (!tx.meta?.fee) return 0;
    return tx.meta.fee / 1e9; // Convert lamports to SOL
};

export const calculateTransactionAmount = (tx: any): number => {
    if (!tx.meta?.postBalances || !tx.meta?.preBalances) return 0;

    const preBalance = tx.meta.preBalances[0];
    const postBalance = tx.meta.postBalances[0];
    return Math.abs(postBalance - preBalance) / 1e9; // Convert lamports to SOL
};

export const isInternalTransfer = (tx: any, userWallets: string[]): boolean => {
    if (!tx.transaction?.message?.accountKeys) return false;

    const accounts = tx.transaction.message.accountKeys.map((key: any) => key.pubkey);
    const [sender, receiver] = accounts;

    return userWallets.includes(sender) && userWallets.includes(receiver);
};

export const validateSignature = (signature: string): boolean => {
    try {
        if (signature.length !== 88) return false;
        // Try to decode base58 string
        const decoded = Buffer.from(signature, 'base64');
        return decoded.length === 64;
    } catch {
        return false;
    }
};

export const validateAddress = (address: string): boolean => {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
};

export const groupTransactionsByDate = (transactions: Transaction[]): Record<string, Transaction[]> => {
    return transactions.reduce((groups: Record<string, Transaction[]>, tx) => {
        const date = new Date(tx.block_time).toISOString().split('T')[0];
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(tx);
        return groups;
    }, {});
};

export const calculateDailyVolume = (transactions: Transaction[]): Record<string, number> => {
    const grouped = groupTransactionsByDate(transactions);
    const dailyVolume: Record<string, number> = {};

    for (const [date, txs] of Object.entries(grouped)) {
        dailyVolume[date] = txs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    }

    return dailyVolume;
};

export const calculateTotalFees = (transactions: Transaction[]): number => {
    return transactions.reduce((sum, tx) => sum + (tx.fee || 0), 0);
};

export const getUniqueTokens = (transactions: Transaction[]): Set<string> => {
    const tokens = new Set<string>();
    transactions.forEach(tx => {
        if (tx.raw_data) {
            try {
                const data = JSON.parse(tx.raw_data);
                if (data.tokenTransfers) {
                    data.tokenTransfers.forEach((transfer: any) => {
                        if (transfer.mint) tokens.add(transfer.mint);
                    });
                }
            } catch {
                // Skip if raw_data is not valid JSON
            }
        }
    });
    return tokens;
}; 