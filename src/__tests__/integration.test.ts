// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  DATA_REGISTRY,
  getScenarioData,
  getScenarioById,
  getAllScenarios,
  isPreflop,
  isPostflop,
  type ScenarioData,
} from '@/data/index'
import {
  lookupGTO,
  ALL_169_HANDS,
  type LookupParams,
} from '@/lib/gto/lookup'
import { scoreAction } from '@/lib/gto/scoring'
import metadata from '@/data/metadata.json'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get all 169 preflop hands */
const PREFLOP_HANDS = ALL_169_HANDS

/** Common postflop hand categories found across most scenarios */
const COMMON_POSTFLOP_CATEGORIES = [
  'overpair',
  'topPair_topKicker',
  'topPair_goodKicker',
  'topPair_weakKicker',
  'middlePair',
  'bottomPair',
  'overcards',
  'flushDraw',
  'straightDraw',
  'set',
  'air',
]

function isPreflopScenario(meta: { category: string }): boolean {
  return meta.category === 'preflop'
}

function buildLookupParams(meta: Record<string, unknown>): LookupParams | null {
  const sub = meta.subCategory as string
  const pos = meta.position as string | undefined
  const vp = meta.villainPosition as string | undefined
  const bt = meta.boardTexture as string | undefined

  if (sub === 'rfi' && pos) {
    return { scenarioType: 'rfi', position: pos }
  }
  if (sub === 'threebet' && pos) {
    return { scenarioType: 'threeBet', position: pos, villainPosition: vp! }
  }
  if (sub === 'defend' && pos) {
    return { scenarioType: 'defend', position: pos, villainPosition: vp! }
  }
  if (sub === 'c-bet' && bt) {
    return { scenarioType: 'c-bet', boardTexture: bt, handCategory: '' }
  }
  return null
}

// ---------------------------------------------------------------------------
// Integration: Data Loading
// ---------------------------------------------------------------------------

describe('Integration: All scenario data files load correctly', () => {
  const scenarios = getAllScenarios()

  it('should load all scenarios from metadata into DATA_REGISTRY', () => {
    expect(Object.keys(DATA_REGISTRY).length).toBe(scenarios.length)
  })

  it.each(scenarios.map((s) => [s.id, s]))(
    'should load scenario "%s" with valid data',
    (id: string, scenario: Record<string, unknown>) => {
      const data = getScenarioById(id as string)
      expect(data).not.toBeNull()

      if (isPreflopScenario(scenario)) {
        expect(isPreflop(data!)).toBe(true)
        const pf = data as unknown as { hands: Record<string, unknown>; position?: string; heroPosition?: string }
        expect(Object.keys(pf.hands).length).toBe(169)
        // rfi uses 'position', threebet/defend use 'heroPosition'
        expect(pf.position ?? pf.heroPosition).toBeDefined()
      } else {
        expect(isPostflop(data!)).toBe(true)
        const pof = data as unknown as { strategy: Record<string, unknown>; exampleBoard: string[] }
        expect(Object.keys(pof.strategy).length).toBeGreaterThan(0)
        expect(pof.exampleBoard.length).toBeGreaterThanOrEqual(3)
      }
    },
  )
})

// ---------------------------------------------------------------------------
// Integration: GTO Lookup returns valid results for every scenario
// ---------------------------------------------------------------------------

describe('Integration: GTO lookup returns valid results for every preflop scenario', () => {
  const scenarios = getAllScenarios().filter(isPreflopScenario)

  it.each(scenarios.map((s) => [s.id, s]))(
    'should return valid results for all 169 hands in "%s"',
    (id: string, scenario: Record<string, unknown>) => {
      const params = buildLookupParams(scenario)
      expect(params).not.toBeNull()

      for (const hand of PREFLOP_HANDS) {
        const result = lookupGTO(params!, hand)

        // Result should always have these fields
        expect(result.hand).toBeTruthy()
        expect(result.frequencies).toBeDefined()
        expect(Object.keys(result.frequencies).length).toBeGreaterThan(0)
        expect(result.bestAction).toBeTruthy()
        expect(result.bestActionFrequency).toBeGreaterThan(0)
        expect(result.bestActionFrequency).toBeLessThanOrEqual(1.01)

        // Frequencies should sum to ~1
        const total = Object.values(result.frequencies).reduce(
          (a, b) => a + b,
          0,
        )
        expect(total).toBeGreaterThanOrEqual(0.99)
        expect(total).toBeLessThanOrEqual(1.01)

        // Best action should be one of the keys in frequencies
        expect(result.frequencies).toHaveProperty(result.bestAction)
      }
    },
  )
})

