# Supabase Setup for Multiplayer

IsoCity uses [Supabase](https://supabase.com) for multiplayer functionality, enabling real-time co-op city building with persistent room state.

## Why Supabase?

The multiplayer feature allows players to:
- Create shared city-building rooms with unique room codes
- Join existing rooms and build together in real-time
- Persist game state in a database for session continuity
- Sync actions between players using Supabase Realtime

## Prerequisites

- A free Supabase account (sign up at [supabase.com](https://supabase.com))
- Node.js v18+ installed
- A Vercel account (for deployment)

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/sign in
2. Click **New Project**
3. Fill in project details:
   - **Name**: Choose any name (e.g., "isocity-multiplayer")
   - **Database Password**: Generate a strong password (save it somewhere safe)
   - **Region**: Choose the region closest to your users
4. Click **Create new project** and wait ~2 minutes for provisioning

### 2. Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy and paste this schema:

```sql
-- Create the game_rooms table
CREATE TABLE game_rooms (
  room_code TEXT PRIMARY KEY,
  city_name TEXT NOT NULL,
  game_state TEXT NOT NULL,  -- Compressed game state (LZ-string)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  player_count INTEGER DEFAULT 1
);

-- Enable Row Level Security
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write (for anonymous multiplayer)
CREATE POLICY "Allow public access" ON game_rooms
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER game_rooms_updated_at
  BEFORE UPDATE ON game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see **Success. No rows returned**

### 3. Get Your API Credentials

1. In Supabase dashboard, go to **Project Settings** (gear icon in left sidebar)
2. Click **API** in the settings menu
3. Copy these two values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (under "Project API keys" section)

### 4. Configure Environment Variables

#### For Local Development:

1. In your project root, create a `.env.local` file:
   ```bash
   cp .env.example .env.local
   ```

2. Add your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
   ```

3. Restart your dev server:
   ```bash
   npm run dev
   ```

#### For Vercel Deployment:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add two variables:
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
     **Value**: Your Supabase project URL
   - **Name**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     **Value**: Your Supabase anon/public key
4. Click **Save**
5. Redeploy your project (Vercel will auto-redeploy when env vars change)

## Verification

Once configured, you should be able to:
1. Click the **Co-op** button in the game
2. Create a new room (generates a 5-character code)
3. Share the room code or link with friends
4. Build cities together in real-time!

If Supabase is not configured, you'll see a helpful message explaining how to set it up.

## Database Schema Details

### Table: `game_rooms`

| Column        | Type      | Description                              |
|---------------|-----------|------------------------------------------|
| room_code     | TEXT      | Primary key, 5-character unique room ID |
| city_name     | TEXT      | Name of the shared city                  |
| game_state    | TEXT      | Compressed game state (LZ-string format) |
| created_at    | TIMESTAMP | Room creation timestamp                  |
| updated_at    | TIMESTAMP | Last update timestamp (auto-updated)     |
| player_count  | INTEGER   | Number of active players                 |

### Security

- **Row Level Security (RLS)** is enabled
- Public access policy allows anonymous multiplayer (no auth required)
- All game state is compressed using LZ-string before storage

## Troubleshooting

### "supabaseUrl is required" Error

- Make sure environment variables are set correctly
- Variable names must start with `NEXT_PUBLIC_` (they're used in the browser)
- Restart your dev server after adding `.env.local`
- On Vercel, redeploy after adding environment variables

### Room Creation Fails

- Check that the database schema was created successfully
- Verify the RLS policy allows public access
- Check browser console for detailed error messages

### Players Can't Join Room

- Ensure both players are using the same deployment (same Supabase instance)
- Check that the room code was entered correctly (case-insensitive, 5 characters)
- Verify the room exists in your Supabase dashboard (Table Editor → game_rooms)

## Optional: Monitoring

You can monitor multiplayer activity in your Supabase dashboard:
1. Go to **Table Editor** → **game_rooms**
2. View active rooms, player counts, and creation times
3. Use **Logs** to debug any database issues

## Cost

Supabase free tier includes:
- 500MB database space
- 1GB file storage
- 2GB bandwidth
- 50,000 monthly active users

This is more than enough for casual multiplayer usage. Rooms can be cleaned up periodically by deleting old entries from the `game_rooms` table.
