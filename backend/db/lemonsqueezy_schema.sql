-- Profiles Extension
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Subscriptions (Lemon Squeezy)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    lemon_subscription_id TEXT UNIQUE,
    lemon_customer_id TEXT,
    plan TEXT,
    status TEXT, -- active, cancelled, expired, etc.
    renews_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Transactions Log
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount INTEGER NOT NULL, -- Positive (add) or Negative (spend)
    source TEXT NOT NULL, -- 'purchase', 'usage', 'adjustment'
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects Extension for Real-time
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS progress_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_label TEXT;

-- Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credit transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
