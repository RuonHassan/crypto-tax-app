import { CacheItem } from '../types';

class Cache {
    private cache: Map<string, CacheItem<any>>;
    private defaultTTL: number;

    constructor(defaultTTLMinutes = 5) {
        this.cache = new Map();
        this.defaultTTL = defaultTTLMinutes * 60 * 1000;
    }

    async get<T>(key: string): Promise<T | null> {
        const item = this.cache.get(key);
        
        if (!item) return null;
        
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data as T;
    }

    async set<T>(key: string, value: T, ttlMinutes?: number): Promise<void> {
        const timestamp = Date.now();
        const ttl = (ttlMinutes ?? this.defaultTTL) * 60 * 1000;
        
        this.cache.set(key, {
            data: value,
            timestamp,
            expiresAt: timestamp + ttl
        });
    }

    async invalidate(key: string): Promise<void> {
        this.cache.delete(key);
    }

    async invalidatePattern(pattern: string): Promise<void> {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    async clear(): Promise<void> {
        this.cache.clear();
    }
}

export const cacheManager = new Cache();

export const withCache = async <T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMinutes?: number
): Promise<T> => {
    const cached = await cacheManager.get<T>(key);
    if (cached) return cached;

    const fresh = await fetchFn();
    await cacheManager.set(key, fresh, ttlMinutes);
    return fresh;
}; 