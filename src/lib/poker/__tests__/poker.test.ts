// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createDeck, shuffleDeck, dealCards, removeCards, generateDeck } from '../deck'
import { RANKS, SUITS, RANK_VALUES, SUIT_SYMBOLS, parseCard, cardToString, isRedSuit } from '../cards'
import { evaluateHand, compareHands } from '../hand-eval'
import { calculateEquity } from '../equity'
import { classifyBoardTexture, generateRandomBoard } from '../board-texture'
import type { Card, BoardTexture } from '@/types/poker'

describe('deck.ts', () => {
  describe('createDeck', () => {
    it('should create a deck of 52 cards', () => {
      const deck = createDeck()
      expect(deck).toHaveLength(52)
    })

    it('should contain all rank-suit combinations', () => {
      const deck = createDeck()
      const keySet = new Set(deck.map((c) => `${c.rank}${c.suit}`))
      expect(keySet.size).toBe(52)

      for (const rank of RANKS) {
        for (const suit of SUITS) {
          expect(keySet.has(`${rank}${suit}`)).toBe(true)
        }
      }
    })

    it('should be equivalent to generateDeck', () => {
      const deck1 = createDeck()
      const deck2 = generateDeck()
      expect(deck1).toEqual(deck2)
    })
  })

  describe('shuffleDeck', () => {
    it('should return the same cards in a different order (statistically)', () => {
      const deck = createDeck()
      const shuffled = shuffleDeck(deck)

      expect(shuffled).toHaveLength(52)

      const originalKeys = deck.map((c) => `${c.rank}${c.suit}`)
      const shuffledKeys = shuffled.map((c) => `${c.rank}${c.suit}`)
      expect(shuffledKeys.sort()).toEqual(originalKeys.sort())

      const isSameOrder = deck.every(
        (card, i) => card.rank === shuffled[i].rank && card.suit === shuffled[i].suit,
      )
      expect(isSameOrder).toBe(false)
    })
  })

  describe('dealCards', () => {
    it('should deal the specified number of cards', () => {
      const deck = createDeck()
      const { cards, remaining } = dealCards(deck, 5)

      expect(cards).toHaveLength(5)
      expect(remaining).toHaveLength(47)
    })

    it('should remove dealt cards from remaining deck', () => {
      const deck = createDeck()
      const { cards, remaining } = dealCards(deck, 2)

      for (const card of cards) {
        expect(
          remaining.some((c) => c.rank === card.rank && c.suit === card.suit),
        ).toBe(false)
      }
    })
  })

  describe('removeCards', () => {
    it('should remove specified cards from deck', () => {
      const deck = createDeck()
      const toRemove: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 'h' },
      ]

      const result = removeCards(deck, toRemove)
      expect(result).toHaveLength(50)
      expect(
        result.some((c) => c.rank === 'A' && c.suit === 's'),
      ).toBe(false)
      expect(
        result.some((c) => c.rank === 'K' && c.suit === 'h'),
      ).toBe(false)
    })
  })
})

describe('cards.ts', () => {
  describe('constants', () => {
    it('RANKS should have 13 entries', () => {
      expect(RANKS).toHaveLength(13)
    })

    it('SUITS should have 4 entries', () => {
      expect(SUITS).toHaveLength(4)
    })

    it('RANK_VALUES should map A to 14 and 2 to 2', () => {
      expect(RANK_VALUES['A']).toBe(14)
      expect(RANK_VALUES['2']).toBe(2)
      expect(RANK_VALUES['K']).toBe(13)
      expect(RANK_VALUES['T']).toBe(10)
    })

    it('SUIT_SYMBOLS should map suits to Unicode symbols', () => {
      expect(SUIT_SYMBOLS['s']).toBe('♠')
      expect(SUIT_SYMBOLS['h']).toBe('♥')
      expect(SUIT_SYMBOLS['d']).toBe('♦')
      expect(SUIT_SYMBOLS['c']).toBe('♣')
    })
  })

  describe('parseCard', () => {
    it('should parse a two-character card string', () => {
      const card = parseCard('As')
      expect(card.rank).toBe('A')
      expect(card.suit).toBe('s')
    })

    it('should parse all suit types', () => {
      expect(parseCard('Kh')).toEqual({ rank: 'K', suit: 'h' })
      expect(parseCard('Td')).toEqual({ rank: 'T', suit: 'd' })
      expect(parseCard('2c')).toEqual({ rank: '2', suit: 'c' })
    })
  })

  describe('cardToString', () => {
    it('should convert a Card to a string', () => {
      expect(cardToString({ rank: 'A', suit: 's' })).toBe('As')
      expect(cardToString({ rank: 'T', suit: 'h' })).toBe('Th')
    })
  })

  describe('isRedSuit', () => {
    it('should return true for hearts and diamonds', () => {
      expect(isRedSuit('h')).toBe(true)
      expect(isRedSuit('d')).toBe(true)
    })

    it('should return false for spades and clubs', () => {
      expect(isRedSuit('s')).toBe(false)
      expect(isRedSuit('c')).toBe(false)
    })
  })
})

