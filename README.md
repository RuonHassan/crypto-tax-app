# TaxAI - Cryptocurrency Tax Calculator

![TaxAI Logo](./public/logo192.png)

A modern, user-friendly application that simplifies crypto tax calculations, analysis, and reporting.

## 🚀 Features

- **Multi-wallet Support**: Connect and analyze multiple Solana wallets simultaneously
- **Transaction Analysis**: Automatically categorize and process cryptocurrency transactions
- **Tax Calculation**: Calculate capital gains/losses according to tax regulations
- **Real-time Portfolio Tracking**: View your crypto portfolio with up-to-date balances
- **Tax Form Generation**: Generate ready-to-file tax forms (8949, Schedule D, 1040, Schedule 1)
- **Queue System**: Process multiple wallets with a clear indication of which wallet is currently being analyzed
- **Wallet Balance Tracking**: See current on-chain balances for all connected wallets
- **Dark Mode Support**: Enjoy a beautiful UI in both light and dark modes

## 🛠️ Technology Stack

- React 19
- Tailwind CSS
- Geist UI components
- Solana Web3.js for blockchain interaction
- Recharts for data visualization

## 🔧 Installation

### Prerequisites
- Node.js 18.x (LTS)
- npm 10.x
- [nvm](https://github.com/nvm-sh/nvm) (recommended)

### Installation

1. Use the correct Node version:
```bash
nvm install
nvm use
```

2. Install dependencies:
```bash
# Clean install with forced resolution
npm cache clean --force
npm install --force
```

3. Start the development server:
```bash
npm start
```

### Troubleshooting

If you encounter dependency issues:
1. Delete `node_modules` and `package-lock.json`
2. Clear npm cache: `npm cache clean --force`
3. Reinstall dependencies: `npm install --force`

4. The application will open in your browser at `http://localhost:3000`

## 📋 Usage Guide

### Add Your Wallets

1. Navigate to the "Your Information" page
2. Enter a name for your wallet
3. Input your Solana wallet address
4. Click "Connect" to fetch your wallet's transaction history
5. Add additional wallets if needed with the "Add Another Wallet" button

### Process Transactions

- When a wallet is connected, its transactions will be analyzed automatically
- If multiple wallets are connected, they will be processed in sequence
- You can view the queue status in the dashboard

### View Your Tax Dashboard

- The dashboard displays:
  - Current portfolio value and breakdown
  - Transaction history and details
  - Tax summary with estimated obligations
  - Available tax forms for download

### Generate Tax Forms

1. Navigate to the Tax Forms section in the dashboard
2. Select the form you need (8949, Schedule D, 1040, Schedule 1)
3. Click "Download" to save the form to your computer

## 🔄 Transaction Processing Flow

1. Fetching wallet balances directly from the blockchain
2. Analyzing transaction history
3. Categorizing transactions (trades, transfers, gas fees)
4. Calculating capital gains/losses
5. Generating tax summaries

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

If you encounter any issues or have questions, please open an issue on the repository.

## Token Registry Service

The application now includes a powerful Token Registry Service that enhances transaction processing by providing accurate token metadata. The service:

1. **On-Chain Metadata**: Fetches token metadata directly from the Solana blockchain using the Token Metadata Program, providing accurate information for any token encountered.

2. **Intelligent Caching**: Implements a sophisticated caching system to minimize RPC calls and improve performance.

3. **Fallback Mechanisms**: Uses a multi-layered approach to token identification:
   - First tries the local cache
   - Then checks known tokens list
   - Finally fetches metadata from on-chain sources
   - Creates sensible defaults for unknown tokens

4. **Rate Limiting Protection**: Includes queue processing with batch handling to prevent RPC rate limits.

5. **Enhanced Transaction Processing**: Automatically identifies tokens involved in transactions, improving the accuracy of transaction type detection.

### Usage

The token registry service is used throughout the application to:

- Identify tokens involved in DEX transactions (swaps, buys, sells)
- Provide accurate token symbols and names in the transaction table
- Enhance transaction categorization for better tax calculations

### Implementation Details

The token registry uses Metaplex's Token Metadata Program to fetch on-chain metadata for SPL tokens. It employs a singleton pattern to maintain a consistent cache across the application.

```javascript
// Example: Getting token metadata
import tokenRegistryService from './services/tokenRegistryService';

// Fetch metadata for a token
const tokenInfo = await tokenRegistryService.getTokenMetadata('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
console.log(tokenInfo.symbol); // 'USDC'

// Extract tokens from a transaction
const tokens = await tokenRegistryService.extractTokensFromTransaction(transaction, accountKeys);
```

---

Made with ❤️ by Your Team Name
