// ---------------------------------------------------------------------------
// Scoring module – evaluate user actions against GTO frequencies
// ---------------------------------------------------------------------------
// Types are defined inline to avoid circular dependencies with @/types/*

export interface GTOFrequencies {
  [action: string]: number;
}

export interface ActionScore {
  /** Numeric score from 0 to 100 */
  score: number;
  /** Whether the user chose the highest-frequency action */
  isCorrect: boolean;
  /** The GTO-preferred (highest frequency) action */
  bestAction: string;
  /** Full frequency breakdown for all actions */
  allFrequencies: GTOFrequencies;
  /** The frequency of the action the user actually took */
  userActionFrequency: number;
}

export interface DrillResult {
  /** Identifier for the scenario */
  scenarioId: string;
  /** Hand code (preflop) or category (postflop) */
  hand: string;
  /** Action the user chose */
  userAction: string;
  /** The GTO frequencies for the hand */
  gtoFrequencies: GTOFrequencies;
  /** The score returned by scoreAction for this hand */
  score: number;
  /** Whether the user chose the best action */
  isCorrect: boolean;
}

export interface SessionScore {
  /** Percentage of hands where user chose the best action (0-100) */
  accuracy: number;
  /** Average score across all hands (0-100) */
  avgScore: number;
  /** Total number of hands in the session */
  totalHands: number;
  /** Total hands scored as "correct" (best action chosen) */
  correctHands: number;
  /** Breakdown by action type */
  actionBreakdown: Record<string, { count: number; avgScore: number }>;
}

// ---------------------------------------------------------------------------
// Core scoring
// ---------------------------------------------------------------------------

/**
 * Score a user's chosen action against the GTO strategy for a hand.
 *
 * Frequency deviation scoring:
 *   - The score IS the GTO frequency of the chosen action × 100
 *   - E.g. GTO says { raise: 0.55, call: 0.25, fold: 0.20 }
 *     - pick "raise" → score 55 (primary action)
 *     - pick "call" → score 25 (valid secondary)
 *     - pick "fold" → score 20 (low-frequency but valid)
 *     - pick nonexistent action → score 0 (error)
 *
 * The `isCorrect` flag is true only when the user's action is exactly
 * the highest-frequency action.
 *
 * @param userAction   - The action the user chose (e.g. "raise", "fold", "bet_75pct")
 * @param gtoStrategy  - Frequency map from the GTO data (e.g. { raise: 0.8, fold: 0.2 })
 */
export function scoreAction(
  userAction: string,
  gtoStrategy: GTOFrequencies,
): ActionScore {
  const normalisedAction = normalise(userAction);
  const normalisedStrategy: GTOFrequencies = {};
  for (const [k, v] of Object.entries(gtoStrategy)) {
    normalisedStrategy[normalise(k)] = v;
  }

  // Find best action
  let bestAction = '';
  let bestFrequency = 0;
  for (const [action, freq] of Object.entries(normalisedStrategy)) {
    if (freq > bestFrequency) {
      bestFrequency = freq;
      bestAction = action;
    }
  }

  // If strategy is empty / all zeros, everything is "check"/"fold" 100%
  if (bestFrequency === 0) {
    return {
      score: 0,
      isCorrect: false,
      bestAction: 'fold',
      allFrequencies: gtoStrategy,
      userActionFrequency: 0,
    };
  }

  const userFrequency = normalisedStrategy[normalisedAction] ?? 0;
  const isCorrect = normalisedAction === bestAction;

  // Frequency deviation scoring:
  //   - Best action → 100
  //   - Other actions → (freq / best_freq) × 100
  const score = normalisedAction === bestAction
    ? 100
    : bestFrequency > 0
      ? Math.round((userFrequency / bestFrequency) * 100)
      : 0;

  return {
    score,
    isCorrect,
    bestAction,
    allFrequencies: gtoStrategy,
    userActionFrequency: userFrequency,
  };
}

// ---------------------------------------------------------------------------
// Session scoring
// ---------------------------------------------------------------------------

/**
 * Score an entire drill session.
 *
 * Each `DrillResult` should already contain the score computed via `scoreAction`.
 * This function aggregates them into an overall session score.
 */
export function scoreSession(results: DrillResult[]): SessionScore {
  if (results.length === 0) {
    return {
      accuracy: 0,
      avgScore: 0,
      totalHands: 0,
      correctHands: 0,
      actionBreakdown: {},
    };
  }

  let totalScore = 0;
  let correctHands = 0;
  const breakdown: Record<string, { scores: number[]; count: number }> = {};

  for (const r of results) {
    totalScore += r.score;
    if (r.isCorrect) correctHands++;

    const key = r.userAction;
    if (!breakdown[key]) {
      breakdown[key] = { scores: [], count: 0 };
    }
    breakdown[key].scores.push(r.score);
    breakdown[key].count++;
  }

  const accuracy = (correctHands / results.length) * 100;
  const avgScore = totalScore / results.length;

  const actionBreakdown: Record<string, { count: number; avgScore: number }> =
    {};
  for (const [action, data] of Object.entries(breakdown)) {
    actionBreakdown[action] = {
      count: data.count,
      avgScore:
        data.scores.length > 0
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
          : 0,
    };
  }

  return {
    accuracy: Math.round(accuracy * 100) / 100,
    avgScore: Math.round(avgScore * 100) / 100,
    totalHands: results.length,
    correctHands,
    actionBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function normalise(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '_').trim();
}
