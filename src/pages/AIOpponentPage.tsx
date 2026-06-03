import { useState, useCallback, useMemo } from 'react'
import {
  getScenarioData,
  getScenarioById,
  getAllScenarios,
  isPreflop,
  isPostflop,
  type ScenarioData,
  type PostflopScenarioData,
  type PreflopScenarioData,
} from '@/data/index'
import type { Card, Rank, Suit } from '@/types/poker'
import CardDisplay from '@/components/poker/CardDisplay'
import { useI18n } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const SUITS_ARR: Suit[] = ['s', 'h', 'd', 'c']
const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

const ALL_SCENARIOS = getAllScenarios()

const SUBCATEGORY_I18N: Record<string, string> = {
  rfi: 'scenario.rfi',
  threebet: 'scenario.threebet',
  defend: 'scenario.defend',
  'c-bet': 'scenario.cbet',
  turn: 'scenario.turn',
  river: 'scenario.river',
}

type Street = 'preflop' | 'flop' | 'turn' | 'river'
type Phase = 'setup' | 'playing' | 'showdown'
type Player = 'hero' | 'villain'

interface GameState {
  phase: Phase
  street: Street
  heroHand: Card[]
  villainHand: Card[]
  board: Card[]
  pot: number
  heroStack: number
  villainStack: number
  streetBets: { hero: number; villain: number }
  currentPlayer: Player
  villainAction: string
  winner: Player | 'split' | null
  heroTotalBet: number
  villainTotalBet: number
  lastVillainAction: string
  allIn: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomRankExcluding(...excluded: Rank[]): Rank {
  const pool = RANKS.filter((r) => !excluded.includes(r))
  return pickRandom(pool)
}

function randomHighRank(): Rank {
  return pickRandom(['A', 'K', 'Q', 'J'] as const)
}

function randomMidRank(): Rank {
  return pickRandom(['T', '9', '8', '7'] as const)
}

function randomLowRank(): Rank {
  return pickRandom(['6', '5', '4', '3', '2'] as const)
}

function handToCards(hand: string): Card[] {
  const r1 = hand[0] as Rank
  const r2 = hand[1] as Rank
  if (hand.length === 2) {
    const s1 = pickRandom(SUITS_ARR)
    let s2: Suit
    do { s2 = pickRandom(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: r1, suit: s1 },
      { rank: r2, suit: s2 },
    ]
  }
  const suited = hand[2] === 's'
  if (suited) {
    const s = pickRandom(SUITS_ARR)
    return [
      { rank: r1, suit: s },
      { rank: r2, suit: s },
    ]
  }
  const s1 = pickRandom(SUITS_ARR)
  let s2: Suit
  do { s2 = pickRandom(SUITS_ARR) } while (s2 === s1)
  return [
    { rank: r1, suit: s1 },
    { rank: r2, suit: s2 },
  ]
}

function generateRandomPreflopHand(hands: Record<string, Record<string, number>>): string {
  const entries = Object.entries(hands)
  const inRange = entries.filter(([, strat]) => {
    const actions = Object.keys(strat)
    return !(actions.length === 1 && actions[0] === 'fold' && strat.fold === 1)
  })
  const pool = inRange.length > 0 ? inRange : entries.slice(0, 20)
  return pool[Math.floor(Math.random() * pool.length)][0]
}

function generateRandomBoard(numCards: number, texture?: string): Card[] {
  const t = texture ?? 'dry-high'
  let flop: Card[]

  if (t === 'wet-connected') {
    const base = pickRandom(['J', 'T', '9', '8'] as const)
    const idx = RANKS.indexOf(base)
    const twoTone = pickRandom(SUITS_ARR)
    let other: Suit
    do { other = pickRandom(SUITS_ARR) } while (other === twoTone)
    flop = [
      { rank: RANKS[idx] as Rank, suit: twoTone },
      { rank: RANKS[Math.min(idx + 1, 12)] as Rank, suit: twoTone },
      { rank: RANKS[Math.min(idx + 2, 12)] as Rank, suit: other },
    ]
  } else if (t === 'paired') {
    const pairRank = randomMidRank()
    const other = randomRankExcluding(pairRank)
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: pairRank, suit: shuffled[0] },
      { rank: pairRank, suit: shuffled[1] },
      { rank: other, suit: shuffled[2] },
    ]
  } else if (t === 'monochrome') {
    const suit = pickRandom(SUITS_ARR)
    flop = [
      { rank: randomHighRank(), suit },
      { rank: randomRankExcluding(flop?.[0]?.rank ?? 'A' as Rank), suit },
      { rank: randomRankExcluding(flop?.[0]?.rank ?? 'A' as Rank, flop?.[1]?.rank ?? 'K' as Rank), suit },
    ]
  } else {
    // dry-high or default
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: randomHighRank(), suit: shuffled[0] },
      { rank: randomLowRank(), suit: shuffled[1] },
      { rank: randomLowRank(), suit: shuffled[2] },
    ]
  }

  const board: Card[] = [...flop]
  if (numCards >= 4) {
    const usedRanks = board.map((c) => c.rank)
    board.push({ rank: randomRankExcluding(...usedRanks), suit: pickRandom(SUITS_ARR) })
  }
  if (numCards >= 5) {
    const usedRanks = board.map((c) => c.rank)
    board.push({ rank: randomRankExcluding(...usedRanks), suit: pickRandom(SUITS_ARR) })
  }
  return board
}

