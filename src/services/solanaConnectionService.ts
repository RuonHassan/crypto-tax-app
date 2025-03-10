import { Connection, PublicKey } from '@solana/web3.js';
import config from '../config';

let connection: Connection | null = null;

export const getConnection = (forceNew = false): Connection => {
    if (!connection || forceNew) {
        connection = new Connection(config.helius.rpcUrl);
    }
    return connection;
};

export const resetConnection = (): void => {
    connection = null;
};

export const validateWalletAddress = (address: string): boolean => {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
};

export const executeWithRetry = async <T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
): Promise<T> => {
    let lastError: Error;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }
    throw lastError!;
};

export const checkHeliusHealth = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${config.helius.baseUrl}/health`, {
            headers: {
                'x-api-key': config.helius.apiKey
            }
        });
        return response.ok;
    } catch {
        return false;
    }
}; 