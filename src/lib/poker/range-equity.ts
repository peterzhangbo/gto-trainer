import type { Card, Rank, Suit } from '@/types/poker'
import type { HandFrequencies } from '@/data/index'
import { RANKS, SUITS } from './cards'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RangeEquityResult {
  heroWins: number
  villainWins: number
  tie: number
  heroEquity: number
  handCategories: Record<string, number>
}

export interface HandCategoryResult {
  overpair: number
  topPair: number
  twoPair: number
  set: number
  straight: number
  flush: number
  fullHouse: number
  quads: number
  straightFlush: number
}

export type RangeMap = Record<string, HandFrequencies>

// ---------------------------------------------------------------------------
// Poker Hand Evaluator (minimal, for range-vs-range Monte Carlo)
// ---------------------------------------------------------------------------

const RANK_ORDER: Record<Rank, number> = {
  A: 12, K: 11, Q: 10, J: 9, T: 8,
  '9': 7, '8': 6, '7': 5, '6': 4, '5': 3, '4': 2, '3': 1, '2': 0,
}

const STRAIGHTS: number[][] = [
  [12, 11, 10, 9, 8],
  [11, 10, 9, 8, 7],
  [10, 9, 8, 7, 6],
  [9, 8, 7, 6, 5],
  [8, 7, 6, 5, 4],
  [7, 6, 5, 4, 3],
  [6, 5, 4, 3, 2],
  [5, 4, 3, 2, 1],
  [4, 3, 2, 1, 0],
  [3, 2, 1, 0, 12], // Wheel: A-2-3-4-5
]

function evaluateHandStrength(handCards: Card[], boardCards: Card[]): number {
  const allCards = [...handCards, ...boardCards]
  const ranks = allCards.map(c => RANK_ORDER[c.rank])
  const suits = allCards.map(c => c.suit)

  const rankCounts: Record<number, number> = {}
  for (const r of ranks) {
    rankCounts[r] = (rankCounts[r] || 0) + 1
  }

  const suitCounts: Record<string, number> = {}
  for (const s of suits) {
    suitCounts[s] = (suitCounts[s] || 0) + 1
  }

  // Identify groups
  let fourOfAKindRank = -1
  const triplets: number[] = []
  const pairs: number[] = []

  for (const [rankStr, count] of Object.entries(rankCounts)) {
    const rank = Number(rankStr)
    if (count === 4) fourOfAKindRank = rank
    else if (count === 3) triplets.push(rank)
    else if (count === 2) pairs.push(rank)
  }
  triplets.sort((a, b) => b - a)
  pairs.sort((a, b) => b - a)

  const getKickers = (excludeRanks: number[], count: number): number[] => {
    const remaining = [...new Set(ranks)]
      .filter(r => !excludeRanks.includes(r))
      .sort((a, b) => b - a)
    return remaining.slice(0, count)
  }

  const encodeKickers = (kickers: number[]): number =>
    kickers.reduce((acc, r) => (acc << 4) + r, 0)

  // Flush & straight flush detection
  let flushSuit: string | null = null
  for (const [suit, count] of Object.entries(suitCounts)) {
    if (count >= 5) { flushSuit = suit; break }
  }

  // Straight detection
  const uniqueRankSet = new Set(ranks)
  let straightHigh = -1
  for (const straight of STRAIGHTS) {
    if (straight.every(r => uniqueRankSet.has(r))) {
      straightHigh = straight[0]
      break
    }
  }

  // Straight flush detection
  if (flushSuit) {
    const flushCards = allCards.filter(c => c.suit === flushSuit)
    const flushRanks = new Set(flushCards.map(c => RANK_ORDER[c.rank]))
    for (const straight of STRAIGHTS) {
      if (straight.every(r => flushRanks.has(r))) {
        return 8_000_000 + straight[0]
      }
    }
  }

  // Four of a kind
  if (fourOfAKindRank >= 0) {
    const kicker = getKickers([fourOfAKindRank], 1)
    return 7_000_000 + fourOfAKindRank * 100 + kicker[0]
  }

  // Full house
  if (triplets.length > 0 && (pairs.length > 0 || triplets.length > 1)) {
    const tripsRank = triplets[0]
    const pairRank = triplets.length > 1 ? triplets[1] : pairs[0]
    return 6_000_000 + tripsRank * 100 + pairRank
  }

  // Flush
  if (flushSuit) {
    const flushCards = allCards.filter(c => c.suit === flushSuit)
    const flushRanksSorted = flushCards
      .map(c => RANK_ORDER[c.rank])
      .sort((a, b) => b - a)
      .slice(0, 5)
    return 5_000_000 + encodeKickers(flushRanksSorted)
  }

  // Straight
  if (straightHigh >= 0) {
    return 4_000_000 + straightHigh
  }

  // Three of a kind
  if (triplets.length > 0) {
    const kickers = getKickers([triplets[0]], 2)
    return 3_000_000 + triplets[0] * 10000 + encodeKickers(kickers)
  }

  // Two pair
  if (pairs.length >= 2) {
    const kicker = getKickers([pairs[0], pairs[1]], 1)
    return 2_000_000 + pairs[0] * 10000 + pairs[1] * 100 + kicker[0]
  }

  // One pair
  if (pairs.length === 1) {
    const kickers = getKickers([pairs[0]], 3)
    return 1_000_000 + pairs[0] * 100000 + encodeKickers(kickers)
  }

  // High card
  const highCardKickers = getKickers([], 5)
  return encodeKickers(highCardKickers)
}

