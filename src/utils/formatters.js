/**
 * Utility functions for formatting various types of data
 */

/**
 * Format a number as currency with dollar sign
 * @param {number} amount - The amount to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, decimals = 2) => {
  if (amount === undefined || amount === null) {
    return '$0.00';
  }
  
  // Handle potential string input
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Check if value is a valid number
  if (isNaN(numAmount)) {
    return '$0.00';
  }

  // Format with dollar sign, commas, and specified decimals
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(numAmount);
};

/**
 * Format a number with commas (without currency symbol)
 * @param {number} number - The number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number string
 */
export const formatNumber = (number, decimals = 2) => {
  if (number === undefined || number === null) {
    return '0';
  }
  
  // Handle potential string input
  const num = typeof number === 'string' ? parseFloat(number) : number;
  
  // Check if value is a valid number
  if (isNaN(num)) {
    return '0';
  }

  // Format with commas and specified decimals
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
};

/**
 * Format a number as a percentage
 * @param {number} number - The number to format as percentage (e.g., 0.25 for 25%)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (number, decimals = 2) => {
  if (number === undefined || number === null) {
    return '0%';
  }
  
  // Handle potential string input
  const num = typeof number === 'string' ? parseFloat(number) : number;
  
  // Check if value is a valid number
  if (isNaN(num)) {
    return '0%';
  }

  // Format as percentage with specified decimals
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
};

/**
 * Format a date as a string
 * @param {Date|number|string} date - The date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
}) => {
  if (!date) {
    return '';
  }
  
  try {
    // Convert to Date object if necessary
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Format the date
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Truncate address or long string with ellipsis in the middle
 * @param {string} str - The string to truncate
 * @param {number} startChars - Number of characters to show at the start
 * @param {number} endChars - Number of characters to show at the end
 * @returns {string} Truncated string
 */
export const truncateMiddle = (str, startChars = 6, endChars = 4) => {
  if (!str) {
    return '';
  }
  
  if (str.length <= startChars + endChars) {
    return str;
  }
  
  return `${str.substring(0, startChars)}...${str.substring(str.length - endChars)}`;
}; 