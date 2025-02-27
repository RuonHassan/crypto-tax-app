const calculateTaxes = (income, transactions) => {
    // Tax brackets for 2024 (example rates)
    const taxBrackets = [
      { max: 11600, rate: 0.10 },
      { max: 47150, rate: 0.12 },
      { max: 100525, rate: 0.22 },
      { max: 191950, rate: 0.24 },
      { max: 243725, rate: 0.32 },
      { max: 609350, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ];
  
    const calculateIncomeTax = (amount) => {
      let remainingIncome = amount;
      let totalTax = 0;
      let previousMax = 0;
  
      for (const bracket of taxBrackets) {
        const taxableInBracket = Math.min(
          Math.max(0, remainingIncome),
          bracket.max - previousMax
        );
        totalTax += taxableInBracket * bracket.rate;
        remainingIncome -= taxableInBracket;
        previousMax = bracket.max;
        if (remainingIncome <= 0) break;
      }
  
      return totalTax;
    };
  
    const calculateCryptoTax = (transactions) => {
      // Sort transactions by date for FIFO cost basis
      const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
      
      const oneYear = 365 * 24 * 60 * 60; // one year in seconds
      let shortTermGains = 0;
      let longTermGains = 0;
  
      sortedTxs.forEach(tx => {
        const holdingPeriod = tx.timestamp - tx.acquisitionTimestamp;
        const gain = tx.solChange * tx.priceAtSale - tx.solChange * tx.priceAtAcquisition;
        
        if (holdingPeriod >= oneYear) {
          longTermGains += gain;
        } else {
          shortTermGains += gain;
        }
      });
  
      return {
        shortTermGains,
        longTermGains,
        shortTermTax: shortTermGains * 0.37, // Short-term gains taxed as ordinary income
        longTermTax: longTermGains * 0.20    // Long-term capital gains rate (simplified)
      };
    };
  
    // Calculate total tax
    const incomeTax = calculateIncomeTax(income.salary);
    const cryptoTaxes = calculateCryptoTax(transactions);
    const dividendsTax = calculateIncomeTax(income.dividends);
    
    return {
      incomeTax,
      cryptoTaxes,
      dividendsTax,
      totalTax: incomeTax + cryptoTaxes.shortTermTax + cryptoTaxes.longTermTax + dividendsTax
    };
  };
  
  export default calculateTaxes;