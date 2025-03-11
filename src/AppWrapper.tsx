import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { transactionService } from './services/transactionService';
import { walletService } from './services/walletService';
import { priceService } from './services/priceService';
import { Transaction, Wallet } from './types';
import { ApiError } from './utils/errors';
import LandingPage from './components/LandingPage';
import UserInformationPage from './components/UserInformationPage';
import TransactionDashboard from './components/TransactionDashboard';
import WalletsPage from './components/WalletsPage';
import AppLayout from './components/AppLayout';

export default function AppWrapper() {
    const { user, signIn } = useAuth();
    const [currentPage, setCurrentPage] = useState<string>('wallets');
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedWallet, setSelectedWallet] = useState<string>('all');
    const [loadingProgress, setLoadingProgress] = useState({
        status: '',
        progress: 0
    });
    const [walletProcessingStatus, setWalletProcessingStatus] = useState({
        currentWallet: null,
        queuedWallets: [],
        completedWallets: [],
        interruptedWallets: []
    });
    const [formData, setFormData] = useState({
        walletAddresses: [] as string[],
        walletNames: [] as string[]
    });

    // Fetch transactions for all wallets
    const fetchTransactions = useCallback(async () => {
        if (!user?.id || wallets.length === 0) {
            console.log('No user or wallets to fetch transactions for');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const allTransactions: Transaction[] = [];
            setLoadingProgress({ status: 'Loading transactions...', progress: 0 });
            console.log('Starting to fetch transactions for', wallets.length, 'wallets');

            const walletsToFetch = selectedWallet === 'all' ? wallets : wallets.filter(w => w.wallet_address === selectedWallet);
            
            for (let i = 0; i < walletsToFetch.length; i++) {
                const wallet = walletsToFetch[i];
                try {
                    console.log(`Fetching transactions for wallet ${wallet.wallet_name || wallet.wallet_address} (${wallet.id})`);
                    const walletTransactions = await transactionService.getWalletTransactions(wallet.id);
                    console.log(`Found ${walletTransactions.length} transactions for wallet ${wallet.wallet_name || wallet.wallet_address}`);
                    allTransactions.push(...walletTransactions);
                } catch (err) {
                    console.error(`Failed to fetch transactions for wallet ${wallet.wallet_address}:`, err);
                }
                setLoadingProgress({
                    status: `Loading transactions for ${wallet.wallet_name || wallet.wallet_address}...`,
                    progress: ((i + 1) / walletsToFetch.length) * 100
                });
            }

            console.log('Total transactions found:', allTransactions.length);
            // Sort transactions by block_time in descending order
            allTransactions.sort((a, b) => {
                const dateA = new Date(a.block_time);
                const dateB = new Date(b.block_time);
                return dateB.getTime() - dateA.getTime();
            });

            setTransactions(allTransactions);
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
            setError('Failed to load transactions. Please try again.');
        } finally {
            setLoading(false);
            setLoadingProgress({ status: '', progress: 0 });
        }
    }, [user?.id, wallets, selectedWallet]);

    // Fetch user's wallets
    const fetchWallets = useCallback(async () => {
        if (!user?.id) return;

        setLoading(true);
        setError(null);
        try {
            console.log('Fetching wallets for user:', user.id);
            const userWallets = await walletService.getUserWallets(user.id);
            console.log('Fetched wallets:', userWallets);
            setWallets(userWallets);
            
            // Update formData with wallet information
            setFormData({
                walletAddresses: userWallets.map(w => w.wallet_address),
                walletNames: userWallets.map(w => w.wallet_name)
            });

            // After fetching wallets, fetch transactions
            await fetchTransactions();
        } catch (error) {
            console.error('Failed to fetch wallets:', error);
            setError('Failed to fetch wallets. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id, fetchTransactions]);

    // Add wallet
    const addWallet = async (address: string, name: string = '') => {
        if (!user?.id) return;

        try {
            const wallet = await walletService.addWallet({
                user_id: user.id,
                wallet_address: address,
                wallet_name: name || `Wallet ${wallets.length + 1}`,
                network: 'solana'
            });
            setWallets(prev => [...prev, wallet]);
            
            // Fetch transactions for the new wallet
            await fetchTransactions();
        } catch (error) {
            console.error('Failed to add wallet:', error);
            throw error;
        }
    };

    // Delete wallet
    const deleteWallet = async (walletId: string) => {
        try {
            await walletService.deleteWallet(walletId);
            setWallets(prev => prev.filter(w => w.id !== walletId));
            // Refresh transactions after deleting wallet
            await fetchTransactions();
        } catch (error) {
            console.error('Failed to delete wallet:', error);
            throw error;
        }
    };

    // Handle navigation
    const handleNavigate = (page: string) => {
        setCurrentPage(page);
        // Refresh data when navigating to dashboard
        if (page === 'dashboard') {
            fetchTransactions();
        }
    };

    // Load wallets and transactions on mount
    useEffect(() => {
        if (user) {
            fetchWallets();
        }
    }, [user, fetchWallets]);

    if (!user) {
        return <LandingPage onGetStarted={() => signIn()} />;
    }

    return (
        <AppLayout
            toggleUserInfoPage={() => handleNavigate('account')}
            currentPage={currentPage}
            userProfile={formData}
            onNavigate={handleNavigate}
        >
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            {currentPage === 'wallets' && (
                <WalletsPage
                    formData={formData}
                    setFormData={setFormData}
                    handleWalletNameChange={(index: number, value: string) => {
                        const updatedNames = [...formData.walletNames];
                        updatedNames[index] = value;
                        setFormData(prev => ({
                            ...prev,
                            walletNames: updatedNames
                        }));
                    }}
                    loading={loading}
                    loadingProgress={loadingProgress}
                    walletProcessingStatus={walletProcessingStatus}
                    queueWalletForProcessing={async (address: string) => {
                        // Implementation here
                    }}
                    saveWalletAndPull={addWallet}
                    removeWallet={async (index: number) => {
                        const wallet = wallets[index];
                        if (wallet) {
                            await deleteWallet(wallet.id);
                        }
                    }}
                    walletSaving={loading}
                    activeWalletIndex={null}
                    validateWalletAddress={(address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)}
                />
            )}

            {currentPage === 'dashboard' && (
                <TransactionDashboard
                    transactions={transactions}
                    wallets={wallets}
                    onRefresh={fetchTransactions}
                    selectedWallet={selectedWallet}
                    walletMap={Object.fromEntries(wallets.map(w => [w.wallet_address, w.wallet_name]))}
                    walletAddresses={wallets.map(w => w.wallet_address)}
                    walletNames={wallets.map(w => w.wallet_name)}
                    onWalletSelect={(wallet: string) => {
                        setSelectedWallet(wallet);
                        fetchTransactions();
                    }}
                    loading={loading}
                    batchProgress={{
                        totalTransactions: transactions.length,
                        processedTransactions: transactions.length,
                        currentBatch: 1,
                        isComplete: !loading
                    }}
                    walletProcessingStatus={walletProcessingStatus}
                    queueWalletForProcessing={async () => fetchTransactions()}
                    validateWalletAddress={(address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)}
                />
            )}
        </AppLayout>
    );
} 