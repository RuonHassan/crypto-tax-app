// Transaction types for Jupiter Perps
export const PERPS_TRANSACTION_TYPES = {
  OPEN_POSITION: 'perps-open',
  CLOSE_POSITION: 'perps-close',
  INCREASE_POSITION: 'perps-increase',
  DECREASE_POSITION: 'perps-decrease',
  INSTANT_INCREASE: 'perps-instant-increase',
  INSTANT_DECREASE: 'perps-instant-decrease',
  LIQUIDATION: 'perps-liquidation',
  ADD_MARGIN: 'perps-add-margin',
  REMOVE_MARGIN: 'perps-remove-margin',
  FEE: 'fee'
};

// Jupiter Perps Program IDs
export const JUPITER_PERPS_PROGRAM_IDs = [
  'PERP7Y6dh5AZgz9k9eieE7BcWegMGbUyiYKxHKNPGXE', // Main program
  'perpke6JybKfRDi7xYzUssvWvUyEJzqNDGT5T8kqvV9', // Perpetual Protocol
  'JPPooLEqRb2LuVYJx6mjSfJA7YWcqQz2iCfBdz7k9Cn', // Jupiter Perps
];

// Helper function to check if a transaction is a Jupiter Perps transaction
export const isJupiterPerpsTransaction = (transaction) => {
  if (!transaction?.transaction?.message?.accountKeys) return false;

  // Check if any of the account keys match Jupiter Perps program IDs
  const accountKeys = transaction.transaction.message.accountKeys.map(key => 
    typeof key === 'string' ? key : key.pubkey || key.toString()
  );
  
  const hasPerpsProgram = accountKeys.some(key => JUPITER_PERPS_PROGRAM_IDs.includes(key));
  
  // Also check log messages for perps-related keywords
  const logMessages = transaction.meta?.logMessages || [];
  const hasPerpsKeywords = logMessages.some(log => {
    const lowerLog = log.toLowerCase();
    return lowerLog.includes('perp') || 
           lowerLog.includes('position') ||
           lowerLog.includes('margin') ||
           lowerLog.includes('liquidate') ||
           lowerLog.includes('instantincreaseposition') ||
           lowerLog.includes('instant_increase_position') ||
           lowerLog.includes('increaseposition');
  });

  return hasPerpsProgram || hasPerpsKeywords;
};

