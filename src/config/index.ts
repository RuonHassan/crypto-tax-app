interface Config {
    supabase: {
        url: string;
        key: string;
    };
    helius: {
        apiKey: string;
        baseUrl: string;
        rpcUrl: string;
    };
    rateLimit: {
        transactions: number;
        prices: number;
    };
    cache: {
        defaultTTL: number;
        pricesTTL: number;
    };
}

const config: Config = {
    supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    },
    helius: {
        apiKey: '268519a5-accf-40b1-9fe3-d0d61fe3a5ce',
        baseUrl: 'https://api.helius.xyz/v0',
        rpcUrl: `https://rpc.helius.xyz/?api-key=268519a5-accf-40b1-9fe3-d0d61fe3a5ce`
    },
    rateLimit: {
        transactions: 10, // requests per second
        prices: 5 // requests per second
    },
    cache: {
        defaultTTL: 5 * 60, // 5 minutes in seconds
        pricesTTL: 60 * 60 // 1 hour in seconds
    }
};

// Validate required environment variables
const validateConfig = () => {
    const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'HELIUS_API_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`
        );
    }
};

try {
    validateConfig();
} catch (error) {
    console.error('Configuration Error:', error.message);
    // In development, we might want to continue with missing vars
    if (process.env.NODE_ENV === 'production') {
        throw error;
    }
}

export default config; 