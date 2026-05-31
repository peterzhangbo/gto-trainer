-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- profiles: users can read and update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow the trigger/function to insert a profile during signup
CREATE POLICY "Allow insert on signup"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- training_sessions: users can CRUD their own sessions
CREATE POLICY "Users can view own training sessions"
  ON training_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training sessions"
  ON training_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training sessions"
  ON training_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own training sessions"
  ON training_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- drill_results: users can CRUD their own drill results
CREATE POLICY "Users can view own drill results"
  ON drill_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drill results"
  ON drill_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drill results"
  ON drill_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drill results"
  ON drill_results FOR DELETE
  USING (auth.uid() = user_id);

-- user_stats: users can read and update their own stats
CREATE POLICY "Users can view own stats"
  ON user_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats"
  ON user_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
  ON user_stats FOR UPDATE
  USING (auth.uid() = user_id);
