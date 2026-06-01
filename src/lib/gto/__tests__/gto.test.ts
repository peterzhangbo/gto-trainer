// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  lookupGTO,
  buildLookupKey,
  ALL_169_HANDS,
  getPreflopScenarioSummary,
} from '../lookup'
import { scoreAction, scoreSession } from '../scoring'
import {
  calculateEV,
  calculatePotOdds,
  isProfitableCall,
  calculateBreakEvenEquity,
} from '../ev-calc'

describe('lookup.ts', () => {
  describe('ALL_169_HANDS', () => {
    it('should contain exactly 169 hands', () => {
      expect(ALL_169_HANDS).toHaveLength(169)
    })

    it('should contain pocket pairs like AA, KK, QQ', () => {
      expect(ALL_169_HANDS).toContain('AA')
      expect(ALL_169_HANDS).toContain('KK')
      expect(ALL_169_HANDS).toContain('22')
    })

    it('should contain suited and offsuit combos like AKs, AKo', () => {
      expect(ALL_169_HANDS).toContain('AKs')
      expect(ALL_169_HANDS).toContain('AKo')
    })
  })

  describe('buildLookupKey', () => {
    it('should build RFI key as preflop:rfi:POSITION', () => {
      expect(buildLookupKey({ scenarioType: 'rfi', position: 'UTG' })).toBe(
        'preflop:rfi:UTG',
      )
    })

    it('should build three-bet key with villain position', () => {
      expect(
        buildLookupKey({
          scenarioType: 'threeBet',
          position: 'BTN',
          villainPosition: 'CO',
        }),
      ).toBe('preflop:threeBet:BTN:CO')
    })

    it('should build defend key', () => {
      expect(
        buildLookupKey({
          scenarioType: 'defend',
          position: 'BB',
          villainPosition: 'BTN',
        }),
      ).toBe('preflop:defend:BB:BTN')
    })

    it('should build postflop c-bet key', () => {
      expect(
        buildLookupKey({
          scenarioType: 'c-bet',
          boardTexture: 'dry-high',
          handCategory: 'overpair',
        }),
      ).toBe('postflop:c-bet:dry-high:overpair')
    })
  })

  describe('lookupGTO (preflop)', () => {
    it('should find AA in UTG RFI with raise 100%', () => {
      const result = lookupGTO(
        { scenarioType: 'rfi', position: 'UTG' },
        'AA',
      )
      expect(result.found).toBe(true)
      expect(result.hand).toBe('AA')
      expect(result.bestAction).toBe('raise')
      expect(result.bestActionFrequency).toBe(1.0)
      expect(result.frequencies.raise).toBe(1.0)
    })

    it('should find 72o in UTG RFI with fold 100%', () => {
      const result = lookupGTO(
        { scenarioType: 'rfi', position: 'UTG' },
        '72o',
      )
      expect(result.found).toBe(true)
      expect(result.hand).toBe('72o')
      expect(result.bestAction).toBe('fold')
      expect(result.bestActionFrequency).toBe(1.0)
    })

    it('should normalize lowercase hand input', () => {
      const result = lookupGTO(
        { scenarioType: 'rfi', position: 'UTG' },
        'aks',
      )
      expect(result.found).toBe(true)
      expect(result.hand).toBe('AKs')
    })

    it('should return found=false and fold 100% for non-existent scenario', () => {
      const result = lookupGTO(
        { scenarioType: 'rfi', position: 'XX' as string },
        'AA',
      )
      expect(result.found).toBe(false)
      expect(result.bestAction).toBe('fold')
      expect(result.bestActionFrequency).toBe(1.0)
    })

    it('should find a mixed-strategy hand in BTN RFI (T5s)', () => {
      // T5s is typically a fold or marginal hand; check it returns valid data
      const result = lookupGTO(
        { scenarioType: 'rfi', position: 'BTN' },
        'T5s',
      )
      expect(result.found).toBe(true)
      // Frequencies should sum to 1
      const total = Object.values(result.frequencies).reduce(
        (a, b) => a + b,
        0,
      )
      expect(total).toBeCloseTo(1.0, 5)
    })
  })

  describe('lookupGTO (postflop)', () => {
    it('should find overpair strategy on dry-high board', () => {
      const result = lookupGTO(
        {
          scenarioType: 'c-bet',
          boardTexture: 'dry-high',
          handCategory: 'overpair',
        },
        'overpair',
      )
      expect(result.found).toBe(true)
      expect(result.hand).toBe('overpair')
      expect(result.bestAction).toBe('bet_33pct') // 45% > 40% > 15%
      expect(result.bestActionFrequency).toBe(0.45)
      expect(result.frequencies.bet_33pct).toBe(0.45)
      expect(result.frequencies.bet_75pct).toBe(0.4)
      expect(result.frequencies.check).toBe(0.15)
    })

    it('should return check 100% for non-existent hand category', () => {
      const result = lookupGTO(
        {
          scenarioType: 'c-bet',
          boardTexture: 'dry-high',
          handCategory: 'nonExistent',
        },
        'nonExistent',
      )
      expect(result.found).toBe(false)
      expect(result.bestAction).toBe('check')
      expect(result.bestActionFrequency).toBe(1.0)
    })
  })

  describe('getPreflopScenarioSummary', () => {
    it('should return 169 hands for UTG RFI', () => {
      const summary = getPreflopScenarioSummary('UTG', 'rfi')
      expect(summary).not.toBeNull()
      expect(summary).toHaveLength(169)
    })

    it('should mark AA as in-range for UTG RFI', () => {
      const summary = getPreflopScenarioSummary('UTG', 'rfi')
      const aa = summary!.find((h) => h.hand === 'AA')
      expect(aa).toBeDefined()
      expect(aa!.inRange).toBe(true)
      expect(aa!.bestAction).toBe('raise')
    })

    it('should mark 72o as out-of-range for UTG RFI', () => {
      const summary = getPreflopScenarioSummary('UTG', 'rfi')
      const hand = summary!.find((h) => h.hand === '72o')
      expect(hand).toBeDefined()
      expect(hand!.inRange).toBe(false)
      expect(hand!.bestAction).toBe('fold')
    })

    it('should return null for non-existent position', () => {
      const summary = getPreflopScenarioSummary('XX' as string, 'rfi')
      expect(summary).toBeNull()
    })
  })
})