function getStreetNumCards(street: Street): number {
  switch (street) {
    case 'preflop': return 0
    case 'flop': return 3
    case 'turn': return 4
    case 'river': return 5
  }
}

function getNextStreet(street: Street): Street | null {
  switch (street) {
    case 'preflop': return 'flop'
    case 'flop': return 'turn'
    case 'turn': return 'river'
    case 'river': return null
  }
}

function getActionI18nKey(action: string): string {
  const map: Record<string, string> = {
    fold: 'trainer.fold',
    call: 'trainer.call',
    raise: 'trainer.raise',
    check: 'trainer.check',
    '3bet': 'trainer.threebet',
    threeBet: 'trainer.threebet',
  }
  return map[action] ?? action
}

// Simple poker hand evaluator for showdown (simplified: compare high cards and pairs)
function evaluateHandStrength(hand: Card[], board: Card[]): number {
  const allCards = [...hand, ...board]
  const rankCounts = new Map<Rank, number>()
  for (const c of allCards) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1)
  }

  let score = 0
  const handRankCounts = new Map<Rank, number>()
  for (const c of hand) {
    handRankCounts.set(c.rank, (handRankCounts.get(c.rank) ?? 0) + 1)
  }

  // Check for pairs, trips, quads using hand + board
  const counts = [...rankCounts.values()].sort((a, b) => b - a)
  if (counts[0] >= 4) score += 800
  else if (counts[0] === 3 && counts[1] >= 2) score += 700 // full house
  else if (counts[0] === 3) score += 400
  else if (counts[0] === 2 && counts[1] === 2) score += 300 // two pair
  else if (counts[0] === 2) score += 200

  // Check if hand cards contribute
  for (const [rank, count] of handRankCounts) {
    if (count === 2 && rankCounts.get(rank) === 2) score += 50 // pocket pair
    score += RANKS.indexOf('A') - RANKS.indexOf(rank) // high card bonus
  }

  // Flush draw bonus
  const handSuits = hand.map((c) => c.suit)
  for (const suit of handSuits) {
    const suitCount = allCards.filter((c) => c.suit === suit).length
    if (suitCount >= 5) score += 600
    else if (suitCount === 4 && hand.some((c) => c.suit === suit)) score += 100
  }

  // Straight potential (simplified)
  const uniqueSortedIdx = [...new Set(allCards.map((c) => RANKS.indexOf(c.rank)))].sort((a, b) => a - b)
  let maxConsecutive = 1
  let currentConsecutive = 1
  for (let i = 1; i < uniqueSortedIdx.length; i++) {
    if (uniqueSortedIdx[i] === uniqueSortedIdx[i - 1] + 1) {
      currentConsecutive++
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
    } else {
      currentConsecutive = 1
    }
  }
  if (maxConsecutive >= 5) score += 500
  else if (maxConsecutive === 4 && hand.some((c) => {
    const idx = RANKS.indexOf(c.rank)
    return uniqueSortedIdx.includes(idx - 1) || uniqueSortedIdx.includes(idx + 1)
  })) score += 80

  return score
}

