import { TRANSACTION_TYPES } from './transactionUtils';

export const calculateTaxableEvents = (transactions) => {
  let taxableEvents = [];
  let holdings = new Map(); // Track holdings across all wallets
  let totalGains = 0;
  let totalLosses = 0;

  // Filter out internal transfers and gas fees
  const relevantTransactions = transactions.filter(tx => 
    tx.type !== TRANSACTION_TYPES.INTERNAL_TRANSFER && 
    tx.type !== TRANSACTION_TYPES.GAS
  );

  relevantTransactions.forEach(tx => {
    const solChange = tx.solChange;
    const priceAtSale = tx.priceAtSale;

    if (solChange > 0) { // Receiving SOL
      // Add to holdings using FIFO
      const currentHolding = holdings.get('SOL') || [];
      currentHolding.push({
        amount: solChange,
        price: priceAtSale,
        timestamp: tx.timestamp,
        signature: tx.signature
      });
      holdings.set('SOL', currentHolding);
    } else if (solChange < 0) { // Selling or spending SOL
      const amount = Math.abs(solChange);
      let remainingAmount = amount;
      const currentHolding = holdings.get('SOL') || [];
      let costBasis = 0;
      let disposedLots = [];

      while (remainingAmount > 0 && currentHolding.length > 0) {
        const lot = currentHolding[0];
        const disposedAmount = Math.min(remainingAmount, lot.amount);
        
        costBasis += disposedAmount * lot.price;
        disposedLots.push({
          amount: disposedAmount,
          price: lot.price,
          timestamp: lot.timestamp,
          signature: lot.signature
        });

        if (disposedAmount === lot.amount) {
          currentHolding.shift();
        } else {
          lot.amount -= disposedAmount;
        }
        
        remainingAmount -= disposedAmount;
      }

      if (remainingAmount > 0) {
        console.warn(`Warning: Insufficient holdings to cover transaction ${tx.signature}`);
        // Use the price at sale for remaining amount
        costBasis += remainingAmount * priceAtSale;
      }

      const proceedsUSD = amount * priceAtSale;
      const gainLoss = proceedsUSD - costBasis;

      if (gainLoss > 0) {
        totalGains += gainLoss;
      } else {
        totalLosses += Math.abs(gainLoss);
      }

      taxableEvents.push({
        date: new Date(tx.timestamp * 1000),
        type: tx.type === TRANSACTION_TYPES.SWAP ? 'Swap' : 'Sale',
        amount,
        proceedsUSD,
        costBasis,
        gainLoss,
        signature: tx.signature,
        disposedLots
      });

      holdings.set('SOL', currentHolding);
    }
  });

  // Calculate remaining holdings
  const remainingHoldings = Array.from(holdings.entries()).map(([token, lots]) => ({
    token,
    totalAmount: lots.reduce((sum, lot) => sum + lot.amount, 0),
    lots: lots.map(lot => ({
      amount: lot.amount,
      price: lot.price,
      timestamp: lot.timestamp,
      costBasis: lot.amount * lot.price
    }))
  }));

  return {
    taxableEvents: taxableEvents.sort((a, b) => a.date - b.date),
    totalGains,
    totalLosses,
    netGainLoss: totalGains - totalLosses,
    remainingHoldings
  };
}; 