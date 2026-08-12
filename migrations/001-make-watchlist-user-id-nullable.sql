-- Migration: Make watchlist.user_id nullable to allow tracking without user account
-- This enables dashboard users to track tokens without creating an account

-- Alter watchlist table to make user_id nullable
ALTER TABLE watchlist
  ALTER COLUMN user_id DROP NOT NULL;

-- Create index on token_mint for faster lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_token_mint ON watchlist(token_mint);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);

-- Verify the change
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_name='watchlist' AND column_name='user_id';
