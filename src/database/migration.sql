-- LuxWin App Database Migration
-- Adds UUID support and updates user table schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (if recreating)
-- WARNING: This will delete all data
-- DROP TABLE IF EXISTS bets CASCADE;
-- DROP TABLE IF EXISTS game_rounds CASCADE;
-- DROP TABLE IF EXISTS withdrawals CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS wallets CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- Create users table with UUID and updated schema
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  withdrawal_password_hash VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  balance DECIMAL(15, 2) DEFAULT 0.00,  -- DEPRECATED: Use wallets.balance as single source of truth
  avatar VARCHAR(255) NOT NULL,
  is_banned BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add is_admin column if migrating from older schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create wallets table (SINGLE SOURCE OF TRUTH for user balance)
-- Every user MUST have exactly ONE wallet record created during signup
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0.00,  -- PRIMARY balance field - always use this
  locked_balance DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  balance_before DECIMAL(15, 2) NOT NULL,
  balance_after DECIMAL(15, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'completed',
  reference_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  fee DECIMAL(15, 2) DEFAULT 0.00,
  net_amount DECIMAL(15, 2) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  notes TEXT
);

-- Create game_rounds table
CREATE TABLE IF NOT EXISTS game_rounds (
  id SERIAL PRIMARY KEY,
  round_number INTEGER UNIQUE NOT NULL,
  start_time TIMESTAMP NOT NULL,
  lock_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  result VARCHAR(50),
  result_number INTEGER,
  status VARCHAR(50) DEFAULT 'betting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create bets table
CREATE TABLE IF NOT EXISTS bets (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id INTEGER NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  choice VARCHAR(50) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) DEFAULT 0.00,
  stake_amount DECIMAL(15, 2) NOT NULL,
  result VARCHAR(50),
  payout DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add tax_amount and stake_amount columns if migrating from older schema
ALTER TABLE bets ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15, 2) DEFAULT 0.00;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS stake_amount DECIMAL(15, 2);

-- Update existing bets: set stake_amount = amount - tax_amount if null
UPDATE bets SET stake_amount = amount - COALESCE(tax_amount, 0) WHERE stake_amount IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_round_id ON bets(round_id);
CREATE INDEX IF NOT EXISTS idx_bets_created_at ON bets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- Success message
SELECT 'Database migration completed successfully!' AS message;
