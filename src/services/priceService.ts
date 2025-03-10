export class PriceService {
  private cache: { [key: string]: { price: number; timestamp: number } } = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getPriceAtTimestamp(timestamp: number): Promise<number> {
    const cacheKey = timestamp.toString();
    const cached = this.cache[cacheKey];

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }

    try {
      // Fetch price from an API (replace with your actual price API)
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true`);
      const data = await response.json();
      const price = data.solana.usd;

      // Cache the result
      this.cache[cacheKey] = {
        price,
        timestamp: Date.now()
      };

      return price;
    } catch (error) {
      console.error('Error fetching price:', error);
      return 0;
    }
  }

  async getCurrentPrice(): Promise<number> {
    return this.getPriceAtTimestamp(Math.floor(Date.now() / 1000));
  }
}

export const priceService = new PriceService(); 