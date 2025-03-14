import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { transactionService } from './services/transactionService';
import { walletService } from './services/walletService';
import { priceService } from './services/priceService';
import { Transaction, Wallet } from './types';
import { ApiError } from './utils/errors';
import LandingPage from './components/LandingPage';
import UserInformationPage from './components/UserInformationPage';
import TransactionDashboard from './components/TransactionDashboard.js';
import WalletsPage from './components/WalletsPage';
import AppLayout from './components/AppLayout.js';
import OnboardingFlow from './components/onboarding/OnboardingFlow';

export default function AppWrapper() {
    const { user, userProfile, signIn } = useAuth();
    const [currentPage, setCurrentPage] = useState<string>('wallets');
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedWallet, setSelectedWallet] = useState<string>('all');
    const [currentTransactionPage, setCurrentTransactionPage] = useState<number>(0);
    const [hasMore, setHasMore] = useState<boolean>(true);
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

    // Initialize data loading state
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);

    const fetchTransactions = useCallback(async (forceRefresh = false, page = 0) => {
        if (!user) return;
        
        try {
            if (!forceRefresh && transactions.length > 0 && page === 0) {
                return; // Use cached transactions unless force refresh or loading more
            }

            setLoading(true);
            setError(null);
            
            let result;
            if (selectedWallet === 'all') {
                result = await transactionService.getUserTransactions(user.id, page);
            } else {
                result = await transactionService.getWalletTransactions(selectedWallet, page);
            }
            
            const { transactions: newTransactions, hasMore: moreAvailable } = result;
            
            setTransactions(prev => page === 0 ? newTransactions : [...prev, ...newTransactions]);
            setHasMore(moreAvailable);
            setCurrentTransactionPage(page);
        } catch (error) {
            console.error('Error fetching transactions:', error);
            setError(error instanceof ApiError ? error.message : 'Failed to fetch transactions');
        } finally {
            setLoading(false);
        }
    }, [user, selectedWallet]);

    // Load more transactions when scrolling
    const loadMore = useCallback(async () => {
        if (!loading && hasMore) {
            await fetchTransactions(false, currentTransactionPage + 1);
        }
    }, [loading, hasMore, currentTransactionPage, fetchTransactions]);

    // Reset pagination when changing wallets
    useEffect(() => {
        setTransactions([]);
        setCurrentTransactionPage(0);
        setHasMore(true);
        fetchTransactions(true, 0);
    }, [selectedWallet]);

    // Fetch user's wallets
    const fetchWallets = useCallback(async (): Promise<Wallet[]> => {
        if (!user?.id) return [];  // Explicit return type and empty array

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

            return userWallets;
        } catch (error) {
            console.error('Failed to fetch wallets:', error);
            setError('Failed to fetch wallets. Please try again.');
            return [];
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    // Initialize app data
    const initializeAppData = useCallback(async () => {
        if (!user || isInitialDataLoaded) return;

        try {
            setLoading(true);
            // First fetch wallets
            const userWallets = await fetchWallets();
            
            // Then fetch initial transactions if we have wallets
            if (userWallets.length > 0) {
                await fetchTransactions(true, 0);
            }
            
            setIsInitialDataLoaded(true);
        } catch (error) {
            console.error('Error initializing app data:', error);
            setError('Failed to initialize app data. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    }, [user, isInitialDataLoaded, fetchWallets, fetchTransactions]);

    // Load initial data when user is set
    useEffect(() => {
        initializeAppData();
    }, [initializeAppData]);

    // Handle navigation with data refresh
    const handleNavigate = (page: string) => {
        setCurrentPage(page);
        // Refresh data when navigating to dashboard
        if (page === 'dashboard') {
            fetchTransactions(true, 0); // Force refresh on manual navigation
        }
    };

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

    // Function to check if a wallet has any transactions in our database
    const hasWalletTransactions = (walletAddress: string) => {
        // Return true if we have any transactions for this wallet in our state
        return transactions.some(tx => tx.wallet_address === walletAddress);
    };

    // Render onboarding flow for new users
    if (user && userProfile && userProfile.is_new_user === true) {
        return <OnboardingFlow />;
    }
    
    // Show landing page for non-authenticated users
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
                    hasWalletTransactions={hasWalletTransactions}
                />
            )}

            {currentPage === 'dashboard' && (
                <TransactionDashboard
                    transactions={transactions}
                    selectedWallet={selectedWallet}
                    walletMap={Object.fromEntries(wallets.map(w => [w.wallet_address, w.wallet_name]))}
                    walletAddresses={wallets.map(w => w.wallet_address)}
                    walletNames={wallets.map(w => w.wallet_name)}
                    onWalletSelect={setSelectedWallet}
                    loading={loading}
                    onLoadTransactions={() => fetchTransactions(true, 0)}
                    batchProgress={{
                        totalTransactions: transactions.length,
                        processedTransactions: transactions.length,
                        currentBatch: currentTransactionPage + 1,
                        isComplete: !loading
                    }}
                    walletProcessingStatus={walletProcessingStatus}
                    queueWalletForProcessing={async () => fetchTransactions(true, 0)}
                    validateWalletAddress={(address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)}
                />
            )}
        </AppLayout>
    );
} 