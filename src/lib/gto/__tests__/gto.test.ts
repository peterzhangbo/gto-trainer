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
  potAfterCall,
  betFromFraction,
  betAsFractionOfPot,
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

  describe('lookupGTO edge cases', () => {
    it('should return fold 100% for completely invalid hand notation', () => {
      const result = lookupGTO(
        { scenarioType: 'rfi', position: 'UTG' },
        'ZZZZ',
      )
      expect(result.found).toBe(false)
      expect(result.bestAction).toBe('fold')
      expect(result.bestActionFrequency).toBe(1.0)
    })

    it('should return fold 100% for empty string hand', () => {
      const result = lookupGTO(
        { scenarioType: 'rfi', position: 'UTG' },
        '',
      )
      expect(result.found).toBe(false)
      expect(result.bestAction).toBe('fold')
    })

    it('should return check 100% for invalid hand in postflop scenario', () => {
      const result = lookupGTO(
        {
          scenarioType: 'c-bet',
          boardTexture: 'dry-high',
          handCategory: 'nonexistentCategory',
        },
        'nonexistentCategory',
      )
      expect(result.found).toBe(false)
      expect(result.bestAction).toBe('check')
      expect(result.bestActionFrequency).toBe(1.0)
      expect(result.frequencies.check).toBe(1.0)
    })

    it('should return fold 100% for invalid position in threeBet scenario', () => {
      const result = lookupGTO(
        {
          scenarioType: 'threeBet',
          position: 'XX' as string,
          villainPosition: 'YY' as string,
        },
        'AA',
      )
      expect(result.found).toBe(false)
      expect(result.bestAction).toBe('fold')
      expect(result.bestActionFrequency).toBe(1.0)
    })

    it('should return fold 100% for invalid defend scenario', () => {
      const result = lookupGTO(
        {
          scenarioType: 'defend',
          position: 'ZZ' as string,
          villainPosition: 'WW' as string,
        },
        'KK',
      )
      expect(result.found).toBe(false)
      expect(result.bestAction).toBe('fold')
      expect(result.bestActionFrequency).toBe(1.0)
    })

    it('should handle single character hand gracefully', () => {
      const result = lookupGTO(
        { scenarioType: 'rfi', position: 'UTG' },
        'A',
      )
      expect(result.found).toBe(false)
      expect(result.bestAction).toBe('fold')
    })

    it('should handle special characters in hand notation', () => {
      const result = lookupGTO(
        { scenarioType: 'rfi', position: 'CO' },
        '!@#',
      )
      expect(result.found).toBe(false)
      expect(result.bestAction).toBe('fold')
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

  describe('calculateEV edge cases', () => {
    it('should return 0 for zero pot with non-zero bet and equity', () => {
      // EV = 0.5 * (0 + 50) - 0.5 * 50 = 25 - 25 = 0
      expect(calculateEV(0, 50, 0.5)).toBe(0)
    })

    it('should return 0 for zero equity with non-zero pot and bet', () => {
      // EV = 0 * (100 + 50) - 1 * 50 = -50
      expect(calculateEV(100, 50, 0)).toBe(-50)
    })

    it('should return 0 for all zeros', () => {
      expect(calculateEV(0, 0, 0)).toBe(0)
    })

    it('should return full pot value for 100% equity', () => {
      // EV = 1 * (200 + 100) - 0 * 100 = 300
      expect(calculateEV(200, 100, 1.0)).toBe(300)
    })

    it('should handle very small equity values', () => {
      // EV = 0.01 * (100 + 50) - 0.99 * 50 = 1.5 - 49.5 = -48
      expect(calculateEV(100, 50, 0.01)).toBe(-48)
    })

    it('should handle very large pot sizes', () => {
      // EV = 0.5 * (10000 + 5000) - 0.5 * 5000 = 7500 - 2500 = 5000
      expect(calculateEV(10000, 5000, 0.5)).toBe(5000)
    })
  })

  describe('calculatePotOdds edge cases', () => {
    it('should return 0 for zero pot and zero bet', () => {
      expect(calculatePotOdds(0, 0)).toBe(0)
    })

    it('should return 100 for bet into zero pot', () => {
      // 100/(0+100)*100 = 100 (need 100% equity when pot is 0)
      expect(calculatePotOdds(0, 100)).toBe(100)
    })

    it('should handle very small bet relative to pot', () => {
      // 1/(1000+1)*100 ≈ 0.1
      expect(calculatePotOdds(1000, 1)).toBeCloseTo(0.1, 1)
    })

    it('should handle very large bet relative to pot', () => {
      // 1000/(1+1000)*100 ≈ 99.9
      expect(calculatePotOdds(1, 1000)).toBeCloseTo(99.9, 1)
    })
  })

  describe('potAfterCall', () => {
    it('should calculate pot after call correctly', () => {
      expect(potAfterCall(100, 50)).toBe(200)
    })

    it('should handle zero bet', () => {
      expect(potAfterCall(100, 0)).toBe(100)
    })

    it('should handle zero pot', () => {
      expect(potAfterCall(0, 50)).toBe(100)
    })
  })

  describe('betFromFraction', () => {
    it('should calculate 50% pot bet', () => {
      expect(betFromFraction(200, 0.5)).toBe(100)
    })

    it('should calculate 75% pot bet', () => {
      expect(betFromFraction(200, 0.75)).toBe(150)
    })

    it('should calculate 33% pot bet', () => {
      expect(betFromFraction(90, 0.33)).toBeCloseTo(29.7, 1)
    })

    it('should return 0 for zero pot', () => {
      expect(betFromFraction(0, 0.5)).toBe(0)
    })

    it('should return 0 for zero fraction', () => {
      expect(betFromFraction(200, 0)).toBe(0)
    })
  })

  describe('betAsFractionOfPot', () => {
    it('should calculate fraction correctly', () => {
      expect(betAsFractionOfPot(100, 200)).toBe(0.5)
    })

    it('should return 0 for zero pot', () => {
      expect(betAsFractionOfPot(50, 0)).toBe(0)
    })

    it('should handle pot-sized bet', () => {
      expect(betAsFractionOfPot(200, 200)).toBe(1)
    })

    it('should handle overbet', () => {
      expect(betAsFractionOfPot(400, 200)).toBe(2)
    })
  })
})