// Helper function to parse Jupiter Perps transaction type
export const parseJupiterPerpsTransaction = (transaction) => {
  if (!isJupiterPerpsTransaction(transaction)) return null;
  
  try {
    const logMessages = transaction.meta?.logMessages || [];
    const instructions = transaction.transaction.message.instructions || [];
    
    // Convert log messages to lowercase for case-insensitive matching
    const lowerLogs = logMessages.map(log => log.toLowerCase());
    
    // Check for instant position modifications first
    if (lowerLogs.some(log => 
      log.includes('instantincreaseposition') || 
      log.includes('instant_increase_position')
    )) {
      return {
        type: PERPS_TRANSACTION_TYPES.INSTANT_INCREASE,
        details: {
          market: extractMarketFromLogs(logMessages),
          size: extractPositionSize(logMessages),
          direction: extractPositionDirection(logMessages)
        }
      };
    }

    if (lowerLogs.some(log => 
      log.includes('instantdecreaseposition') || 
      log.includes('instant_decrease_position')
    )) {
      return {
        type: PERPS_TRANSACTION_TYPES.INSTANT_DECREASE,
        details: {
          market: extractMarketFromLogs(logMessages),
          size: extractPositionSize(logMessages),
          direction: extractPositionDirection(logMessages)
        }
      };
    }

    // Check for regular position modifications
    if (lowerLogs.some(log => 
      log.includes('increaseposition') || 
      log.includes('increase_position')
    )) {
      return {
        type: PERPS_TRANSACTION_TYPES.INCREASE_POSITION,
        details: {
          market: extractMarketFromLogs(logMessages),
          size: extractPositionSize(logMessages),
          direction: extractPositionDirection(logMessages)
        }
      };
    }

    if (lowerLogs.some(log => 
      log.includes('decreaseposition') || 
      log.includes('decrease_position')
    )) {
      return {
        type: PERPS_TRANSACTION_TYPES.DECREASE_POSITION,
        details: {
          market: extractMarketFromLogs(logMessages),
          size: extractPositionSize(logMessages),
          direction: extractPositionDirection(logMessages)
        }
      };
    }

    // Check for liquidation
    if (lowerLogs.some(log => log.includes('liquidate') || log.includes('liquidation'))) {
      return {
        type: PERPS_TRANSACTION_TYPES.LIQUIDATION,
        details: {
          market: extractMarketFromLogs(logMessages),
          liquidationAmount: extractLiquidationAmount(logMessages)
        }
      };
    }
    
    // Check for position closure
    if (lowerLogs.some(log => 
      log.includes('close_position') || 
      log.includes('closeposition') || 
      log.includes('close position')
    )) {
      return {
        type: PERPS_TRANSACTION_TYPES.CLOSE_POSITION,
        details: {
          market: extractMarketFromLogs(logMessages),
          pnl: extractPnLFromLogs(logMessages)
        }
      };
    }
    
    // Check for position opening
    if (lowerLogs.some(log => 
      log.includes('open_position') || 
      log.includes('openposition') || 
      log.includes('open position')
    )) {
      return {
        type: PERPS_TRANSACTION_TYPES.OPEN_POSITION,
        details: {
          market: extractMarketFromLogs(logMessages),
          size: extractPositionSize(logMessages),
          direction: extractPositionDirection(logMessages)
        }
      };
    }
    
    // Check for margin adjustments
    if (lowerLogs.some(log => 
      log.includes('add_margin') || 
      log.includes('addmargin') || 
      log.includes('add margin')
    )) {
      return {
        type: PERPS_TRANSACTION_TYPES.ADD_MARGIN,
        details: {
          amount: extractMarginAmount(logMessages)
        }
      };
    }
    
    if (lowerLogs.some(log => 
      log.includes('remove_margin') || 
      log.includes('removemargin') || 
      log.includes('remove margin')
    )) {
      return {
        type: PERPS_TRANSACTION_TYPES.REMOVE_MARGIN,
        details: {
          amount: extractMarginAmount(logMessages)
        }
      };
    }
    
    // If it's a perps transaction but we can't determine the specific type
    if (lowerLogs.some(log => log.includes('perp'))) {
      return {
        type: PERPS_TRANSACTION_TYPES.FEE,
        details: {
          fee: transaction.meta?.fee || 0
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Jupiter Perps transaction:', error);
    return null;
  }
};

// Helper functions to extract information from logs
const extractMarketFromLogs = (logs) => {
  try {
    const marketLog = logs.find(log => log.includes('market:'));
    if (marketLog) {
      return marketLog.split('market:')[1].trim();
    }
    return 'Unknown Market';
  } catch (error) {
    return 'Unknown Market';
  }
};

const extractPnLFromLogs = (logs) => {
  try {
    const pnlLog = logs.find(log => log.includes('PnL:'));
    if (pnlLog) {
      const pnlMatch = pnlLog.match(/PnL:\s*([-+]?\d*\.?\d+)/);
      return pnlMatch ? parseFloat(pnlMatch[1]) : 0;
    }
    return 0;
  } catch (error) {
    return 0;
  }
};

const extractPositionSize = (logs) => {
  try {
    const sizeLog = logs.find(log => log.includes('size:'));
    if (sizeLog) {
      const sizeMatch = sizeLog.match(/size:\s*(\d*\.?\d+)/);
      return sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    }
    return 0;
  } catch (error) {
    return 0;
  }
};

const extractPositionDirection = (logs) => {
  try {
    const directionLog = logs.find(log => log.includes('direction:'));
    if (directionLog) {
      return directionLog.toLowerCase().includes('long') ? 'long' : 'short';
    }
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
};

const extractLiquidationAmount = (logs) => {
  try {
    const amountLog = logs.find(log => log.includes('amount:'));
    if (amountLog) {
      const amountMatch = amountLog.match(/amount:\s*(\d*\.?\d+)/);
      return amountMatch ? parseFloat(amountMatch[1]) : 0;
    }
    return 0;
  } catch (error) {
    return 0;
  }
};

const extractMarginAmount = (logs) => {
  try {
    const marginLog = logs.find(log => log.includes('margin:'));
    if (marginLog) {
      const marginMatch = marginLog.match(/margin:\s*(\d*\.?\d+)/);
      return marginMatch ? parseFloat(marginMatch[1]) : 0;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}; 