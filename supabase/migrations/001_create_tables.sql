-- Profiles table (auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training sessions
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scenario_type TEXT NOT NULL,
  scenario_params JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_hands INTEGER DEFAULT 0,
  correct_hands INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2)
);

-- Individual drill results
CREATE TABLE IF NOT EXISTS drill_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hand TEXT NOT NULL,
  position TEXT,
  board_cards TEXT[],
  scenario_type TEXT NOT NULL,
  gto_action TEXT NOT NULL,
  gto_frequencies JSONB NOT NULL,
  user_action TEXT NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User stats (pre-aggregated)
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_drills INTEGER DEFAULT 0,
  overall_accuracy DECIMAL(5,2),
  preflop_accuracy DECIMAL(5,2),
  postflop_accuracy DECIMAL(5,2),
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_practice_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
