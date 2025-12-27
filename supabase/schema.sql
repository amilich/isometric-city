-- Multiplayer Schema
-- Run this in your Supabase SQL Editor

-- Regions: Groups of city slots where players can collaborate
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  creator_city_id UUID,
  max_slots INTEGER NOT NULL DEFAULT 9,
  grid_rows INTEGER NOT NULL DEFAULT 3,
  grid_cols INTEGER NOT NULL DEFAULT 3,
  is_public BOOLEAN NOT NULL DEFAULT true,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_grid_size CHECK (grid_rows >= 2 AND grid_rows <= 5 AND grid_cols >= 2 AND grid_cols <= 5),
  CONSTRAINT max_slots_matches_grid CHECK (max_slots = grid_rows * grid_cols)
);

-- Cities: Player cities synced from localStorage
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY,
  device_token TEXT NOT NULL,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  slot_row INTEGER,
  slot_col INTEGER,
  city_name TEXT NOT NULL,
  population INTEGER NOT NULL DEFAULT 0,
  money INTEGER NOT NULL DEFAULT 10000,
  year INTEGER NOT NULL DEFAULT 2024,
  month INTEGER NOT NULL DEFAULT 1,
  grid_size INTEGER NOT NULL DEFAULT 50,
  state_blob TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_slot_position CHECK (
    (slot_row IS NULL AND slot_col IS NULL) OR 
    (slot_row IS NOT NULL AND slot_col IS NOT NULL AND slot_row >= 0 AND slot_col >= 0)
  )
);

