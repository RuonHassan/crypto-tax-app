import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { transactionService } from './services/transactionService';
import { walletService } from './services/walletService';
import priceService from './services/priceService';
import { Transaction, Wallet } from './types';
import { ApiError } from './utils/errors';
import LandingPage from './components/LandingPage';
import UserInformationPage from './components/UserInformationPage';
import TransactionDashboard from './components/TransactionDashboard';
import WalletsPage from './components/WalletsPage';
import AppLayout from './components/AppLayout';

export default function AppWrapper() {
    const { user } = useAuth();
    const [currentPage, setCurrentPage] = useState<string>('wallets');
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
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

    // Fetch user's wallets
    const fetchWallets = useCallback(async () => {
        if (!user?.id) return;

        try {
            setLoading(true);
            const userWallets = await walletService.getUserWallets(user.id);
            setWallets(userWallets);
            
            // Update formData with wallet information
            setFormData({
                walletAddresses: userWallets.map(w => w.wallet_address),
                walletNames: userWallets.map(w => w.wallet_name)
            });
        } catch (error) {
            console.error('Failed to fetch wallets:', error);
            setError('Failed to fetch wallets. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

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
        } catch (error) {
            console.error('Failed to delete wallet:', error);
            throw error;
        }
    };

    // Handle navigation
    const handleNavigate = (page: string) => {
        setCurrentPage(page);
    };

    // Load wallets on mount
    useEffect(() => {
        if (user) {
            fetchWallets();
        }
    }, [user, fetchWallets]);

    if (!user) {
        return <LandingPage onGetStarted={() => {}} />;
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
                    selectedWallet="all"
                    walletMap={Object.fromEntries(wallets.map(w => [w.wallet_address, w.wallet_name]))}
                    walletAddresses={wallets.map(w => w.wallet_address)}
                    walletNames={wallets.map(w => w.wallet_name)}
                    onWalletSelect={() => {}}
                    loading={loading}
                    batchProgress={{
                        totalTransactions: 0,
                        processedTransactions: 0,
                        currentBatch: 0,
                        isComplete: true
                    }}
                    walletProcessingStatus={walletProcessingStatus}
                    queueWalletForProcessing={async () => {}}
                    validateWalletAddress={(address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)}
                />
            )}
        </AppLayout>
    );
} 