describe('scoring.ts', () => {
  describe('scoreAction', () => {
    it('should score 100 for the best action', () => {
      const result = scoreAction('raise', { raise: 0.8, fold: 0.2 })
      expect(result.score).toBe(100)
      expect(result.isCorrect).toBe(true)
      expect(result.bestAction).toBe('raise')
      expect(result.userActionFrequency).toBe(0.8)
    })

    it('should score proportionally for a non-best but valid action', () => {
      // fold has 0.2 freq, raise has 0.8 → (0.2/0.8)*100 = 25
      const result = scoreAction('fold', { raise: 0.8, fold: 0.2 })
      expect(result.score).toBe(25)
      expect(result.isCorrect).toBe(false)
      expect(result.bestAction).toBe('raise')
      expect(result.userActionFrequency).toBe(0.2)
    })

    it('should score 0 for a zero-frequency action', () => {
      const result = scoreAction('call', { raise: 0.6, fold: 0.4 })
      expect(result.score).toBe(0)
      expect(result.isCorrect).toBe(false)
      expect(result.userActionFrequency).toBe(0)
    })

    it('should be case insensitive', () => {
      const result = scoreAction('RAISE', { raise: 1.0 })
      expect(result.score).toBe(100)
      expect(result.isCorrect).toBe(true)
    })

    it('should handle underscore/space normalization', () => {
      const result = scoreAction('bet_75pct', {
        bet_75pct: 0.6,
        check: 0.4,
      })
      expect(result.score).toBe(100)
      expect(result.isCorrect).toBe(true)
    })

    it('should score 0 when strategy is empty', () => {
      const result = scoreAction('raise', {})
      expect(result.score).toBe(0)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('scoreSession', () => {
    it('should aggregate scores correctly', () => {
      const results = [
        {
          scenarioId: 'test',
          hand: 'AA',
          userAction: 'raise',
          gtoFrequencies: { raise: 1.0 },
          score: 100,
          isCorrect: true,
        },
        {
          scenarioId: 'test',
          hand: '72o',
          userAction: 'fold',
          gtoFrequencies: { fold: 1.0 },
          score: 100,
          isCorrect: true,
        },
        {
          scenarioId: 'test',
          hand: 'KQs',
          userAction: 'call',
          gtoFrequencies: { raise: 0.7, call: 0.3 },
          score: 43,
          isCorrect: false,
        },
      ]
      const session = scoreSession(results)
      expect(session.totalHands).toBe(3)
      expect(session.correctHands).toBe(2)
      expect(session.accuracy).toBeCloseTo(66.67, 1)
      expect(session.avgScore).toBeCloseTo(81.0, 1)
      expect(session.actionBreakdown.raise.count).toBe(1)
      expect(session.actionBreakdown.fold.count).toBe(1)
      expect(session.actionBreakdown.call.count).toBe(1)
    })

    it('should return zeros for empty session', () => {
      const session = scoreSession([])
      expect(session.totalHands).toBe(0)
      expect(session.accuracy).toBe(0)
      expect(session.avgScore).toBe(0)
      expect(session.correctHands).toBe(0)
    })
  })
})

describe('ev-calc.ts', () => {
  describe('calculateEV', () => {
    it('should return positive EV when equity is high enough', () => {
      // 50% equity, pot 100, bet to call 50
      // EV = 0.5*(100+50) - 0.5*50 = 75 - 25 = 50
      expect(calculateEV(100, 50, 0.5)).toBe(50)
    })

    it('should return negative EV when equity is too low', () => {
      // 20% equity, pot 100, bet to call 50
      // EV = 0.2*(100+50) - 0.8*50 = 30 - 40 = -10
      expect(calculateEV(100, 50, 0.2)).toBe(-10)
    })

    it('should return 0 when betToCall is 0', () => {
      expect(calculateEV(100, 0, 0.5)).toBe(0)
    })

    it('should round to 2 decimal places', () => {
      // 33% equity, pot 100, bet to call 33
      // EV = 0.33*(133) - 0.67*33 = 43.89 - 22.11 = 21.78
      const result = calculateEV(100, 33, 0.33)
      expect(result).toBe(21.78)
    })
  })

  describe('calculatePotOdds', () => {
    it('should calculate pot odds correctly', () => {
      // 50 into 100: 50/(100+50)*100 = 33.33
      expect(calculatePotOdds(100, 50)).toBeCloseTo(33.33, 1)
    })

    it('should return ~20% for a 25 into 100 pot', () => {
      // 25/(100+25)*100 = 20
      expect(calculatePotOdds(100, 25)).toBe(20)
    })

    it('should return 0 when betToCall is 0', () => {
      expect(calculatePotOdds(100, 0)).toBe(0)
    })

    it('should return 50 for an all-in pot-sized bet', () => {
      // 100/(100+100)*100 = 50
      expect(calculatePotOdds(100, 100)).toBe(50)
    })
  })

  describe('isProfitableCall', () => {
    it('should return true when equity exceeds pot odds', () => {
      // pot odds = 50/150 ≈ 33%, equity = 40%
      expect(isProfitableCall(0.4, 100, 50)).toBe(true)
    })

    it('should return false when equity is below pot odds', () => {
      expect(isProfitableCall(0.2, 100, 50)).toBe(false)
    })

    it('should return true when equity equals pot odds', () => {
      // pot odds = 50/150 ≈ 0.333
      expect(isProfitableCall(1 / 3, 100, 50)).toBe(true)
    })

    it('should return true when betToCall is 0', () => {
      expect(isProfitableCall(0, 100, 0)).toBe(true)
    })
  })

  describe('calculateBreakEvenEquity', () => {
    it('should return correct break-even equity', () => {
      // 50/(100+50) = 0.333
      expect(calculateBreakEvenEquity(100, 50)).toBeCloseTo(1 / 3, 5)
    })

    it('should return 0.5 for pot-sized bet', () => {
      expect(calculateBreakEvenEquity(100, 100)).toBe(0.5)
    })

    it('should return 0 when betToCall is 0', () => {
      expect(calculateBreakEvenEquity(100, 0)).toBe(0)
    })
  })
})