function compareHands(heroCards: Card[], villainCards: Card[], board: Card[]): number {
  const h = evaluateHandStrength(heroCards, board)
  const v = evaluateHandStrength(villainCards, board)
  if (h > v) return 1
  if (h < v) return -1
  return 0
}

function classifyHand(hand: Card[], board: Card[]): string {
  const allCards = [...hand, ...board]
  const ranks = allCards.map(c => RANK_ORDER[c.rank])
  const suits = allCards.map(c => c.suit)

  const rankCounts: Record<number, number> = {}
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1

  const suitCounts: Record<string, number> = {}
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1

  const quads = Object.values(rankCounts).some(c => c === 4)

  const triplets = Object.entries(rankCounts)
    .filter(([, c]) => c === 3)
    .map(([r]) => Number(r))
  const pairs = Object.entries(rankCounts)
    .filter(([, c]) => c === 2)
    .map(([r]) => Number(r))

  let flushSuit: string | null = null
  for (const [suit, count] of Object.entries(suitCounts)) {
    if (count >= 5) { flushSuit = suit; break }
  }

  const uniqueRankSet = new Set(ranks)
  let hasStraight = false
  for (const straight of STRAIGHTS) {
    if (straight.every(r => uniqueRankSet.has(r))) {
      hasStraight = true; break
    }
  }

  if (flushSuit) {
    const flushCards = allCards.filter(c => c.suit === flushSuit)
    const flushRanks = new Set(flushCards.map(c => RANK_ORDER[c.rank]))
    for (const straight of STRAIGHTS) {
      if (straight.every(r => flushRanks.has(r))) return 'straightFlush'
    }
  }

  if (quads) return 'quads'
  if (triplets.length > 0 && (pairs.length > 0 || triplets.length > 1)) return 'fullHouse'
  if (flushSuit) return 'flush'
  if (hasStraight) return 'straight'
  if (triplets.length > 0) return 'set'
  if (pairs.length >= 2) return 'twoPair'

  const heroRanks = hand.map(c => RANK_ORDER[c.rank])
  const isPair = heroRanks[0] === heroRanks[1]
  const boardRanks = board.map(c => RANK_ORDER[c.rank])
  const boardRankCounts: Record<number, number> = {}
  for (const r of boardRanks) boardRankCounts[r] = (boardRankCounts[r] || 0) + 1

  if (pairs.length === 1) {
    if (isPair && !boardRankCounts[heroRanks[0]] && heroRanks[0] > Math.max(...boardRanks)) {
      return 'overpair'
    }
    const pairedRank = pairs[0]
    if (heroRanks.includes(pairedRank)) {
      const boardMax = Math.max(...boardRanks)
      return pairedRank === boardMax ? 'topPair' : 'middlePair'
    }
  }

  return 'other'
}

// ---------------------------------------------------------------------------
// Monte Carlo Simulation
// ---------------------------------------------------------------------------

