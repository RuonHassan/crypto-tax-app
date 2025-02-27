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

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/crypto-tax-app.git
   cd crypto-tax-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

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

---

Made with ❤️ by Your Team Name
