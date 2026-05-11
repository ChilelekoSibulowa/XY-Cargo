-- Add payment_type column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type text;

-- Add description column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS description text;

-- Add payment_method column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method text;
