import { ReactNode } from 'react';

export interface Transaction {
    id: string;
    wallet_id: string;
    signature: string;
    block_time: Date;
    success: boolean;
    transaction_type: string;
    amount: number;
    usd_value: number;
    fee: number;
    raw_data: string;
    created_at: Date;
    updated_at: Date;
}

export interface Wallet {
    id: string;
    user_id: string;
    wallet_address: string;
    wallet_name: string;
    network: string;
    created_at?: string;
    updated_at?: string;
    last_synced_at?: Date;
}

export interface User {
    id: string;
    email: string;
    created_at: Date;
    updated_at: Date;
}

export enum TransactionType {
    SWAP = 'SWAP',
    TRANSFER = 'TRANSFER',
    NFT_SALE = 'NFT_SALE',
    NFT_PURCHASE = 'NFT_PURCHASE',
    STAKE = 'STAKE',
    UNSTAKE = 'UNSTAKE',
    REWARD = 'REWARD',
    FEE = 'FEE',
    UNKNOWN = 'UNKNOWN'
}

export interface TransactionBatch {
    transactions: Transaction[];
    walletAddress: string;
    batchNumber: number;
}

export interface PriceData {
    price: number;
    timestamp: number;
    symbol: string;
}

export interface ProcessingError extends Error {
    code?: string;
    isRetryable?: boolean;
    context?: any;
}

export interface CacheItem<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

export interface AppLayoutProps {
    children: ReactNode;
    toggleUserInfoPage: () => void;
    currentPage?: string;
    userProfile: {
        walletAddresses: string[];
        walletNames: string[];
    };
    onNavigate: (page: string) => void;
}

export interface LoadingProgress {
    status: string;
    progress: number;
}

export interface WalletProcessingStatus {
    currentWallet: string | null;
    queuedWallets: string[];
    completedWallets: string[];
    interruptedWallets: string[];
}

export interface BatchProgress {
    totalTransactions: number;
    processedTransactions: number;
    currentBatch: number;
    isComplete: boolean;
} 