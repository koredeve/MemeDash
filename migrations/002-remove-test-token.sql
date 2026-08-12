-- Migration: Remove TEST token used for testing

DELETE FROM tokens WHERE symbol = 'TEST' OR mint = 'TEST';

-- Verify deletion
SELECT COUNT(*) as remaining_test_tokens FROM tokens WHERE symbol = 'TEST';
