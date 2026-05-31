import {
  getScenarioData,
  isPreflop,
  isPostflop,
} from '@/data/index';

import type {
  HandFrequencies,
  PreflopScenarioData,
  PostflopScenarioData,
  PostflopStrategyEntry,
} from '@/data/index';

// ---------------------------------------------------------------------------
// Types exported from this module
// ---------------------------------------------------------------------------

export interface GTOLookupResult {
  found: boolean;
  hand: string;
  frequencies: Record<string, number>;
  bestAction: string;
  bestActionFrequency: number;
  scenarioKey: string;
}

export interface PreflopLookupParams {
  scenarioType: 'rfi' | 'threeBet' | 'defend';
  position: string;
  villainPosition?: string;
}

export interface PostflopLookupParams {
  scenarioType: 'c-bet';
  boardTexture: string;
  handCategory: string;
}

export type LookupParams = PreflopLookupParams | PostflopLookupParams;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_169_HANDS: string[] = (() => {
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const hands: string[] = [];
  for (let i = 0; i < ranks.length; i++) {
    for (let j = 0; j < ranks.length; j++) {
      if (i === j) {
        hands.push(ranks[i] + ranks[j]);
      } else if (i < j) {
        hands.push(ranks[i] + ranks[j] + 's');
      } else {
        hands.push(ranks[j] + ranks[i] + 'o');
      }
    }
  }
  return hands;
})();

/** Canonical set of all 169 hand codes */
export { ALL_169_HANDS };

// ---------------------------------------------------------------------------
// Key building
// ---------------------------------------------------------------------------

/**
 * Build a deterministic lookup key from scenario parameters.
 *
 * Preflop:  "preflop:rfi:UTG"
 * Preflop 3bet: "preflop:threeBet:BTN:CO"
 * Preflop defend: "preflop:defend:BB:BTN"
 * Postflop: "postflop:c-bet:dry-high:overpair"
 */
export function buildLookupKey(params: LookupParams): string {
  if (params.scenarioType === 'c-bet') {
    const p = params as PostflopLookupParams;
    return `postflop:${p.scenarioType}:${p.boardTexture}:${p.handCategory}`;
  }

  const p = params as PreflopLookupParams;
  const parts = ['preflop', p.scenarioType, p.position];
  if (p.villainPosition) parts.push(p.villainPosition);
  return parts.join(':');
}

// ---------------------------------------------------------------------------
// Core lookup
// ---------------------------------------------------------------------------

/**
 * Look up the GTO strategy for a specific hand in a preflop scenario.
 *
 * Returns default fold 100% when the hand is not found in the data.
 */
function lookupPreflop(
  data: PreflopScenarioData,
  hand: string,
  scenarioKey: string,
): GTOLookupResult {
  const normalised = normaliseHand(hand);
  const entry: HandFrequencies = data.hands[normalised] ?? { fold: 1.0 };

  const frequencies: Record<string, number> = {};
  for (const [action, freq] of Object.entries(entry)) {
    if (typeof freq === 'number' && freq > 0) {
      frequencies[action] = freq;
    }
  }

  const bestAction = getBestAction(frequencies);

  return {
    found: !!data.hands[normalised],
    hand: normalised,
    frequencies,
    bestAction: bestAction.action,
    bestActionFrequency: bestAction.frequency,
    scenarioKey,
  };
}

/**
 * Look up the GTO strategy for a hand category in a postflop scenario.
 *
 * Returns default check 100% when the category is not found.
 */
function lookupPostflop(
  data: PostflopScenarioData,
  handCategory: string,
  scenarioKey: string,
): GTOLookupResult {
  const entry: PostflopStrategyEntry =
    data.strategy[handCategory] ?? { check: 1.0 };

  const frequencies: Record<string, number> = {};
  for (const [action, freq] of Object.entries(entry)) {
    if (typeof freq === 'number' && freq > 0) {
      frequencies[action] = freq;
    }
  }

  const bestAction = getBestAction(frequencies);

  return {
    found: !!data.strategy[handCategory],
    hand: handCategory,
    frequencies,
    bestAction: bestAction.action,
    bestActionFrequency: bestAction.frequency,
    scenarioKey,
  };
}