describe('hand-eval.ts', () => {
  describe('evaluateHand', () => {
    it('should identify a royal flush', () => {
      const cards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 's' },
        { rank: 'Q', suit: 's' },
        { rank: 'J', suit: 's' },
        { rank: 'T', suit: 's' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Royal Flush')
    })

    it('should identify a straight flush', () => {
      const cards: Card[] = [
        { rank: '9', suit: 'h' },
        { rank: '8', suit: 'h' },
        { rank: '7', suit: 'h' },
        { rank: '6', suit: 'h' },
        { rank: '5', suit: 'h' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Straight Flush')
    })

    it('should identify four of a kind', () => {
      const cards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
        { rank: 'A', suit: 'd' },
        { rank: 'A', suit: 'c' },
        { rank: 'K', suit: 's' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Four of a Kind')
    })

    it('should identify a full house', () => {
      const cards: Card[] = [
        { rank: 'K', suit: 's' },
        { rank: 'K', suit: 'h' },
        { rank: 'K', suit: 'd' },
        { rank: 'Q', suit: 's' },
        { rank: 'Q', suit: 'h' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Full House')
    })

    it('should identify a flush', () => {
      const cards: Card[] = [
        { rank: 'A', suit: 'd' },
        { rank: 'J', suit: 'd' },
        { rank: '9', suit: 'd' },
        { rank: '7', suit: 'd' },
        { rank: '3', suit: 'd' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Flush')
    })

    it('should identify a straight', () => {
      const cards: Card[] = [
        { rank: 'T', suit: 's' },
        { rank: '9', suit: 'h' },
        { rank: '8', suit: 'd' },
        { rank: '7', suit: 'c' },
        { rank: '6', suit: 's' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Straight')
    })

    it('should identify three of a kind', () => {
      const cards: Card[] = [
        { rank: 'Q', suit: 's' },
        { rank: 'Q', suit: 'h' },
        { rank: 'Q', suit: 'd' },
        { rank: 'J', suit: 'c' },
        { rank: '9', suit: 's' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Three of a Kind')
    })

    it('should identify two pair', () => {
      const cards: Card[] = [
        { rank: 'K', suit: 's' },
        { rank: 'K', suit: 'h' },
        { rank: 'J', suit: 'd' },
        { rank: 'J', suit: 'c' },
        { rank: '9', suit: 's' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Two Pair')
    })

    it('should identify one pair', () => {
      const cards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
        { rank: 'K', suit: 'd' },
        { rank: 'Q', suit: 'c' },
        { rank: 'J', suit: 's' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('One Pair')
    })

    it('should identify high card', () => {
      const cards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 'h' },
        { rank: 'Q', suit: 'd' },
        { rank: 'J', suit: 'c' },
        { rank: '9', suit: 's' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('High Card')
    })

    it('should work with 7 cards (Texas Hold\'em)', () => {
      const cards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 's' },
        { rank: 'Q', suit: 's' },
        { rank: 'J', suit: 's' },
        { rank: 'T', suit: 's' },
        { rank: '2', suit: 'c' },
        { rank: '3', suit: 'h' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Royal Flush')
    })

    it('should identify a wheel straight flush (A-2-3-4-5)', () => {
      const cards: Card[] = [
        { rank: 'A', suit: 'd' },
        { rank: '2', suit: 'd' },
        { rank: '3', suit: 'd' },
        { rank: '4', suit: 'd' },
        { rank: '5', suit: 'd' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Straight Flush')
    })

    it('should identify a low straight (A-2-3-4-5 wheel)', () => {
      const cards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: '2', suit: 'h' },
        { rank: '3', suit: 'd' },
        { rank: '4', suit: 'c' },
        { rank: '5', suit: 's' },
      ]
      const result = evaluateHand(cards)
      expect(result.handName).toBe('Straight')
    })

    it('should rank a flush higher than a straight', () => {
      const flushHand: Card[] = [
        { rank: '2', suit: 's' },
        { rank: '5', suit: 's' },
        { rank: '7', suit: 's' },
        { rank: '9', suit: 's' },
        { rank: 'J', suit: 's' },
      ]
      const straightHand: Card[] = [
        { rank: 'T', suit: 's' },
        { rank: '9', suit: 'h' },
        { rank: '8', suit: 'd' },
        { rank: '7', suit: 'c' },
        { rank: '6', suit: 's' },
      ]
      expect(compareHands(flushHand, straightHand)).toBe('hand1')
    })
  })

  describe('compareHands', () => {
    it('should return hand1 when hand1 is stronger', () => {
      const hand1: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
        { rank: 'K', suit: 'd' },
        { rank: 'Q', suit: 'c' },
        { rank: 'J', suit: 's' },
      ]
      const hand2: Card[] = [
        { rank: 'K', suit: 's' },
        { rank: 'K', suit: 'h' },
        { rank: 'Q', suit: 'd' },
        { rank: 'J', suit: 'c' },
        { rank: 'T', suit: 's' },
      ]
      expect(compareHands(hand1, hand2)).toBe('hand1')
    })

    it('should return hand2 when hand2 is stronger', () => {
      const hand1: Card[] = [
        { rank: '2', suit: 's' },
        { rank: '3', suit: 'h' },
        { rank: '4', suit: 'd' },
        { rank: '5', suit: 'c' },
        { rank: '7', suit: 's' },
      ]
      const hand2: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
        { rank: 'K', suit: 'd' },
        { rank: 'Q', suit: 'c' },
        { rank: 'J', suit: 's' },
      ]
      expect(compareHands(hand1, hand2)).toBe('hand2')
    })

    it('should return tie for equal hands', () => {
      const hand1: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 's' },
        { rank: 'Q', suit: 's' },
        { rank: 'J', suit: 's' },
        { rank: 'T', suit: 's' },
      ]
      const hand2: Card[] = [
        { rank: 'A', suit: 'h' },
        { rank: 'K', suit: 'h' },
        { rank: 'Q', suit: 'h' },
        { rank: 'J', suit: 'h' },
        { rank: 'T', suit: 'h' },
      ]
      expect(compareHands(hand1, hand2)).toBe('tie')
    })
  })
})

describe('equity.ts', () => {
  describe('calculateEquity', () => {
    it('AA vs KK should be approximately 82% for AA', () => {
      const heroCards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
      ]
      const villainCards: Card[] = [
        { rank: 'K', suit: 's' },
        { rank: 'K', suit: 'h' },
      ]

      const result = calculateEquity(heroCards, villainCards, [], 5000)

      expect(result.heroEquity).toBeGreaterThan(0.75)
      expect(result.heroEquity).toBeLessThan(0.90)
      expect(result.heroWins + result.villainWins + result.tie).toBeCloseTo(1.0, 5)
    })

    it('should handle random villain hand when villainCards is null', () => {
      const heroCards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
      ]

      const result = calculateEquity(heroCards, null, [], 1000)

      expect(result.heroEquity).toBeGreaterThan(0.4)
      expect(result.heroWins + result.villainWins + result.tie).toBeCloseTo(1.0, 5)
    })

    it('should handle board cards', () => {
      const heroCards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
      ]
      const villainCards: Card[] = [
        { rank: 'K', suit: 's' },
        { rank: 'K', suit: 'h' },
      ]
      const board: Card[] = [
        { rank: '2', suit: 'd' },
        { rank: '7', suit: 'c' },
        { rank: 'J', suit: 's' },
      ]

      const result = calculateEquity(heroCards, villainCards, board, 2000)

      expect(result.heroEquity).toBeGreaterThan(0.6)
      expect(result.heroWins + result.villainWins + result.tie).toBeCloseTo(1.0, 5)
    })

    it('equity values should sum to approximately 1', () => {
      const heroCards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 's' },
      ]
      const villainCards: Card[] = [
        { rank: 'Q', suit: 'h' },
        { rank: 'Q', suit: 'd' },
      ]

      const result = calculateEquity(heroCards, villainCards, [], 2000)

      const total = result.heroWins + result.villainWins + result.tie
      expect(total).toBeCloseTo(1.0, 5)
    })
  })
})

describe('board-texture.ts', () => {
  describe('classifyBoardTexture', () => {
    it('should classify a monotone board', () => {
      const board: [Card, Card, Card] = [
        { rank: 'A', suit: 'h' },
        { rank: 'K', suit: 'h' },
        { rank: 'Q', suit: 'h' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.monotone).toBe(true)
      expect(texture.twoTone).toBe(false)
      expect(texture.label).toBe('monotone')
    })

    it('should classify a paired board', () => {
      const board: [Card, Card, Card] = [
        { rank: 'K', suit: 's' },
        { rank: 'K', suit: 'h' },
        { rank: '7', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.paired).toBe(true)
      expect(texture.highCard).toBe(true)
      expect(texture.label).toBe('paired-high')
    })

    it('should classify a connected two-tone board', () => {
      const board: [Card, Card, Card] = [
        { rank: 'T', suit: 's' },
        { rank: '9', suit: 's' },
        { rank: '8', suit: 'h' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.connected).toBe(true)
      expect(texture.twoTone).toBe(true)
      expect(texture.label).toBe('connected-two-tone')
    })

    it('should classify a dry board', () => {
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

    it('should detect high cards on board', () => {
      const board: [Card, Card, Card] = [
        { rank: 'A', suit: 's' },
        { rank: '5', suit: 'h' },
        { rank: '2', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.highCard).toBe(true)
    })

    it('should classify a rainbow disconnected board as dry', () => {
      const board: [Card, Card, Card] = [
        { rank: 'K', suit: 's' },
        { rank: '8', suit: 'h' },
        { rank: '2', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.label).toBe('dry')
      expect(texture.monotone).toBe(false)
      expect(texture.twoTone).toBe(false)
    })

    it('should classify A-2-3 low connected board as connected', () => {
      const board: [Card, Card, Card] = [
        { rank: 'A', suit: 's' },
        { rank: '2', suit: 'h' },
        { rank: '3', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      // A=14, 2=2, 3=3 → rankSpread = 12, but ace-low spread = 3-2+1 = 2 ≤ 4 → connected
      expect(texture.connected).toBe(true)
      expect(texture.highCard).toBe(true)
    })

    it('should classify two-tone flush draw board (3 spades + 1 heart)', () => {
      const board: [Card, Card, Card] = [
        { rank: 'K', suit: 's' },
        { rank: '9', suit: 's' },
        { rank: '5', suit: 'h' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.twoTone).toBe(true)
      expect(texture.monotone).toBe(false)
      expect(texture.connected).toBe(false)
      expect(texture.highCard).toBe(true)
    })

    it('should classify low paired disconnected board as dry', () => {
      const board: [Card, Card, Card] = [
        { rank: '2', suit: 's' },
        { rank: '2', suit: 'h' },
        { rank: '7', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.paired).toBe(true)
      expect(texture.highCard).toBe(false)
      expect(texture.connected).toBe(false)
      expect(texture.label).toBe('dry')
    })

    it('should classify low paired connected board as wet', () => {
      const board: [Card, Card, Card] = [
        { rank: '4', suit: 's' },
        { rank: '4', suit: 'h' },
        { rank: '3', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.paired).toBe(true)
      expect(texture.highCard).toBe(false)
      expect(texture.connected).toBe(true)
      expect(texture.label).toBe('wet')
    })

    it('should classify connected rainbow board as wet', () => {
      const board: [Card, Card, Card] = [
        { rank: '8', suit: 's' },
        { rank: '7', suit: 'h' },
        { rank: '6', suit: 'd' },
      ]
      const texture = classifyBoardTexture(board)
      expect(texture.connected).toBe(true)
      expect(texture.twoTone).toBe(false)
      expect(texture.monotone).toBe(false)
      expect(texture.label).toBe('wet')
    })

    it('should classify semi-connected two-tone board as wet', () => {
      const board: [Card, Card, Card] = [
        { rank: 'J', suit: 's' },
        { rank: '8', suit: 's' },
        { rank: '5', suit: 'h' },
      ]
      const texture = classifyBoardTexture(board)
      // J=11, 8=8, 5=5 → rankSpread = 11-5 = 6 → semiConnected, twoTone
      expect(texture.twoTone).toBe(true)
      expect(texture.label).toBe('wet')
    })
  })

  describe('generateRandomBoard', () => {
    it('should generate a board matching the requested texture (monotone)', () => {
      const texture: BoardTexture = {
        paired: false,
        monotone: true,
        connected: false,
        twoTone: false,
        highCard: false,
        label: 'monotone',
      }
      const board = generateRandomBoard(texture)
      expect(board).toHaveLength(3)

      const classified = classifyBoardTexture(board as [Card, Card, Card])
      expect(classified.monotone).toBe(true)
      expect(classified.paired).toBe(false)
    })

    it('should generate a board matching the requested texture (paired-high)', () => {
      const texture: BoardTexture = {
        paired: true,
        monotone: false,
        connected: false,
        twoTone: false,
        highCard: true,
        label: 'paired-high',
      }
      const board = generateRandomBoard(texture)
      expect(board).toHaveLength(3)

      const classified = classifyBoardTexture(board as [Card, Card, Card])
      expect(classified.paired).toBe(true)
      expect(classified.highCard).toBe(true)
    })

    it('should generate a board matching the requested texture (dry)', () => {
      const texture: BoardTexture = {
        paired: false,
        monotone: false,
        connected: false,
        twoTone: false,
        highCard: false,
        label: 'dry',
      }
      const board = generateRandomBoard(texture)
      expect(board).toHaveLength(3)

      const classified = classifyBoardTexture(board as [Card, Card, Card])
      expect(classified.paired).toBe(false)
      expect(classified.monotone).toBe(false)
      expect(classified.connected).toBe(false)
    })
  })
})