ALTER TABLE regions 
  ADD CONSTRAINT fk_creator_city 
  FOREIGN KEY (creator_city_id) REFERENCES cities(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_slot_per_region 
  ON cities(region_id, slot_row, slot_col) 
  WHERE region_id IS NOT NULL AND slot_row IS NOT NULL AND slot_col IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cities_device_token ON cities(device_token);
CREATE INDEX IF NOT EXISTS idx_cities_region ON cities(region_id);
CREATE INDEX IF NOT EXISTS idx_regions_public ON regions(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_regions_invite_code ON regions(invite_code) WHERE invite_code IS NOT NULL;

-- Row Level Security
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public regions" ON regions
  FOR SELECT USING (is_public = true);

CREATE POLICY "Anyone can create regions" ON regions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update public regions" ON regions
  FOR UPDATE USING (is_public = true);

CREATE POLICY "Anyone can read cities" ON cities
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create cities" ON cities
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Owner can update city" ON cities
  FOR UPDATE USING (true);

CREATE POLICY "Owner can delete city" ON cities
  FOR DELETE USING (true);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cities_updated_at ON cities;
CREATE TRIGGER update_cities_updated_at
  BEFORE UPDATE ON cities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for cities (run in Supabase dashboard):
-- ALTER PUBLICATION supabase_realtime ADD TABLE cities;

-- ============================================================================
-- GLOBAL MARKET
-- ============================================================================

-- Market prices: Current prices for each resource type
CREATE TABLE IF NOT EXISTS market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL UNIQUE,
  base_price DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2) NOT NULL,
  total_supply BIGINT NOT NULL DEFAULT 0,
  total_demand BIGINT NOT NULL DEFAULT 0,
  price_change_24h DECIMAL(5,2) DEFAULT 0,
  high_24h DECIMAL(10,2),
  low_24h DECIMAL(10,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize default market prices
INSERT INTO market_prices (resource_type, base_price, current_price) VALUES
  ('power', 10.00, 10.00),
  ('water', 8.00, 8.00),
  ('workers', 5.00, 5.00),
  ('materials', 15.00, 15.00)
ON CONFLICT (resource_type) DO NOTHING;

-- Trade orders: Buy/sell orders from cities
CREATE TABLE IF NOT EXISTS trade_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL,
  city_name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('buy', 'sell')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_unit DECIMAL(10,2) NOT NULL CHECK (price_per_unit > 0),
  filled_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'filled', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Trade history: Completed trades
CREATE TABLE IF NOT EXISTS trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_city_id UUID,
  seller_city_id UUID,
  buyer_city_name TEXT NOT NULL,
  seller_city_name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- City market settings: Auto-trade preferences
CREATE TABLE IF NOT EXISTS city_market_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  auto_sell_enabled BOOLEAN DEFAULT FALSE,
  auto_sell_threshold INTEGER DEFAULT 0,
  auto_sell_min_price DECIMAL(10,2),
  auto_buy_enabled BOOLEAN DEFAULT FALSE,
  auto_buy_threshold INTEGER DEFAULT 0,
  auto_buy_max_price DECIMAL(10,2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city_id, resource_type)
);

-- Indexes for market queries
CREATE INDEX IF NOT EXISTS idx_trade_orders_status ON trade_orders(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trade_orders_resource ON trade_orders(resource_type, order_type, price_per_unit);
CREATE INDEX IF NOT EXISTS idx_trade_orders_city ON trade_orders(city_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_time ON trade_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_city_market_settings ON city_market_settings(city_id);

-- RLS for market tables
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_market_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market prices" ON market_prices FOR SELECT USING (true);
CREATE POLICY "Anyone can read open orders" ON trade_orders FOR SELECT USING (true);
CREATE POLICY "Anyone can create orders" ON trade_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Owner can update orders" ON trade_orders FOR UPDATE USING (true);
CREATE POLICY "Owner can delete orders" ON trade_orders FOR DELETE USING (true);
CREATE POLICY "Anyone can read trade history" ON trade_history FOR SELECT USING (true);
CREATE POLICY "System can insert history" ON trade_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read market settings" ON city_market_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can manage market settings" ON city_market_settings FOR ALL USING (true);

-- Trigger for trade_orders updated_at
DROP TRIGGER IF EXISTS update_trade_orders_updated_at ON trade_orders;
CREATE TRIGGER update_trade_orders_updated_at
  BEFORE UPDATE ON trade_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for market (run in Supabase dashboard):
-- ALTER PUBLICATION supabase_realtime ADD TABLE market_prices;
-- ALTER PUBLICATION supabase_realtime ADD TABLE trade_orders;

-- ============================================================================
-- CHAT SYSTEM
-- ============================================================================

-- Chat messages: Global and regional chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL CHECK (channel_type IN ('global', 'region')),
  channel_id UUID,  -- region_id for region chat, NULL for global
  city_id UUID,
  city_name TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  message_type TEXT NOT NULL DEFAULT 'user' CHECK (message_type IN ('user', 'system', 'announcement')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_channel_id CHECK (
    (channel_type = 'global' AND channel_id IS NULL) OR
    (channel_type = 'region' AND channel_id IS NOT NULL)
  )
);

-- Index for fast channel queries
CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel_type, channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);

-- RLS for chat messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can send chat messages" ON chat_messages FOR INSERT WITH CHECK (true);

-- Enable realtime for chat (run in Supabase dashboard):
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ============================================================================
-- REGIONAL TREASURY
-- ============================================================================

-- Regional treasury: Shared bank account for each region
CREATE TABLE IF NOT EXISTS regional_treasuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance BIGINT DEFAULT 0,
  contribution_model TEXT DEFAULT 'proportional' CHECK (contribution_model IN ('flat', 'proportional', 'progressive', 'voluntary')),
  contribution_rate DECIMAL(10,2) DEFAULT 2.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treasury transactions: Track all deposits and withdrawals
CREATE TABLE IF NOT EXISTS treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id UUID REFERENCES regional_treasuries(id) ON DELETE CASCADE NOT NULL,
  city_id UUID,
  city_name TEXT NOT NULL,
  amount BIGINT NOT NULL,  -- positive = deposit, negative = withdrawal
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('contribution', 'great_work', 'grant', 'relief', 'withdrawal')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for treasury queries
CREATE INDEX IF NOT EXISTS idx_treasury_region ON regional_treasuries(region_id);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_treasury ON treasury_transactions(treasury_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_city ON treasury_transactions(city_id);

-- RLS for treasury tables
ALTER TABLE regional_treasuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read treasuries" ON regional_treasuries FOR SELECT USING (true);
CREATE POLICY "Anyone can create treasuries" ON regional_treasuries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update treasuries" ON regional_treasuries FOR UPDATE USING (true);

CREATE POLICY "Anyone can read treasury transactions" ON treasury_transactions FOR SELECT USING (true);
CREATE POLICY "Anyone can create treasury transactions" ON treasury_transactions FOR INSERT WITH CHECK (true);

-- Trigger for treasury updated_at
DROP TRIGGER IF EXISTS update_regional_treasuries_updated_at ON regional_treasuries;
CREATE TRIGGER update_regional_treasuries_updated_at
  BEFORE UPDATE ON regional_treasuries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for treasury (run in Supabase dashboard):
-- ALTER PUBLICATION supabase_realtime ADD TABLE regional_treasuries;
-- ALTER PUBLICATION supabase_realtime ADD TABLE treasury_transactions;

-- ============================================================================
-- GREAT WORKS
-- ============================================================================

-- Great works: Collaborative mega-projects for regions
CREATE TABLE IF NOT EXISTS great_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE NOT NULL,
  work_type TEXT NOT NULL,  -- 'airport', 'solar_farm', 'arcology', etc.
  status TEXT NOT NULL DEFAULT 'voting' CHECK (status IN ('voting', 'in_progress', 'completed', 'cancelled')),
  
  -- Requirements
  required_money BIGINT NOT NULL,
  required_materials INTEGER NOT NULL DEFAULT 0,
  required_workers INTEGER NOT NULL DEFAULT 0,
  
  -- Current contributions
  contributed_money BIGINT NOT NULL DEFAULT 0,
  contributed_materials INTEGER NOT NULL DEFAULT 0,
  contributed_workers INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  proposed_by UUID REFERENCES cities(id) ON DELETE SET NULL,
  proposer_name TEXT NOT NULL,
  voting_ends_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Great work votes: Track city votes on proposals
CREATE TABLE IF NOT EXISTS great_work_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  great_work_id UUID REFERENCES great_works(id) ON DELETE CASCADE NOT NULL,
  city_id UUID NOT NULL,
  city_name TEXT NOT NULL,
  vote BOOLEAN NOT NULL,  -- true = yes, false = no
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(great_work_id, city_id)
);

-- Great work contributions: Track what each city has contributed
CREATE TABLE IF NOT EXISTS great_work_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  great_work_id UUID REFERENCES great_works(id) ON DELETE CASCADE NOT NULL,
  city_id UUID NOT NULL,
  city_name TEXT NOT NULL,
  money_amount BIGINT NOT NULL DEFAULT 0,
  materials_amount INTEGER NOT NULL DEFAULT 0,
  workers_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for great works
CREATE INDEX IF NOT EXISTS idx_great_works_region ON great_works(region_id, status);
CREATE INDEX IF NOT EXISTS idx_great_works_status ON great_works(status) WHERE status IN ('voting', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_great_work_votes_work ON great_work_votes(great_work_id);
CREATE INDEX IF NOT EXISTS idx_great_work_contributions_work ON great_work_contributions(great_work_id);
CREATE INDEX IF NOT EXISTS idx_great_work_contributions_city ON great_work_contributions(city_id);

-- RLS for great works
ALTER TABLE great_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE great_work_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE great_work_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read great works" ON great_works FOR SELECT USING (true);
CREATE POLICY "Anyone can create great works" ON great_works FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update great works" ON great_works FOR UPDATE USING (true);

CREATE POLICY "Anyone can read votes" ON great_work_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can vote" ON great_work_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Voter can update vote" ON great_work_votes FOR UPDATE USING (true);

CREATE POLICY "Anyone can read contributions" ON great_work_contributions FOR SELECT USING (true);
CREATE POLICY "Anyone can contribute" ON great_work_contributions FOR INSERT WITH CHECK (true);

-- Enable realtime for great works (run in Supabase dashboard):
-- ALTER PUBLICATION supabase_realtime ADD TABLE great_works;
-- ALTER PUBLICATION supabase_realtime ADD TABLE great_work_votes;
-- ALTER PUBLICATION supabase_realtime ADD TABLE great_work_contributions;

-- ============================================================================
-- RESOURCE SHARING (between adjacent cities in same region)
-- ============================================================================

-- Resource sharing agreements
CREATE TABLE IF NOT EXISTS resource_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_city_id UUID REFERENCES cities(id) ON DELETE CASCADE NOT NULL,
  to_city_id UUID REFERENCES cities(id) ON DELETE CASCADE NOT NULL,
  from_city_name TEXT NOT NULL,
  to_city_name TEXT NOT NULL,
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('power', 'water', 'fire', 'police', 'workers', 'education')),
  quantity INTEGER NOT NULL DEFAULT 0,
  fee_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  active BOOLEAN DEFAULT TRUE,
  auto_share BOOLEAN DEFAULT TRUE, -- If true, automatically shares surplus
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_city_id, to_city_id, resource_type)
);

