import React from 'react';

const Step2WalletSetup = ({ 
  walletAddresses, 
  walletNames, 
  onWalletChange, 
  onWalletNameChange, 
  onAddWallet, 
  onRemoveWallet 
}) => {
  return (
    <div>
      <p className="text-geist-accent-600 dark:text-geist-accent-400 mb-6">
        Add your wallet addresses to track your crypto transactions and assets.
      </p>
      
      <div className="space-y-4">
        {walletAddresses.map((address, index) => (
          <div key={index} className="p-4 border border-geist-accent-300 dark:border-geist-accent-600 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300">
                Wallet {index + 1}
              </h3>
              {walletAddresses.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveWallet(index)}
                  className="text-geist-accent-500 hover:text-geist-accent-700 dark:text-geist-accent-400 dark:hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            <div className="mb-3">
              <label htmlFor={`walletName${index}`} className="block text-xs text-geist-accent-500 dark:text-geist-accent-400 mb-1">
                Wallet Name
              </label>
              <input
                type="text"
                id={`walletName${index}`}
                value={walletNames[index]}
                onChange={(e) => onWalletNameChange(index, e.target.value)}
                className="w-full px-3 py-2 border border-geist-accent-300 dark:border-geist-accent-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-geist-accent-500 dark:bg-geist-accent-900 dark:text-white"
                placeholder="My Wallet"
              />
            </div>
            
            <div>
              <label htmlFor={`walletAddress${index}`} className="block text-xs text-geist-accent-500 dark:text-geist-accent-400 mb-1">
                Wallet Address
              </label>
              <input
                type="text"
                id={`walletAddress${index}`}
                value={address}
                onChange={(e) => onWalletChange(index, e.target.value)}
                className="w-full px-3 py-2 border border-geist-accent-300 dark:border-geist-accent-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-geist-accent-500 dark:bg-geist-accent-900 dark:text-white"
                placeholder="Enter your solana wallet address"
              />
            </div>
          </div>
        ))}
      </div>
      
      <button
        type="button"
        onClick={onAddWallet}
        className="mt-4 px-3 py-2 border border-geist-accent-300 dark:border-geist-accent-600 text-geist-accent-700 dark:text-geist-accent-300 rounded-lg hover:bg-geist-accent-100 dark:hover:bg-geist-accent-700 transition-colors inline-flex items-center"
      >
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Another Wallet
      </button>
      
      <div className="mt-6">
        <p className="text-sm text-geist-accent-500 dark:text-geist-accent-400">
          Your wallet information is stored securely and only used to track your transactions.
        </p>
      </div>
    </div>
  );
};

export default Step2WalletSetup; 