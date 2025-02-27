/**
 * Service for handling tax calculations and form generation
 */
export default class TaxCalculationService {
  /**
   * Calculate volume of transactions
   * @param {Array} transactions - List of transactions
   * @returns {number} - Total volume
   */
  calculateVolume(transactions) {
    return transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }
  
  /**
   * Calculate taxes based on transactions
   * @param {Array} transactions - Processed transactions
   * @param {Object} formData - User form data including traditional income
   * @returns {Object} - Tax calculations and summaries
   */
  calculateTaxes(transactions, formData) {
    // Filter out non-taxable events
    const nonGasTransactions = transactions.filter(tx => 
      tx.type !== 'gas' && !tx.isInternalTransfer
    );

    // Calculate crypto tax information
    const cryptoTaxes = {
      totalTrades: nonGasTransactions.length,
      totalVolume: this.calculateVolume(nonGasTransactions),
      realizedGains: nonGasTransactions.reduce((sum, tx) => sum + (tx.realizedGain || 0), 0),
      estimatedTax: nonGasTransactions.reduce((sum, tx) => sum + ((tx.realizedGain || 0) * 0.30), 0),
      gasFees: transactions.filter(tx => tx.type === 'gas')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0),
      internalTransfers: transactions.filter(tx => tx.isInternalTransfer).length
    };

    // Calculate traditional tax information
    const traditionalTaxes = {
      totalIncome: Number(formData.salary) || 0,
      stockGains: Number(formData.stockIncome) || 0,
      realEstateGains: Number(formData.realEstateIncome) || 0,
      dividendIncome: Number(formData.dividends) || 0,
      estimatedTax: (
        (Number(formData.salary) || 0) * 0.25 +
        (Number(formData.stockIncome) || 0) * 0.20 +
        (Number(formData.realEstateIncome) || 0) * 0.25 +
        (Number(formData.dividends) || 0) * 0.15
      )
    };

    // Calculate overall tax situation
    const totalTaxSituation = {
      totalIncome: cryptoTaxes.realizedGains + traditionalTaxes.totalIncome + 
                  traditionalTaxes.stockGains + traditionalTaxes.realEstateGains + 
                  traditionalTaxes.dividendIncome,
      totalEstimatedTax: cryptoTaxes.estimatedTax + traditionalTaxes.estimatedTax,
      effectiveTaxRate: 0
    };

    // Calculate effective tax rate
    if (totalTaxSituation.totalIncome > 0) {
      totalTaxSituation.effectiveTaxRate = totalTaxSituation.totalEstimatedTax / totalTaxSituation.totalIncome;
    }

    return {
      crypto: cryptoTaxes,
      traditional: traditionalTaxes,
      total: totalTaxSituation
    };
  }

  /**
   * Generate a tax form
   * @param {string} formType - Type of form to generate (8949, ScheduleD, etc.)
   * @param {Object} taxData - Tax calculation results
   * @param {Array} transactions - Transaction data 
   * @param {Object} formData - User form data
   * @returns {Object} - Generated form data
   */
  generateTaxForm(formType, taxData, transactions, formData) {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    // Base form information
    const formBase = {
      generatedDate: formattedDate,
      taxYear: now.getFullYear() - 1,
      taxpayerName: `${formData.firstName || 'John'} ${formData.lastName || 'Doe'}`,
      taxpayerId: 'XXX-XX-XXXX' // Placeholder
    };
    
    // Generate specific form based on type
    switch (formType) {
      case '8949':
        return {
          ...formBase,
          formName: 'Form 8949',
          subtitle: 'Sales and Other Dispositions of Capital Assets',
          partI: {
            shortTerm: this.generateShortTermTransactions(transactions)
          },
          partII: {
            longTerm: this.generateLongTermTransactions(transactions)
          }
        };
        
      case 'ScheduleD':
        return {
          ...formBase,
          formName: 'Schedule D',
          subtitle: 'Capital Gains and Losses',
          summary: {
            shortTermTotal: taxData.crypto.realizedGains,
            longTermTotal: 0, // Assuming all crypto is short term for now
            netGain: taxData.crypto.realizedGains
          }
        };
        
      case '1040':
        return {
          ...formBase,
          formName: 'Form 1040',
          subtitle: 'U.S. Individual Income Tax Return',
          income: {
            wages: taxData.traditional.totalIncome,
            interest: 0,
            dividends: taxData.traditional.dividendIncome,
            capitalGains: taxData.crypto.realizedGains + taxData.traditional.stockGains,
            otherIncome: taxData.traditional.realEstateGains,
            totalIncome: taxData.total.totalIncome
          },
          deductions: {
            standard: 12950, // 2022 standard deduction for single filer
            other: 0,
            total: 12950
          },
          taxableIncome: Math.max(0, taxData.total.totalIncome - 12950),
          calculatedTax: taxData.total.totalEstimatedTax
        };
        
      case 'Schedule1':
        return {
          ...formBase,
          formName: 'Schedule 1',
          subtitle: 'Additional Income and Adjustments to Income',
          additionalIncome: {
            businessIncome: 0,
            capitalGains: taxData.crypto.realizedGains,
            rentalRealEstate: taxData.traditional.realEstateGains,
            otherIncome: 0,
            totalAdditionalIncome: taxData.crypto.realizedGains + taxData.traditional.realEstateGains
          }
        };
        
      default:
        return {
          ...formBase,
          formName: 'Unknown Form',
          error: 'Form type not recognized'
        };
    }
  }
  
  /**
   * Generate short-term transaction data for Form 8949
   * @param {Array} transactions - List of transactions
   * @returns {Array} - Formatted transaction data
   */
  generateShortTermTransactions(transactions) {
    return transactions
      .filter(tx => 
        // Filter for taxable events that are short term (held < 1 year)
        tx.type !== 'gas' && 
        !tx.isInternalTransfer && 
        tx.realizedGain !== undefined
      )
      .map(tx => ({
        description: `${tx.type === 'swap' ? 'Swap' : 'Sale'} of crypto assets`,
        dateAcquired: new Date(tx.timestamp - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Assumed acquisition date
        dateSold: new Date(tx.timestamp).toISOString().split('T')[0],
        proceeds: tx.amount || 0,
        cost: (tx.amount || 0) - (tx.realizedGain || 0),
        adjustment: 0,
        gain: tx.realizedGain || 0
      }));
  }
  
  /**
   * Generate long-term transaction data for Form 8949
   * @param {Array} transactions - List of transactions
   * @returns {Array} - Formatted transaction data
   */
  generateLongTermTransactions(transactions) {
    // For now, assuming no long-term crypto holdings
    return [];
  }
} 