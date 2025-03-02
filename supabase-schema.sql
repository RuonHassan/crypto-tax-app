-- Wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  wallet_name TEXT,
  blockchain TEXT DEFAULT 'solana',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(user_id, wallet_address)
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  block_time TIMESTAMP WITH TIME ZONE,
  success BOOLEAN DEFAULT TRUE,
  fee NUMERIC,
  transaction_type TEXT,
  amount NUMERIC,
  token_symbol TEXT,
  token_address TEXT,
  usd_value NUMERIC,
  source_address TEXT,
  destination_address TEXT,
  raw_data JSONB,
  
  UNIQUE(signature)
);

-- User profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  first_name TEXT,
  last_name TEXT,
  tax_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  salary NUMERIC DEFAULT 0,
  stock_income NUMERIC DEFAULT 0,
  real_estate_income NUMERIC DEFAULT 0,
  dividends NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- For wallets table
CREATE POLICY wallets_policy ON wallets 
  FOR ALL
  USING (user_id = auth.uid());

-- For transactions table (through wallet association)
CREATE POLICY transactions_policy ON transactions 
  FOR ALL
  USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

-- For profiles table
CREATE POLICY profiles_policy ON profiles 
  FOR ALL
  USING (id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_block_time ON transactions(block_time);
CREATE INDEX idx_transactions_signature ON transactions(signature);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_wallet_address ON wallets(wallet_address); 