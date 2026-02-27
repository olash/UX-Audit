-- Add credits column to profiles if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Create Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL, -- 'active', 'canceled', 'past_due'
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" 
ON subscriptions FOR SELECT 
USING (auth.uid() = user_id);

-- RPC: Increment Credits
CREATE OR REPLACE FUNCTION increment_credits(uid UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET credits = credits + amount
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Decrement Credits
CREATE OR REPLACE FUNCTION decrement_credits(uid UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET credits = GREATEST(0, credits - amount)
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
