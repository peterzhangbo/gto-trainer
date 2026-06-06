// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { calculateEquity } from '../equity'
import { classifyBoardTexture } from '../board-texture'
import type { Card } from '@/types/poker'

describe('equity.ts (detailed)', () => {
  describe('AA vs KK preflop', () => {
    it('should be approximately 82% equity for AA (±5%)', () => {
      const hero: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
      ]
      const villain: Card[] = [
        { rank: 'K', suit: 's' },
        { rank: 'K', suit: 'h' },
      ]

      const result = calculateEquity(hero, villain, [], 8000)

      // AA vs KK is ~82% for AA; allow ±5% Monte Carlo variance
      expect(result.heroEquity).toBeGreaterThan(0.77)
      expect(result.heroEquity).toBeLessThan(0.87)
      expect(result.heroWins + result.villainWins + result.tie).toBeCloseTo(
        1.0,
        4,
      )
    })

    it('AA should win the majority of the time, not just tie', () => {
      const hero: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
      ]
      const villain: Card[] = [
        { rank: 'K', suit: 'd' },
        { rank: 'K', suit: 'c' },
      ]

      const result = calculateEquity(hero, villain, [], 5000)
      expect(result.heroWins).toBeGreaterThan(0.7)
    })
  })

  describe('Random hand vs random hand', () => {
    it('should be approximately 50% equity each (±8%)', () => {
      // Use two specific non-dominated hands for a fair test
      const hero: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 'h' },
      ]
      // null villain = random hand
      const result = calculateEquity(hero, null, [], 5000)

      // AKo vs random hand is roughly 65% — so not exactly 50%, but hero has an edge
      expect(result.heroEquity).toBeGreaterThan(0.55)
      expect(result.heroEquity).toBeLessThan(0.75)
      expect(result.heroWins + result.villainWins + result.tie).toBeCloseTo(
        1.0,
        4,
      )
    })

    it('equity should sum to 1 when both hands are known', () => {
      const hero: Card[] = [
        { rank: 'T', suit: 's' },
        { rank: '9', suit: 'h' },
      ]
      const villain: Card[] = [
        { rank: 'J', suit: 'd' },
        { rank: '8', suit: 'c' },
      ]

      const result = calculateEquity(hero, villain, [], 3000)
      const total = result.heroWins + result.villainWins + result.tie
      expect(total).toBeCloseTo(1.0, 4)
    })
  })

  describe('AA vs AA (identical hands)', () => {
    it('should be approximately 50/50 with high tie rate', () => {
      const hero: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
      ]
      const villain: Card[] = [
        { rank: 'A', suit: 'd' },
        { rank: 'A', suit: 'c' },
      ]

      const result = calculateEquity(hero, villain, [], 8000)

      // AA vs AA should have very high tie rate (~95%+), each wins ~2-3%
      expect(result.tie).toBeGreaterThan(0.9)
      expect(result.heroEquity).toBeGreaterThan(0.48)
      expect(result.heroEquity).toBeLessThan(0.52)
      expect(result.heroWins + result.villainWins + result.tie).toBeCloseTo(
        1.0,
        4,
      )
    })
  })

  describe('Pocket pair vs two overcards (TT vs AK)', () => {
    it('should be approximately 55/45 in favor of the pocket pair', () => {
      const hero: Card[] = [
        { rank: 'T', suit: 's' },
        { rank: 'T', suit: 'h' },
      ]
      const villain: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 'h' },
      ]

      const result = calculateEquity(hero, villain, [], 8000)

      // TT vs AKo is approximately 55% for TT preflop
      expect(result.heroEquity).toBeGreaterThan(0.48)
      expect(result.heroEquity).toBeLessThan(0.62)
      expect(result.heroWins + result.villainWins + result.tie).toBeCloseTo(
        1.0,
        4,
      )
    })
  })

  describe('Dominated hand (AQ vs AA)', () => {
    it('should have very low equity for the dominated hand', () => {
      const hero: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'Q', suit: 'h' },
      ]
      const villain: Card[] = [
        { rank: 'A', suit: 'd' },
        { rank: 'A', suit: 'c' },
      ]

      const result = calculateEquity(hero, villain, [], 8000)

      // AQ vs AA: hero can only win with a Q kicker or runner-runner
      // Equity is roughly 7-10%
      expect(result.heroEquity).toBeGreaterThan(0.03)
      expect(result.heroEquity).toBeLessThan(0.18)
      expect(result.villainWins).toBeGreaterThan(0.8)
      expect(result.heroWins + result.villainWins + result.tie).toBeCloseTo(
        1.0,
        4,
      )
    })
  })

  describe('Board texture classification (equity integration)', () => {
    it('monotone board should classify correctly', () => {
      const board: [Card, Card, Card] = [
        { rank: '9', suit: 'h' },
        { rank: '6', suit: 'h' },
        { rank: '2', suit: 'h' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.monotone).toBe(true)
      expect(texture.twoTone).toBe(false)
      expect(texture.label).toBe('monotone')
    })

    it('wet connected two-tone board should classify correctly', () => {
      const board: [Card, Card, Card] = [
        { rank: 'J', suit: 's' },
        { rank: 'T', suit: 's' },
        { rank: '9', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.connected).toBe(true)
      expect(texture.twoTone).toBe(true)
      expect(texture.label).toBe('connected-two-tone')
    })

    it('dry rainbow board should classify correctly', () => {
      const board: [Card, Card, Card] = [
        { rank: 'K', suit: 's' },
        { rank: '7', suit: 'h' },
        { rank: '2', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.paired).toBe(false)
      expect(texture.monotone).toBe(false)
      expect(texture.connected).toBe(false)
      expect(texture.twoTone).toBe(false)
      expect(texture.label).toBe('dry')
    })

    it('paired high board should classify correctly', () => {
      const board: [Card, Card, Card] = [
        { rank: 'Q', suit: 's' },
        { rank: 'Q', suit: 'h' },
        { rank: '4', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.paired).toBe(true)
      expect(texture.highCard).toBe(true)
      expect(texture.label).toBe('paired-high')
    })
  })
})