-- Sharing settings per city (what they're willing to share)
CREATE TABLE IF NOT EXISTS city_sharing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE UNIQUE NOT NULL,
  share_power BOOLEAN DEFAULT TRUE,
  share_water BOOLEAN DEFAULT TRUE,
  share_fire BOOLEAN DEFAULT FALSE,
  share_police BOOLEAN DEFAULT FALSE,
  share_workers BOOLEAN DEFAULT FALSE,
  share_education BOOLEAN DEFAULT FALSE,
  min_power_surplus INTEGER DEFAULT 100,  -- Only share if surplus exceeds this
  min_water_surplus INTEGER DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sharing transaction log (for tracking income/expenses)
CREATE TABLE IF NOT EXISTS sharing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sharing_id UUID REFERENCES resource_sharing(id) ON DELETE CASCADE NOT NULL,
  from_city_id UUID NOT NULL,
  to_city_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount_paid BIGINT NOT NULL, -- Amount paid by receiving city
  fee_earned BIGINT NOT NULL,  -- Fee portion earned by sending city
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for resource sharing
CREATE INDEX IF NOT EXISTS idx_sharing_from_city ON resource_sharing(from_city_id, active);
CREATE INDEX IF NOT EXISTS idx_sharing_to_city ON resource_sharing(to_city_id, active);
CREATE INDEX IF NOT EXISTS idx_sharing_region ON resource_sharing(region_id);
CREATE INDEX IF NOT EXISTS idx_sharing_settings_city ON city_sharing_settings(city_id);
CREATE INDEX IF NOT EXISTS idx_sharing_tx_time ON sharing_transactions(created_at DESC);

-- RLS for resource sharing
ALTER TABLE resource_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_sharing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharing_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sharing" ON resource_sharing FOR SELECT USING (true);
CREATE POLICY "Anyone can create sharing" ON resource_sharing FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sharing" ON resource_sharing FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sharing" ON resource_sharing FOR DELETE USING (true);

CREATE POLICY "Anyone can read sharing settings" ON city_sharing_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can create sharing settings" ON city_sharing_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sharing settings" ON city_sharing_settings FOR UPDATE USING (true);

CREATE POLICY "Anyone can read sharing transactions" ON sharing_transactions FOR SELECT USING (true);
CREATE POLICY "Anyone can create sharing transactions" ON sharing_transactions FOR INSERT WITH CHECK (true);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_resource_sharing_updated_at ON resource_sharing;
CREATE TRIGGER update_resource_sharing_updated_at
  BEFORE UPDATE ON resource_sharing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_city_sharing_settings_updated_at ON city_sharing_settings;
CREATE TRIGGER update_city_sharing_settings_updated_at
  BEFORE UPDATE ON city_sharing_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for resource sharing (run in Supabase dashboard):
-- ALTER PUBLICATION supabase_realtime ADD TABLE resource_sharing;
-- ALTER PUBLICATION supabase_realtime ADD TABLE city_sharing_settings;
