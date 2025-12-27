# Multiplayer Economy System

## What I added

- **Regions**: cities can join regions (up to 9 slots)
- **Regional Treasury**: shared fund for regions
- **Great Works**: collaborative mega-projects funded by the region
- **Resource Sharing**: power/water sharing with neighboring cities
- **Global Market**: buy/sell orders for power, water, workers, materials
- **Chat**: global + region chat

## How to set it up

### 1) Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 2) Database schema

Run `supabase/schema.sql` in your Supabase SQL Editor (creates all required tables and policies).

Core tables:
- `regions`, `cities`
- `regional_treasuries`, `treasury_transactions`
- `great_works`, `great_work_votes`, `great_work_contributions`
- `resource_sharing`, `city_sharing_settings`, `sharing_transactions`
- `market_prices`, `trade_orders`, `trade_history`
- `chat_messages`

### 3) Enable realtime (Supabase)

In Supabase Dashboard → Table Editor → enable realtime for:
- `cities`, `market_prices`, `trade_orders`, `regional_treasuries`, `great_works`, `chat_messages`