function createDeck(): { rank: Rank; suit: Suit }[] {
  const deck: { rank: Rank; suit: Suit }[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function removeCards(deck: Card[], toRemove: Card[]): Card[] {
  return deck.filter(
    c => !toRemove.some(r => r.rank === c.rank && r.suit === c.suit)
  )
}

export function calculateRangeEquity(
  heroRange: RangeMap,
  villainRange: RangeMap,
  boardCards: Card[],
  numSimulations: number = 1000,
  onProgress?: (progress: number) => void,
): RangeEquityResult {
  const heroHands = extractInRangeHands(heroRange)
  const villainHands = extractInRangeHands(villainRange)

  if (heroHands.length === 0 || villainHands.length === 0) {
    return { heroWins: 0, villainWins: 0, tie: 0, heroEquity: 0, handCategories: {} }
  }

  const heroTotalWeight = heroHands.reduce((s, h) => s + h.weight, 0)
  const villainTotalWeight = villainHands.reduce((s, h) => s + h.weight, 0)

  let heroWins = 0
  let villainWins = 0
  let ties = 0

  const categoryCounts: Record<string, number> = {}
  let classifiedCount = 0

  for (let i = 0; i < numSimulations; i++) {
    const deck = removeCards(createDeck(), boardCards)

    // Sample hero hand
    const heroInfo = sampleHand(heroHands, heroTotalWeight)
    const heroRemaining = removeCards(deck, heroInfo.cards)
    const heroCards = heroInfo.cards

    // Sample villain hand (must not overlap with hero)
    let villainCards: Card[] | null = null
    let attempts = 0
    while (attempts < 100) {
      const villainInfo = sampleHand(villainHands, villainTotalWeight)
      if (!villainInfo.cards.some(vc =>
        heroCards.some(hc => hc.rank === vc.rank && hc.suit === vc.suit)
      )) {
        villainCards = villainInfo.cards
        break
      }
      attempts++
    }
    if (!villainCards) continue

    const availableDeck = removeCards(heroRemaining, villainCards)

    // Complete board
    const shuffled = shuffleDeck(availableDeck)
    const fullBoard = [...boardCards]
    const cardsNeeded = 5 - fullBoard.length
    for (let j = 0; j < cardsNeeded && j < shuffled.length; j++) {
      fullBoard.push(shuffled[j])
    }

    // Evaluate winner
    const result = compareHands(heroCards, villainCards, fullBoard)
    if (result > 0) heroWins++
    else if (result < 0) villainWins++
    else ties++

    // Classify hero hand
    const category = classifyHand(heroCards, fullBoard)
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
    classifiedCount++

    if (onProgress && i > 0 && i % 100 === 0) {
      onProgress(i / numSimulations)
    }
  }

  const total = heroWins + villainWins + ties
  if (total === 0) {
    return { heroWins: 0, villainWins: 0, tie: 0, heroEquity: 0, handCategories: {} }
  }

  const handCategories: Record<string, number> = {}
  for (const [cat, count] of Object.entries(categoryCounts)) {
    handCategories[cat] = (count / classifiedCount) * 100
  }

  return {
    heroWins: (heroWins / total) * 100,
    villainWins: (villainWins / total) * 100,
    tie: (ties / total) * 100,
    heroEquity: ((heroWins + ties / 2) / total) * 100,
    handCategories,
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sampleHand(
  hands: { notation: string; weight: number }[],
  totalWeight: number,
): { notation: string; cards: Card[] } {
  let rand = Math.random() * totalWeight
  for (const h of hands) {
    rand -= h.weight
    if (rand <= 0) {
      return { notation: h.notation, cards: notationToCards(h.notation) }
    }
  }
  return { notation: hands[hands.length - 1].notation, cards: notationToCards(hands[hands.length - 1].notation) }
}

function notationToCards(notation: string): Card[] {
  const rank1 = notation[0] as Rank
  const rank2 = notation[1] as Rank
  const idx1 = RANKS.indexOf(rank1)
  const idx2 = RANKS.indexOf(rank2)
  const hiRank = idx1 <= idx2 ? rank1 : rank2
  const loRank = idx1 <= idx2 ? rank2 : rank1

  if (notation.length === 2) {
    // Pair: random 2 suits
    const suitIndices = shuffleDeck(
      SUITS.map(s => ({ rank: hiRank, suit: s as Suit }))
    )
    return [suitIndices[0], suitIndices[1]]
  }

  if (notation.endsWith('s')) {
    const suit = SUITS[Math.floor(Math.random() * 4)] as Suit
    return [
      { rank: hiRank, suit },
      { rank: loRank, suit },
    ]
  }

  // Offsuit
  const s1 = SUITS[Math.floor(Math.random() * 4)] as Suit
  let s2: Suit
  do { s2 = SUITS[Math.floor(Math.random() * 4)] as Suit } while (s2 === s1)
  return [
    { rank: hiRank, suit: s1 },
    { rank: loRank, suit: s2 },
  ]
}

export function extractInRangeHands(
  range: RangeMap,
  actionFilter?: string,
): { notation: string; weight: number }[] {
  return Object.entries(range)
    .filter(([, freq]) => {
      if (actionFilter) return (freq as Record<string, number>)[actionFilter] ?? 0 > 0
      return Object.values(freq).some(v => v > 0)
    })
    .map(([notation, freq]) => ({
      notation,
      weight: actionFilter
        ? ((freq as Record<string, number>)[actionFilter] ?? 0)
        : Math.max(...Object.values(freq as Record<string, number>)),
    }))
    .filter(h => h.weight > 0)
}

export function getComboCount(notation: string, weight: number = 1): number {
  if (notation.length === 2) return 6 * weight
  if (notation.endsWith('s')) return 4 * weight
  return 12 * weight
}

export function inRangeSet(range: RangeMap): Set<string> {
  return new Set(
    Object.entries(range)
      .filter(([, freq]) => Object.values(freq as Record<string, number>).some(v => v > 0))
      .map(([notation]) => notation)
  )
}
