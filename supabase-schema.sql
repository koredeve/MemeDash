-- MemeDash Database Schema for Supabase
-- Run this SQL in your Supabase project

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  telegram_id BIGINT UNIQUE,
  dashboard_user_id VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settings JSONB DEFAULT '{}'
);

-- 2. Tokens table (cached from scanner)
CREATE TABLE IF NOT EXISTS tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  mint VARCHAR UNIQUE NOT NULL,
  name VARCHAR,
  symbol VARCHAR,
  score FLOAT,
  verdict VARCHAR,
  status VARCHAR CHECK (status IN ('clean', 'watch', 'avoid', 'neutral')),
  liquidity DECIMAL,
  volume DECIMAL,
  volume_5m DECIMAL,
  volume_24h DECIMAL,
  market_cap DECIMAL,
  fdv DECIMAL,
  price_usd DECIMAL,
  age_minutes INT,
  fomo_pressure INT,
  deployer_rugs INT DEFAULT 0,
  fake_volume BOOLEAN DEFAULT false,
  detected_at TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Watchlist table (user's tracked tokens)
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_mint VARCHAR NOT NULL UNIQUE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR DEFAULT 'dashboard', -- 'telegram', 'dashboard'
  notes VARCHAR
);

-- 4. Alert rules table (user preferences)
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  min_score INT DEFAULT 70,
  min_liquidity DECIMAL DEFAULT 50000,
  max_age_minutes INT DEFAULT 60,
  alert_channels TEXT[] DEFAULT ARRAY['telegram'],
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Alert history table (audit trail)
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_mint VARCHAR NOT NULL,
  token_name VARCHAR,
  token_symbol VARCHAR,
  score FLOAT,
  liquidity DECIMAL,
  alert_type VARCHAR, -- 'watchlist_match', 'rule_match', etc.
  channels_sent TEXT[] DEFAULT ARRAY['telegram'],
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Scanner status table (heartbeat)
CREATE TABLE IF NOT EXISTS scanner_status (
  id BIGINT PRIMARY KEY DEFAULT 1,
  last_scan_time TIMESTAMP,
  scan_count INT DEFAULT 0,
  tokens_detected_today INT DEFAULT 0,
  alerts_sent_today INT DEFAULT 0,
  is_healthy BOOLEAN DEFAULT true,
  error_message VARCHAR,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_watchlist_user ON watchlist(user_id);
CREATE INDEX idx_watchlist_token ON watchlist(token_mint);
CREATE INDEX idx_alert_history_user ON alert_history(user_id);
CREATE INDEX idx_alert_history_time ON alert_history(sent_at DESC);
CREATE INDEX idx_tokens_mint ON tokens(mint);
CREATE INDEX idx_tokens_updated ON tokens(last_updated DESC);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users see own watchlist" ON watchlist
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own watchlist" ON watchlist
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users see own alert rules" ON alert_rules
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own rules" ON alert_rules
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users see own alert history" ON alert_history
  FOR SELECT USING (user_id = auth.uid());

-- Allow service role to access all data (for backend API)
-- This is handled by using SUPABASE_SERVICE_ROLE_KEY in backend
