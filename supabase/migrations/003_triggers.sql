-- Function: create a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire handle_new_user after a new row in auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function: upsert user_stats after a new drill_result is inserted
CREATE OR REPLACE FUNCTION update_user_stats_on_drill()
RETURNS TRIGGER AS $$
DECLARE
  v_total        INTEGER;
  v_correct      INTEGER;
  v_overall      DECIMAL(5,2);
  v_preflop_cnt  INTEGER;
  v_preflop_corr INTEGER;
  v_preflop_acc  DECIMAL(5,2);
  v_postflop_cnt INTEGER;
  v_postflop_corr INTEGER;
  v_postflop_acc DECIMAL(5,2);
  v_streak       INTEGER;
  v_longest      INTEGER;
BEGIN
  -- Aggregate counts from drill_results for this user
  SELECT COUNT(*), SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)
    INTO v_total, v_correct
    FROM drill_results
   WHERE user_id = NEW.user_id;

  v_overall := CASE WHEN v_total > 0 THEN (v_correct::DECIMAL / v_total) * 100 ELSE 0 END;

  -- Preflop accuracy (scenario_type in preflop categories)
  SELECT COUNT(*), SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)
    INTO v_preflop_cnt, v_preflop_corr
    FROM drill_results
   WHERE user_id = NEW.user_id
     AND scenario_type IN ('rfi', '3bet', 'call3bet');

  v_preflop_acc := CASE WHEN v_preflop_cnt > 0 THEN (v_preflop_corr::DECIMAL / v_preflop_cnt) * 100 ELSE NULL END;

  -- Postflop accuracy (scenario_type in postflop categories)
  SELECT COUNT(*), SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)
    INTO v_postflop_cnt, v_postflop_corr
    FROM drill_results
   WHERE user_id = NEW.user_id
     AND scenario_type IN ('cbet', 'vs_cbet');

  v_postflop_acc := CASE WHEN v_postflop_cnt > 0 THEN (v_postflop_corr::DECIMAL / v_postflop_cnt) * 100 ELSE NULL END;

  -- Current streak: count consecutive correct drills from the most recent
  WITH ranked AS (
    SELECT is_correct,
           ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
      FROM drill_results
     WHERE user_id = NEW.user_id
  )
  SELECT COUNT(*) INTO v_streak
    FROM ranked
   WHERE rn <= (SELECT MIN(rn) FROM ranked WHERE NOT is_correct) - 1
      OR NOT EXISTS (SELECT 1 FROM ranked WHERE NOT is_correct);

  -- Longest streak ever
  WITH ordered AS (
    SELECT is_correct,
           ROW_NUMBER() OVER (ORDER BY created_at) AS rn
      FROM drill_results
     WHERE user_id = NEW.user_id
  ),
  groups AS (
    SELECT is_correct,
           rn - ROW_NUMBER() OVER (PARTITION BY is_correct ORDER BY rn) AS grp
      FROM ordered
  )
  SELECT COALESCE(MAX(cnt), 0) INTO v_longest
    FROM (
      SELECT COUNT(*) AS cnt
        FROM groups
       WHERE is_correct
       GROUP BY grp
    ) sub;

  -- Upsert user_stats
  INSERT INTO user_stats (
    user_id, total_drills, overall_accuracy,
    preflop_accuracy, postflop_accuracy,
    current_streak, longest_streak,
    last_practice_at, updated_at
  ) VALUES (
    NEW.user_id, v_total, v_overall,
    v_preflop_acc, v_postflop_acc,
    v_streak, v_longest,
    NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_drills     = EXCLUDED.total_drills,
    overall_accuracy = EXCLUDED.overall_accuracy,
    preflop_accuracy = EXCLUDED.preflop_accuracy,
    postflop_accuracy = EXCLUDED.postflop_accuracy,
    current_streak   = EXCLUDED.current_streak,
    longest_streak   = EXCLUDED.longest_streak,
    last_practice_at = EXCLUDED.last_practice_at,
    updated_at       = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire after a drill_result is inserted
CREATE OR REPLACE TRIGGER on_drill_result_inserted
  AFTER INSERT ON drill_results
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_on_drill();