/**
 * Universal GTO lookup.
 *
 * For preflop scenarios pass `hand` as a 2-3 char poker hand code (e.g. "AKs", "TT", "JTo").
 * For postflop scenarios pass `hand` as a hand category string (e.g. "overpair", "flushDraw").
 *
 * Returns a `GTOLookupResult` with frequencies; if the hand/category is
 * absent from the data the result defaults to fold / check 100%.
 */
export function lookupGTO(
  params: LookupParams,
  hand: string,
): GTOLookupResult {
  const data = getScenarioData({
    scenarioType: params.scenarioType,
    position: 'position' in params ? (params as PreflopLookupParams).position : undefined,
    villainPosition:
      'villainPosition' in params ? (params as PreflopLookupParams).villainPosition : undefined,
    boardTexture:
      'boardTexture' in params ? (params as PostflopLookupParams).boardTexture : undefined,
  });

  if (!data) {
    // No data at all – return full fold/check
    const defaultAction = params.scenarioType === 'c-bet' ? 'check' : 'fold';
    return {
      found: false,
      hand,
      frequencies: { [defaultAction]: 1.0 },
      bestAction: defaultAction,
      bestActionFrequency: 1.0,
      scenarioKey: buildLookupKey(params),
    };
  }

  if (isPreflop(data)) {
    return lookupPreflop(data, hand, buildLookupKey(params));
  }

  if (isPostflop(data)) {
    return lookupPostflop(data, hand, buildLookupKey(params));
  }

  // Shouldn't reach here but safe fallback
  return {
    found: false,
    hand,
    frequencies: { fold: 1.0 },
    bestAction: 'fold',
    bestActionFrequency: 1.0,
    scenarioKey: buildLookupKey(params),
  };
}

// ---------------------------------------------------------------------------
// Utility: get all hands with their best actions for a scenario
// ---------------------------------------------------------------------------

export interface ScenarioHandSummary {
  hand: string;
  bestAction: string;
  bestActionFrequency: number;
  inRange: boolean;
}

/**
 * Return a summary of every 169 hand for a given preflop scenario,
 * showing the best action and whether the hand is "in range" (best action is not fold).
 */
export function getPreflopScenarioSummary(
  position: string,
  scenarioType: 'rfi' | 'threeBet' | 'defend' = 'rfi',
  villainPosition?: string,
): ScenarioHandSummary[] | null {
  const data = getScenarioData({ scenarioType, position, villainPosition });
  if (!data || !isPreflop(data)) return null;

  return ALL_169_HANDS.map((hand) => {
    const entry = data.hands[hand] ?? { fold: 1.0 };
    const frequencies: Record<string, number> = {};
    for (const [action, freq] of Object.entries(entry)) {
      if (typeof freq === 'number' && freq > 0) {
        frequencies[action] = freq;
      }
    }
    const best = getBestAction(frequencies);
    return {
      hand,
      bestAction: best.action,
      bestActionFrequency: best.frequency,
      inRange: best.action !== 'fold',
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

function normaliseHand(hand: string): string {
  // Uppercase and trim; input like "aks", "jTo", "tt" -> "AKs", "JTo", "TT"
  return hand.toUpperCase().trim();
}

function getBestAction(frequencies: Record<string, number>): {
  action: string;
  frequency: number;
} {
  let bestAction = 'fold';
  let bestFrequency = 0;

  for (const [action, freq] of Object.entries(frequencies)) {
    if (freq > bestFrequency) {
      bestFrequency = freq;
      bestAction = action;
    }
  }

  // If nothing found, default to fold
  if (bestFrequency === 0) {
    return { action: 'fold', frequency: 1.0 };
  }

  return { action: bestAction, frequency: bestFrequency };
}