describe('Integration: GTO lookup returns valid results for every postflop scenario', () => {
  const scenarios = getAllScenarios().filter((s) => !isPreflopScenario(s))

  it.each(scenarios.map((s) => [s.id, s]))(
    'should return valid results for common categories in "%s"',
    (id: string, scenario: Record<string, unknown>) => {
      const params = buildLookupParams(scenario)
      if (!params) return // Skip if we can't build params

      const data = getScenarioById(id as string)
      if (!data || !isPostflop(data)) return
      const strategyKeys = Object.keys(
        (data as unknown as { strategy: Record<string, unknown> }).strategy,
      )

      // Test the categories that actually exist in this scenario
      for (const category of strategyKeys) {
        const lookupParams = { ...params, handCategory: category }
        const result = lookupGTO(lookupParams, category)

        expect(result.found).toBe(true)
        expect(result.bestAction).toBeTruthy()
        expect(result.bestActionFrequency).toBeGreaterThan(0)

        const total = Object.values(result.frequencies).reduce(
          (a, b) => a + b,
          0,
        )
        expect(total).toBeGreaterThanOrEqual(0.99)
        expect(total).toBeLessThanOrEqual(1.01)
      }
    },
  )
})

// ---------------------------------------------------------------------------
// Integration: Scoring returns values between 0 and 100
// ---------------------------------------------------------------------------

describe('Integration: Scoring function returns values between 0 and 100', () => {
  const VALID_ACTIONS = [
    'raise',
    'fold',
    'call',
    'threeBet',
    'check',
    'bet_33pct',
    'bet_75pct',
    'bet_50pct',
    'bet_66pct',
    'bet_100pct',
  ]

  const scenarios = getAllScenarios().filter(isPreflopScenario)

  it.each(scenarios.map((s) => [s.id, s]))(
    'should score between 0 and 100 for every hand in "%s"',
    (id: string, scenario: Record<string, unknown>) => {
      const params = buildLookupParams(scenario)
      if (!params) return

      for (const hand of PREFLOP_HANDS) {
        const gtoResult = lookupGTO(params, hand)

        // Score each valid action
        for (const action of VALID_ACTIONS) {
          const result = scoreAction(action, gtoResult.frequencies)
          expect(
            result.score,
            `Score for ${hand} -> ${action} in ${id} should be >= 0`,
          ).toBeGreaterThanOrEqual(0)
          expect(
            result.score,
            `Score for ${hand} -> ${action} in ${id} should be <= 100`,
          ).toBeLessThanOrEqual(100)
          expect(typeof result.isCorrect).toBe('boolean')
          expect(result.bestAction).toBeTruthy()
          expect(result.userActionFrequency).toBeGreaterThanOrEqual(0)
          expect(result.userActionFrequency).toBeLessThanOrEqual(1.01)
        }
      }
    },
  )

  it('should score 100 when user picks the best action from a real scenario', () => {
    const result = lookupGTO(
      { scenarioType: 'rfi', position: 'UTG' },
      'AA',
    )
    expect(result.found).toBe(true)
    const score = scoreAction(result.bestAction, result.frequencies)
    expect(score.score).toBe(100)
    expect(score.isCorrect).toBe(true)
  })

  it('should score 0 when user picks an action with zero frequency', () => {
    const result = lookupGTO(
      { scenarioType: 'rfi', position: 'UTG' },
      'AA', // AA is always raise 100%
    )
    const score = scoreAction('fold', result.frequencies)
    expect(score.score).toBe(0)
    expect(score.isCorrect).toBe(false)
  })
})