// ---------------------------------------------------------------------------
// AI Decision Logic
// ---------------------------------------------------------------------------

function aiDecide(
  strategy: Record<string, number>,
  availableActions: string[],
): string {
  // Filter strategy to available actions
  const relevant: [string, number][] = []
  for (const action of availableActions) {
    const freq = strategy[action] ?? 0
    if (freq > 0) relevant.push([action, freq])
  }

  if (relevant.length === 0) {
    // No matching strategy; default to check/fold
    if (availableActions.includes('check')) return 'check'
    if (availableActions.includes('fold')) return 'fold'
    return availableActions[0] ?? 'fold'
  }

  // Normalize frequencies
  const total = relevant.reduce((sum, [, freq]) => sum + freq, 0)
  const rand = Math.random() * total
  let cumulative = 0
  for (const [action, freq] of relevant) {
    cumulative += freq
    if (rand <= cumulative) return action
  }
  return relevant[relevant.length - 1][0]
}

// Map postflop hand category to strategy lookup key
function classifyHand(hand: Card[], board: Card[]): string {
  const boardRanks = board.map((c) => c.rank)
  const topBoardRank = boardRanks[0]
  const topIdx = RANKS.indexOf(topBoardRank)
  const handRanks = hand.map((c) => c.rank)
  const handSuits = hand.map((c) => c.suit)
  const boardSuits = board.map((c) => c.suit)

  // Check for pair with board
  if (handRanks.includes(topBoardRank)) return 'topPair_topKicker'
  if (boardRanks.includes(handRanks[0]) || boardRanks.includes(handRanks[1])) return 'middlePair'

  // Overcards
  if (handRanks.every((r) => RANKS.indexOf(r) < topIdx)) return 'overcards'

  // Flush draw
  for (const suit of handSuits) {
    const count = boardSuits.filter((s) => s === suit).length + hand.filter((c) => c.suit === suit).length
    if (count >= 4) return 'flushDraw'
  }

  // Pocket pair (overpair if above board)
  if (handRanks[0] === handRanks[1]) {
    if (RANKS.indexOf(handRanks[0]) < topIdx) return 'overpair'
    return 'pair'
  }

  return 'air'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIOpponentPage() {
  const { t } = useI18n()
  const preflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'preflop')
  const postflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'postflop')

  const [selectedScenarioId, setSelectedScenarioId] = useState(preflopScenarios[0]?.id ?? '')
  const [sessionActive, setSessionActive] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [sessionPL, setSessionPL] = useState(0)
  const [handsPlayed, setHandsPlayed] = useState(0)
  const [showMobileStats, setShowMobileStats] = useState(false)

  const selectedMeta = useMemo(
    () => ALL_SCENARIOS.find((s) => s.id === selectedScenarioId),
    [selectedScenarioId],
  )

  const scenarioData = useMemo<ScenarioData | null>(() => {
    if (!selectedMeta) return null
    return getScenarioById(selectedMeta.id) ?? getScenarioData({
      scenarioType: selectedMeta.subCategory,
      position: selectedMeta.position,
      villainPosition: selectedMeta.villainPosition,
      boardTexture: selectedMeta.boardTexture,
    })
  }, [selectedMeta])

  const isPreflopScenario = scenarioData ? isPreflop(scenarioData) : false

  const dealNewHand = useCallback(() => {
    if (!scenarioData || !selectedMeta) return

    let heroHand: Card[]
    let villainHand: Card[]
    let initialBoard: Card[] = []

    if (isPreflopScenario && isPreflop(scenarioData)) {
      const data = scenarioData as PreflopScenarioData
      const heroHandStr = generateRandomPreflopHand(data.hands)
      heroHand = handToCards(heroHandStr)
      // Villain gets a random hand from full range
      const allHands = Object.keys(data.hands)
      const villainHandStr = allHands[Math.floor(Math.random() * allHands.length)]
      villainHand = handToCards(villainHandStr)
    } else {
      // Postflop: deal random hands
      heroHand = [
        { rank: randomHighRank(), suit: pickRandom(SUITS_ARR) },
        { rank: randomRankExcluding(heroHand?.[0]?.rank ?? 'A' as Rank), suit: pickRandom(SUITS_ARR) },
      ]
      villainHand = [
        { rank: randomHighRank(), suit: pickRandom(SUITS_ARR) },
        { rank: randomRankExcluding(villainHand?.[0]?.rank ?? 'A' as Rank), suit: pickRandom(SUITS_ARR) },
      ]
      if (isPostflop(scenarioData)) {
        const pfData = scenarioData as PostflopScenarioData
        initialBoard = [...pfData.exampleBoard.map((s) => {
          const rank = s[0] as Rank
          const suit = s[1] as Suit
          return { rank, suit }
        })]
      }
    }

    const startingStack = 100

    setGameState({
      phase: 'playing',
      street: 'preflop',
      heroHand,
      villainHand,
      board: initialBoard,
      pot: 1.5, // SB + BB
      heroStack: startingStack - 0.5, // hero is SB
      villainStack: startingStack - 1, // villain is BB
      streetBets: { hero: 0.5, villain: 1 },
      currentPlayer: 'hero', // SB acts first preflop
      villainAction: '',
      winner: null,
      heroTotalBet: 0.5,
      villainTotalBet: 1,
      lastVillainAction: '',
      allIn: false,
    })
  }, [scenarioData, selectedMeta, isPreflopScenario])

  const handleStartSession = () => {
    if (!scenarioData) return
    setSessionActive(true)
    setSessionPL(0)
    setHandsPlayed(0)
    dealNewHand()
  }

  const getVillainStrategy = useCallback((_street: Street, board: Card[]): Record<string, number> => {
    if (!scenarioData || !selectedMeta) return { fold: 1 }

    if (isPreflopScenario && isPreflop(scenarioData)) {
      const data = scenarioData as PreflopScenarioData
      // Villain strategy from data
      const allHands = Object.keys(data.hands)
      const randomHand = allHands[Math.floor(Math.random() * allHands.length)]
      return data.hands[randomHand] ?? { fold: 1 }
    }

    if (isPostflop(scenarioData)) {
      const pfData = scenarioData as PostflopScenarioData
      const category = classifyHand(gameState?.villainHand ?? [], board)

      // Try to find matching strategy
      if (pfData.strategy[category]) return pfData.strategy[category]
      if (pfData.strategy['air']) return pfData.strategy['air']

      // Fallback: pick a random category
      const cats = Object.keys(pfData.strategy)
      if (cats.length > 0) return pfData.strategy[cats[Math.floor(Math.random() * cats.length)]]
    }

    return { fold: 0.5, call: 0.3, raise: 0.2 }
  }, [scenarioData, selectedMeta, isPreflopScenario, gameState?.villainHand])

  const handleHeroAction = useCallback((action: string) => {
    if (!gameState || gameState.phase !== 'playing') return

    const { street, pot, heroStack, villainStack, streetBets } = gameState
    let newPot = pot
    let newHeroStack = heroStack
    let newVillainStack = villainStack
    const newStreetBets = { ...streetBets }
    let newAllIn = gameState.allIn

    const bb = 1

    // Process hero's action
    if (action === 'fold') {
      // Villain wins pot
      setGameState((prev) => prev ? { ...prev, phase: 'showdown', winner: 'villain' } : null)
      setSessionPL((p) => p - gameState.heroTotalBet)
      setHandsPlayed((h) => h + 1)
      return
    }

    if (action === 'check') {
      // No additional bet
    } else if (action === 'call') {
      const toCall = Math.min(newStreetBets.villain - newStreetBets.hero, newHeroStack)
      newHeroStack -= toCall
      newPot += toCall
      newStreetBets.hero += toCall
    } else if (action === 'raise' || action === '3bet') {
      const raiseAmount = street === 'preflop' ? 3 * bb : Math.round(pot * 0.75)
      const toAdd = Math.min(raiseAmount, newHeroStack)
      newHeroStack -= toAdd
      newPot += toAdd
      newStreetBets.hero += toAdd
    }

    // Check if both players are all-in
    if (newHeroStack <= 0 || newVillainStack <= 0) {
      newAllIn = true
    }

    // Now villain acts
    const villainStrat = getVillainStrategy(street, gameState.board)

    // Determine available actions for villain
    let villainActions: string[]
    if (newAllIn) {
      villainActions = ['call', 'fold']
    } else if (street === 'preflop') {
      if (newStreetBets.hero > newStreetBets.villain) {
        villainActions = ['fold', 'call', 'raise']
      } else {
        villainActions = ['check', 'raise']
      }
    } else {
      if (newStreetBets.hero > newStreetBets.villain) {
        villainActions = ['fold', 'call', 'raise']
      } else {
        villainActions = ['check', 'raise']
      }
    }

    const villainAction = aiDecide(villainStrat, villainActions)

    // Process villain action
    if (villainAction === 'fold') {
      setGameState((prev) => prev ? {
        ...prev,
        phase: 'showdown',
        winner: 'hero',
        pot: newPot,
        heroStack: newHeroStack,
        villainStack: newVillainStack,
        streetBets: newStreetBets,
        lastVillainAction: villainAction,
      } : null)
      setSessionPL((p) => p + (newPot - gameState.heroTotalBet))
      setHandsPlayed((h) => h + 1)
      return
    }

    if (villainAction === 'call') {
      const toCall = Math.min(newStreetBets.hero - newStreetBets.villain, newVillainStack)
      newVillainStack -= toCall
      newPot += toCall
      newStreetBets.villain += toCall
    } else if (villainAction === 'raise') {
      const raiseAmount = street === 'preflop' ? 3 * bb : Math.round(newPot * 0.75)
      const toAdd = Math.min(raiseAmount, newVillainStack)
      newVillainStack -= toAdd
      newPot += toAdd
      newStreetBets.villain += toAdd
    }

    // Check if all-in after villain action
    if (newHeroStack <= 0 || newVillainStack <= 0) {
      newAllIn = true
    }

    // Determine next action for hero
    const heroNeedsToAct = newStreetBets.villain > newStreetBets.hero || newAllIn

    if (villainAction === 'check' && !heroNeedsToAct) {
      // Both checked, move to next street or showdown
      const nextStreet = getNextStreet(street)
      if (!nextStreet) {
        // Go to showdown
        const newBoard = street === 'river' ? gameState.board :
          generateRandomBoard(5, isPostflop(scenarioData) ? (scenarioData as PostflopScenarioData).boardTexture : undefined)
        const heroStrength = evaluateHandStrength(gameState.heroHand, newBoard)
        const villainStrength = evaluateHandStrength(gameState.villainHand, newBoard)
        const winner = heroStrength > villainStrength ? 'hero' : heroStrength < villainStrength ? 'villain' : 'split' as const

        setGameState((prev) => prev ? {
          ...prev,
          phase: 'showdown',
          street: 'river',
          board: newBoard,
          pot: newPot,
          heroStack: newHeroStack,
          villainStack: newVillainStack,
          winner,
          lastVillainAction: villainAction,
          allIn: newAllIn,
        } : null)

        const wonPot = winner === 'hero' ? newPot : winner === 'split' ? newPot / 2 : 0
        setSessionPL((p) => p + wonPot - gameState.heroTotalBet)
        setHandsPlayed((h) => h + 1)
        return
      }

      // Move to next street
      const newBoard = generateRandomBoard(
        getStreetNumCards(nextStreet),
        isPostflop(scenarioData) ? (scenarioData as PostflopScenarioData).boardTexture : undefined,
      )

      setGameState((prev) => prev ? {
        ...prev,
        street: nextStreet,
        board: newBoard,
        pot: newPot,
        heroStack: newHeroStack,
        villainStack: newVillainStack,
        streetBets: { hero: 0, villain: 0 },
        currentPlayer: 'hero',
        lastVillainAction: villainAction,
        allIn: newAllIn,
      } : null)
      return
    }

    if (newAllIn && villainAction !== 'fold') {
      // Both all-in, run out remaining board
      const remainingBoard = generateRandomBoard(
        5,
        isPostflop(scenarioData) ? (scenarioData as PostflopScenarioData).boardTexture : undefined,
      )
      const heroStrength = evaluateHandStrength(gameState.heroHand, remainingBoard)
      const villainStrength = evaluateHandStrength(gameState.villainHand, remainingBoard)
      const winner = heroStrength > villainStrength ? 'hero' : heroStrength < villainStrength ? 'villain' : 'split' as const

      setGameState((prev) => prev ? {
        ...prev,
        phase: 'showdown',
        street: 'river',
        board: remainingBoard,
        pot: newPot,
        heroStack: newHeroStack,
        villainStack: newVillainStack,
        winner,
        lastVillainAction: villainAction,
        allIn: true,
      } : null)

      const wonPot = winner === 'hero' ? newPot : winner === 'split' ? newPot / 2 : 0
      setSessionPL((p) => p + wonPot - gameState.heroTotalBet)
      setHandsPlayed((h) => h + 1)
      return
    }

    // Hero needs to respond
    setGameState((prev) => prev ? {
      ...prev,
      pot: newPot,
      heroStack: newHeroStack,
      villainStack: newVillainStack,
      streetBets: newStreetBets,
      currentPlayer: 'hero',
      lastVillainAction: villainAction,
      allIn: newAllIn,
    } : null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, scenarioData, selectedMeta, isPreflopScenario, getVillainStrategy])

  const handleProceedStreet = useCallback(() => {
    if (!gameState) return
    const { street, pot, heroStack, villainStack } = gameState
    const nextStreet = getNextStreet(street)

    if (!nextStreet) {
      // Showdown
      const heroStrength = evaluateHandStrength(gameState.heroHand, gameState.board)
      const villainStrength = evaluateHandStrength(gameState.villainHand, gameState.board)
      const winner = heroStrength > villainStrength ? 'hero' : heroStrength < villainStrength ? 'villain' : 'split' as const

      setGameState((prev) => prev ? { ...prev, phase: 'showdown', winner } : null)
      const wonPot = winner === 'hero' ? pot : winner === 'split' ? pot / 2 : 0
      setSessionPL((p) => p + wonPot - gameState.heroTotalBet)
      setHandsPlayed((h) => h + 1)
      return
    }

    const newBoard = generateRandomBoard(
      getStreetNumCards(nextStreet),
      isPostflop(scenarioData) ? (scenarioData as PostflopScenarioData).boardTexture : undefined,
    )

    // Reset street bets
    setGameState((prev) => prev ? {
      ...prev,
      street: nextStreet,
      board: newBoard,
      streetBets: { hero: 0, villain: 0 },
      currentPlayer: 'hero',
      lastVillainAction: '',
      pot,
      heroStack,
      villainStack,
    } : null)
  }, [gameState, scenarioData])

  const handleEndSession = () => {
    setSessionActive(false)
    setGameState(null)
  }

  // Compute hero's available actions based on game state
  const heroActions = useMemo(() => {
    if (!gameState || gameState.phase !== 'playing' || gameState.currentPlayer !== 'hero') return []

    const { street, streetBets } = gameState
    const actions: string[] = []

    if (street === 'preflop') {
      if (streetBets.villain > streetBets.hero) {
        actions.push('fold', 'call', 'raise')
      } else {
        actions.push('check', 'raise')
      }
    } else {
      if (streetBets.villain > streetBets.hero) {
        actions.push('fold', 'call', 'raise')
      } else {
        actions.push('check', 'raise')
      }
    }

    return actions
  }, [gameState])

  // ---- Setup Screen ----
  if (!sessionActive) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">{t('ai.select')}</h1>

          <h2 className="text-lg font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            {t('trainer.preflopGroup' as Parameters<typeof t>[0])}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
            {preflopScenarios.map((s) => {
              const i18nKey = SUBCATEGORY_I18N[s.subCategory]
              const subCatLabel = i18nKey ? t(i18nKey as Parameters<typeof t>[0]) : s.subCategory
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedScenarioId(s.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedScenarioId === s.id
                      ? 'bg-red-900/30 border-red-600 ring-1 ring-red-600'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <span className="text-xs text-gray-500 uppercase">{subCatLabel}</span>
                  <h3 className="text-lg font-semibold text-white mt-1">
                    {s.position ? `${s.position} ` : ''}{s.name}
                  </h3>
                </button>
              )
            })}
          </div>

          <h2 className="text-lg font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            {t('trainer.postflopGroup' as Parameters<typeof t>[0])}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
            {postflopScenarios.map((s) => {
              const i18nKey = SUBCATEGORY_I18N[s.subCategory]
              const subCatLabel = i18nKey ? t(i18nKey as Parameters<typeof t>[0]) : s.subCategory
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedScenarioId(s.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedScenarioId === s.id
                      ? 'bg-blue-900/30 border-blue-600 ring-1 ring-blue-600'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <span className="text-xs text-gray-500 uppercase">{subCatLabel}</span>
                  <h3 className="text-base font-semibold text-white mt-1">{s.name}</h3>
                </button>
              )
            })}
          </div>

          <button
            onClick={handleStartSession}
            disabled={!scenarioData}
            className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded-lg font-semibold text-base md:text-lg transition-colors"
          >
            {t('ai.startBattle')}
          </button>
        </div>
      </div>
    )
  }

  // ---- Game Screen ----
  if (!gameState) return null

  const streetLabel = gameState.street === 'preflop' ? t('ai.preflop')
    : gameState.street === 'flop' ? t('ai.flop')
    : gameState.street === 'turn' ? t('ai.turn')
    : t('ai.river')

  const canProceed = gameState.phase === 'playing'
    && gameState.currentPlayer === 'hero'
    && heroActions.includes('check')
    && gameState.streetBets.hero >= gameState.streetBets.villain

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col items-center p-4 md:p-8">
        <div className="text-xs md:text-sm text-gray-500 mb-4 uppercase tracking-wider">
          {selectedMeta?.name ?? ''} - {streetLabel}
        </div>

        {/* Board */}
        {gameState.board.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 text-center mb-1">{t('ai.boardLabel')}</div>
            <div className="flex gap-2 md:gap-3 justify-center">
              {gameState.board.map((card, i) => (
                <CardDisplay key={`board-${i}`} card={card} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Villain area */}
        <div className="mb-6 w-full max-w-md">
          <div className="text-center mb-2">
            <span className="text-sm text-gray-400">{t('ai.villain')}</span>
            <span className="text-xs text-gray-600 ml-2">
              {gameState.villainStack.toFixed(1)} {t('ai.bbLabel')}
            </span>
          </div>
          <div className="flex gap-2 justify-center">
            {gameState.phase === 'showdown'
              ? gameState.villainHand.map((card, i) => (
                  <CardDisplay key={`villain-${i}`} card={card} size="md" />
                ))
              : <>
                  <CardDisplay card={{ rank: 'A', suit: 's' }} size="md" faceDown />
                  <CardDisplay card={{ rank: 'A', suit: 's' }} size="md" faceDown />
                </>
            }
          </div>
          {gameState.lastVillainAction && (
            <div className="text-center mt-2 text-sm text-orange-400">
              {t('ai.villainAction')}: {t(getActionI18nKey(gameState.lastVillainAction) as Parameters<typeof t>[0])}
            </div>
          )}
        </div>

        {/* Pot */}
        <div className="mb-4 text-center">
          <div className="text-sm text-gray-500">{t('ai.pot')}</div>
          <div className="text-xl font-bold text-yellow-400">{gameState.pot.toFixed(1)} {t('ai.bbLabel')}</div>
        </div>

        {/* Hero area */}
        <div className="mb-6 w-full max-w-md">
          <div className="text-center mb-2">
            <span className="text-sm text-gray-400">{t('ai.hero')}</span>
            <span className="text-xs text-gray-600 ml-2">
              {gameState.heroStack.toFixed(1)} {t('ai.bbLabel')}
            </span>
          </div>
          <div className="flex gap-2 md:gap-3 justify-center">
            {gameState.heroHand.map((card, i) => (
              <CardDisplay key={`hero-${i}`} card={card} size="lg" />
            ))}
          </div>
        </div>

        {/* Showdown result */}
        {gameState.phase === 'showdown' && gameState.winner && (
          <div className="text-center mb-6 w-full max-w-md">
            <div className={`text-xl md:text-2xl font-bold mb-2 ${
              gameState.winner === 'hero' ? 'text-green-400'
              : gameState.winner === 'villain' ? 'text-red-400'
              : 'text-yellow-400'
            }`}>
              {gameState.winner === 'hero' ? t('ai.heroWins')
                : gameState.winner === 'villain' ? t('ai.villainWins')
                : t('ai.splitPot')}
            </div>

            {gameState.phase === 'showdown' && (
              <div className="flex justify-center gap-8 text-sm text-gray-400 mt-2">
                <div>
                  <div className="text-xs mb-1">{t('ai.heroCards')}</div>
                  <div className="flex gap-1 justify-center">
                    {gameState.heroHand.map((c, i) => (
                      <span key={i} className="font-mono text-white">{c.rank}{SUIT_SYMBOLS[c.suit]}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs mb-1">{t('ai.villainCards')}</div>
                  <div className="flex gap-1 justify-center">
                    {gameState.villainHand.map((c, i) => (
                      <span key={i} className="font-mono text-white">{c.rank}{SUIT_SYMBOLS[c.suit]}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-3 justify-center">
              <button
                onClick={dealNewHand}
                className="min-h-[44px] px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
              >
                {t('ai.newHand')}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {gameState.phase === 'playing' && gameState.currentPlayer === 'hero' && heroActions.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center max-w-md w-full">
            {heroActions.map((action) => {
              const bgClass = action === 'fold' ? 'bg-red-700 hover:bg-red-600 border-red-600'
                : action === 'call' ? 'bg-blue-700 hover:bg-blue-600 border-blue-600'
                : action === 'check' ? 'bg-gray-600 hover:bg-gray-500 border-gray-500'
                : 'bg-green-700 hover:bg-green-600 border-green-600'
              return (
                <button
                  key={action}
                  onClick={() => handleHeroAction(action)}
                  className={`flex-1 min-w-[80px] min-h-[44px] px-5 py-3 rounded-lg border text-sm font-bold text-white transition-all ${bgClass}`}
                >
                  {t(getActionI18nKey(action) as Parameters<typeof t>[0])}
                </button>
              )
            })}
          </div>
        )}

        {/* Proceed to next street button (when both checked) */}
        {canProceed && gameState.lastVillainAction === 'check' && (
          <div className="mt-4">
            <button
              onClick={handleProceedStreet}
              className="min-h-[44px] px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
            >
              {t('ai.nextStreet')}
            </button>
          </div>
        )}

        {/* Mobile stats toggle */}
        <button
          onClick={() => setShowMobileStats((s) => !s)}
          className="lg:hidden mt-6 min-h-[44px] px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
        >
          {showMobileStats ? t('trainer.hideStats') : t('trainer.showStats')}
        </button>

        {/* Mobile collapsible stats */}
        {showMobileStats && (
          <div className="lg:hidden w-full max-w-md mt-4 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('ai.sessionPl')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">{t('ai.handsPlayed')}</div>
                <div className="text-xl font-bold text-white">{handsPlayed}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">{t('ai.netProfit')}</div>
                <div className={`text-xl font-bold ${sessionPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {sessionPL >= 0 ? '+' : ''}{sessionPL.toFixed(1)} {t('ai.bbLabel')}
                </div>
              </div>
            </div>
            <button
              onClick={handleEndSession}
              className="w-full mt-4 min-h-[44px] px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              {t('ai.endSession')}
            </button>
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 bg-gray-900 border-l border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-6">{t('ai.sessionPl')}</h3>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-500">{t('ai.handsPlayed')}</div>
            <div className="text-xl font-bold text-white">{handsPlayed}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t('ai.netProfit')}</div>
            <div className={`text-xl font-bold ${sessionPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {sessionPL >= 0 ? '+' : ''}{sessionPL.toFixed(1)} {t('ai.bbLabel')}
            </div>
          </div>
        </div>
        <button
          onClick={handleEndSession}
          className="w-full mt-8 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          {t('ai.endSession')}
        </button>
      </div>
    </div>
  )
}
