// src/services/priceService.js
import _ from 'lodash';

class PriceService {
  constructor() {
    this.priceCache = new Map();
    this.failedRequests = new Map();
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 1000; // 1 second
    this.BINANCE_SYMBOLS = {
      'solana': 'SOLUSDT',
      // Add more mappings as needed
    };
  }

  async getPriceAtTimestamp(timestamp, token = 'solana') {
    const cacheKey = `${token}-${timestamp}`;
    
    // Check cache first
    if (this.priceCache.has(cacheKey)) {
      return this.priceCache.get(cacheKey);
    }

    // Try Binance minute-level data first
    try {
      const price = await this.getBinancePrice(timestamp, token);
      if (price) {
        this.priceCache.set(cacheKey, price);
        return price;
      }
    } catch (error) {
      console.warn('Failed to fetch Binance price, falling back to daily price:', error);
    }

    // Fallback to CoinGecko daily data
    return this.getDailyPrice(timestamp, token);
  }

  async getBinancePrice(timestamp, token) {
    const symbol = this.BINANCE_SYMBOLS[token];
    if (!symbol) {
      throw new Error(`No Binance symbol mapping for token: ${token}`);
    }

    // Convert timestamp to milliseconds and round to nearest minute
    const minuteTs = Math.floor(timestamp) * 1000;
    
    try {
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${minuteTs-60000}&endTime=${minuteTs+60000}&limit=2`
      );
      
      if (!response.ok) {
        throw new Error(`Binance HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data && data.length > 0) {
        // Use the closest kline to our timestamp
        const kline = data[0];
        // Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
        const price = parseFloat(kline[4]); // Using close price
        
        if (isNaN(price)) {
          throw new Error('Invalid price data from Binance');
        }
        
        return price;
      }
      
      throw new Error('No price data available from Binance');
    } catch (error) {
      console.error('Binance price fetch error:', error);
      return null;
    }
  }

  async getDailyPrice(timestamp, token = 'solana') {
    const dateKey = new Date(timestamp * 1000).toISOString().split('T')[0];
    const cacheKey = `daily-${token}-${dateKey}`;
    
    // Check cache for daily price
    if (this.priceCache.has(cacheKey)) {
      return this.priceCache.get(cacheKey);
    }

    // Check if we've failed too many times for this date
    if (this.failedRequests.get(cacheKey) >= this.MAX_RETRIES) {
      console.warn(`Skipping CoinGecko price fetch for ${dateKey} due to previous failures`);
      return null;
    }

    try {
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

      const response = await fetch(
        `https://api.coingecko.com/v3/coins/${token}/history?date=${dateKey}`
      );
      
      if (!response.ok) {
        throw new Error(`CoinGecko HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const price = data.market_data?.current_price?.usd;
      
      if (price) {
        this.priceCache.set(cacheKey, price);
        return price;
      }
      
      throw new Error('No price data available from CoinGecko');
    } catch (error) {
      console.error(`Error fetching CoinGecko price for ${dateKey}:`, error);
      
      // Track failed requests
      const failCount = (this.failedRequests.get(cacheKey) || 0) + 1;
      this.failedRequests.set(cacheKey, failCount);
      
      return null;
    }
  }

  async getPricesInRange(startTimestamp, endTimestamp, token = 'solana') {
    const dates = [];
    let currentDate = startTimestamp;
    
    while (currentDate <= endTimestamp) {
      dates.push(currentDate);
      currentDate += 86400; // Add one day in seconds
    }

    const prices = await Promise.all(
      dates.map(date => this.getPriceAtTimestamp(date, token))
    );

    return _.zipObject(
      dates.map(date => new Date(date * 1000).toISOString()),
      prices
    );
  }

  clearCache() {
    this.priceCache.clear();
    this.failedRequests.clear();
  }

  // Clear cache items older than specified days
  clearOldCache(days = 30) {
    const now = Date.now();
    const maxAge = days * 24 * 60 * 60 * 1000;

    this.priceCache.forEach((value, key) => {
      const [, timestamp] = key.split('-');
      const date = new Date(timestamp).getTime();
      if (now - date > maxAge) {
        this.priceCache.delete(key);
        this.failedRequests.delete(key);
      }
    });
  }
}

export default new PriceService();