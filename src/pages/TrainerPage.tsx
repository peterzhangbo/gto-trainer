import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  getScenarioData,
  getScenarioById,
  getAllScenarios,
  isPreflop,
  isPostflop,
  type ScenarioData,
  type PostflopScenarioData,
} from '@/data/index'
import type { Card, Rank, Suit } from '@/types/poker'
import CardDisplay from '@/components/poker/CardDisplay'
import ActionButtons from '@/components/poker/ActionButtons'
import FrequencyBar from '@/components/poker/FrequencyBar'
import { supabase, isSupabaseConfigured } from '@/config/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { showToast } from '@/components/ui/Toast'

type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

const DIFFICULTY_CONFIG: Record<Difficulty, { filterHand: (strat: Record<string, number>) => boolean; showFeedback: boolean }> = {
  beginner: {
    filterHand: (strat) => {
      const maxFreq = Math.max(...Object.values(strat))
      return maxFreq >= 0.8
    },
    showFeedback: true,
  },
  intermediate: {
    filterHand: () => true,
    showFeedback: true,
  },
  advanced: {
    filterHand: (strat) => {
      const sorted = Object.values(strat).sort((a, b) => b - a)
      if (sorted.length < 2) return false
      // Only hands where the gap between top 2 actions is ≤ 15% — truly difficult decisions
      return sorted[0] - sorted[1] <= 0.15
    },
    showFeedback: true,
  },
  expert: {
    filterHand: () => true,
    showFeedback: false,
  },
}

// Map action keys to i18n labels
const ACTION_LABEL_KEYS: Record<string, string> = {
  fold: 'trainer.fold',
  call: 'trainer.call',
  raise: 'trainer.raise',
  check: 'trainer.check',
  '3bet': 'trainer.threebet',
  threeBet: 'trainer.threebet',
  bet_33pct: 'action.bet33',
  bet_50pct: 'action.bet50',
  bet_75pct: 'action.bet75',
  bet_100pct: 'action.bet100',
}

function getActionLabel(action: string, t: (key: string) => string): string {
  const key = ACTION_LABEL_KEYS[action]
  if (key) return t(key)
  return action
}

const ALL_SCENARIOS = getAllScenarios()

// Standard preflop actions
const PREFLOP_STANDARD_ACTIONS = ['fold', 'call', 'raise']

// Standard postflop actions
const POSTFLOP_STANDARD_ACTIONS = ['check', 'fold', 'call', 'raise']

// Hand category labels
const CATEGORY_LABELS: Record<string, string> = {
  overpair: '超对 Overpair',
  topPair_topKicker: '顶对好踢脚 Top Pair Best Kicker',
  topPair_goodKicker: '顶对较好踢脚 Top Pair Good Kicker',
  topPair_weakKicker: '顶对弱踢脚 Top Pair Weak Kicker',
  middlePair: '中对 Middle Pair',
  bottomPair: '底对 Bottom Pair',
  overcards: '高牌 Overcards',
  gutshot: '卡顺听牌 Gutshot',
  oesd: '两头顺听牌 OESD',
  flushDraw: '同花听牌 Flush Draw',
  comboDraw: '组合听牌 Combo Draw',
  air: '空气 Air',
  pair: '对子 Pair',
  draw: '听牌 Draw',
  bluffCatch: '抓诈唬 Bluff Catch',
  nutFlush: '坚果同花 Nut Flush',
  set: '暗三 Set',
  twoPair: '两对 Two Pair',
  monster: '怪兽牌 Monster',
}

// SubCategory to i18n key
const SUBCATEGORY_I18N: Record<string, string> = {
  rfi: 'scenario.rfi',
  threebet: 'scenario.threebet',
  defend: 'scenario.defend',
  'c-bet': 'scenario.cbet',
  turn: 'scenario.turn',
  river: 'scenario.river',
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

function generateRandomHand(strategy: Record<string, Record<string, number>>, difficulty: Difficulty = 'intermediate'): string {
  const entries = Object.entries(strategy)
  const filterFn = DIFFICULTY_CONFIG[difficulty].filterHand
  const weighted: [string, Record<string, number>][] = []

  for (const [hand, strat] of entries) {
    if (!filterFn(strat)) continue
    const actions = Object.keys(strat)
    const isFoldOnly = actions.length === 1 && actions[0] === 'fold' && strat.fold === 1
    if (isFoldOnly) {
      // Fold-only hands: 40% chance to appear (tests fold decisions)
      if (Math.random() < 0.40) weighted.push([hand, strat])
    } else {
      // In-range hands: always include
      weighted.push([hand, strat])
    }
  }

  // Fallback: if filter removed everything, use all hands
  if (weighted.length === 0) {
    for (const [hand, strat] of entries) {
      const actions = Object.keys(strat)
      const isFoldOnly = actions.length === 1 && actions[0] === 'fold' && strat.fold === 1
      if (isFoldOnly) {
        if (Math.random() < 0.40) weighted.push([hand, strat])
      } else {
        weighted.push([hand, strat])
      }
    }
  }
  if (weighted.length === 0) return entries[0]?.[0] ?? 'AA'
  return weighted[Math.floor(Math.random() * weighted.length)][0]
}

function handToCards(hand: string): Card[] {
  const SUITS: Suit[] = ['s', 'h', 'd', 'c']
  const r1 = hand[0] as Rank
  const r2 = hand[1] as Rank
  if (hand.length === 2) {
    return [
      { rank: r1, suit: SUITS[0] },
      { rank: r2, suit: SUITS[1] },
    ]
  }
  const suited = hand[2] === 's'
  if (suited) {
    const s = SUITS[Math.floor(Math.random() * 4)]
    return [
      { rank: r1, suit: s },
      { rank: r2, suit: s },
    ]
  }
  const s1 = SUITS[Math.floor(Math.random() * 4)]
  let s2 = SUITS[Math.floor(Math.random() * 4)]
  while (s2 === s1) s2 = SUITS[Math.floor(Math.random() * 4)]
  return [
    { rank: r1, suit: s1 },
    { rank: r2, suit: s2 },
  ]
}

// ------------------------------------------------------------------
// Postflop board generation helpers
// ------------------------------------------------------------------

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const SUITS_ARR: Suit[] = ['s', 'h', 'd', 'c']

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

function generateBoardByTexture(
  _category: string,
  numCards: number,
  boardTexture?: string,
): Card[] {
  const t = boardTexture ?? 'dry-high'
  let flop: Card[]

  if (t === 'dry-high') {
    const high = randomHighRank()
    const low1 = randomLowRank()
    const low2 = randomLowRank()
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: high, suit: shuffled[0] },
      { rank: low1, suit: shuffled[1] },
      { rank: low2, suit: shuffled[2] },
    ]
  } else if (t === 'wet-connected') {
    const base = pickRandom(['J', 'T', '9', '8'] as const)
    const idx = RANKS.indexOf(base)
    const r1 = RANKS[idx] as Rank
    const r2 = RANKS[Math.min(idx + 1, 12)] as Rank
    const r3 = RANKS[Math.min(idx + 2, 12)] as Rank
    const twoTone = pickRandom(SUITS_ARR)
    let other: Suit
    do { other = pickRandom(SUITS_ARR) } while (other === twoTone)
    flop = [
      { rank: r1, suit: twoTone },
      { rank: r2, suit: twoTone },
      { rank: r3, suit: other },
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
    const r1 = randomHighRank()
    const r2 = randomRankExcluding(r1)
    const r3 = randomRankExcluding(r1, r2)
    flop = [
      { rank: r1, suit },
      { rank: r2, suit },
      { rank: r3, suit },
    ]
  } else if (t === 'brick') {
    const high = randomMidRank()
    const low1 = randomLowRank()
    const low2 = randomLowRank()
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: high, suit: shuffled[0] },
      { rank: low1, suit: shuffled[1] },
      { rank: low2, suit: shuffled[2] },
    ]
  } else if (t === 'flush-completing') {
    const flushSuit = pickRandom(SUITS_ARR)
    let other: Suit
    do { other = pickRandom(SUITS_ARR) } while (other === flushSuit)
    const r1 = randomHighRank()
    const r2 = randomRankExcluding(r1)
    const r3 = randomRankExcluding(r1, r2)
    flop = [
      { rank: r1, suit: flushSuit },
      { rank: r2, suit: flushSuit },
      { rank: r3, suit: other },
    ]
  } else if (t === 'straight-completing') {
    const base = randomMidRank()
    const idx = RANKS.indexOf(base)
    const r1 = randomHighRank()
    const r2 = RANKS[idx] as Rank
    const r3 = RANKS[Math.min(idx + 1, 12)] as Rank
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: r1, suit: shuffled[0] },
      { rank: r2, suit: shuffled[1] },
      { rank: r3, suit: shuffled[2] },
    ]
  } else if (t === 'overcard') {
    const mid = randomMidRank()
    const low1 = randomLowRank()
    const low2 = randomLowRank()
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: mid, suit: shuffled[0] },
      { rank: low1, suit: shuffled[1] },
      { rank: low2, suit: shuffled[2] },
    ]
  } else if (t === 'blank') {
    const high = randomHighRank()
    const mid = randomMidRank()
    const low = randomLowRank()
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: high, suit: shuffled[0] },
      { rank: mid, suit: shuffled[1] },
      { rank: low, suit: shuffled[2] },
    ]
  } else if (t === 'scary') {
    const flushSuit = pickRandom(SUITS_ARR)
    let other: Suit
    do { other = pickRandom(SUITS_ARR) } while (other === flushSuit)
    const r1 = randomHighRank()
    const r2 = randomRankExcluding(r1)
    const r3 = randomRankExcluding(r1, r2)
    flop = [
      { rank: r1, suit: flushSuit },
      { rank: r2, suit: flushSuit },
      { rank: r3, suit: other },
    ]
  } else if (t === 'river-paired') {
    const high = randomHighRank()
    const low1 = randomLowRank()
    const low2 = randomLowRank()
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: high, suit: shuffled[0] },
      { rank: low1, suit: shuffled[1] },
      { rank: low2, suit: shuffled[2] },
    ]
  } else {
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: 'K' as Rank, suit: shuffled[0] },
      { rank: '7' as Rank, suit: shuffled[1] },
      { rank: '2' as Rank, suit: shuffled[2] },
    ]
  }

  const board: Card[] = [...flop]

  if (numCards >= 4) {
    const usedRanks = board.map((c) => c.rank)
    if (t === 'flush-completing' || t === 'scary') {
      const flushSuit = board[0].suit
      const r = randomRankExcluding(...usedRanks)
      board.push({ rank: r, suit: flushSuit })
    } else if (t === 'overcard') {
      board.push({ rank: randomHighRank(), suit: pickRandom(SUITS_ARR) })
    } else {
      const r = randomRankExcluding(...usedRanks)
      board.push({ rank: r, suit: pickRandom(SUITS_ARR) })
    }
  }

  if (numCards >= 5) {
    if (t === 'scary') {
      const flushSuit = board[0].suit
      const usedRanks = board.map((c) => c.rank)
      const r = randomRankExcluding(...usedRanks)
      board.push({ rank: r, suit: flushSuit })
    } else if (t === 'river-paired') {
      const pairIdx = Math.floor(Math.random() * board.length)
      const pairRank = board[pairIdx].rank
      let pairSuit: Suit
      do { pairSuit = pickRandom(SUITS_ARR) } while (pairSuit === board[pairIdx].suit)
      board.push({ rank: pairRank, suit: pairSuit })
    } else {
      const usedRanks = board.map((c) => c.rank)
      const r = randomRankExcluding(...usedRanks)
      board.push({ rank: r, suit: pickRandom(SUITS_ARR) })
    }
  }

  return board
}

// ------------------------------------------------------------------
// Postflop representative hand generation
// ------------------------------------------------------------------

function getRepresentativeHand(category: string, board: Card[]): Card[] {
  const topBoardRank = board[0].rank
  const topIdx = RANKS.indexOf(topBoardRank)
  const boardRanks = board.map((c) => c.rank)
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

  if (category === 'overpair') {
    const overpairRanks = RANKS.slice(0, topIdx)
    const rank = overpairRanks.length > 0 ? pick(overpairRanks) : 'A' as Rank
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: rank as Rank, suit: s1 },
      { rank: rank as Rank, suit: s2 },
    ]
  }

  if (category.startsWith('topPair')) {
    let kicker: Rank
    if (category === 'topPair_topKicker') {
      kicker = 'A'
    } else if (category === 'topPair_goodKicker') {
      kicker = pick(['K', 'Q'] as const)
    } else {
      kicker = pick(['J', 'T', '9', '8', '7'] as const)
    }
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: topBoardRank, suit: s1 },
      { rank: kicker, suit: s2 },
    ]
  }

  if (category === 'middlePair') {
    const midRank = board.length > 1 ? board[1].rank : randomMidRank()
    const kicker = randomRankExcluding(midRank, topBoardRank)
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: midRank, suit: s1 },
      { rank: kicker, suit: s2 },
    ]
  }

  if (category === 'bottomPair') {
    const botRank = board.length > 2 ? board[2].rank : randomLowRank()
    const kicker = randomRankExcluding(botRank, topBoardRank)
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: botRank, suit: s1 },
      { rank: kicker, suit: s2 },
    ]
  }

  if (category === 'overcards') {
    const overRanks = RANKS.slice(0, Math.max(topIdx, 1))
    const r1 = pick(overRanks)
    let r2: Rank
    do { r2 = pick(overRanks) } while (r2 === r1)
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: r1, suit: s1 },
      { rank: r2, suit: s2 },
    ]
  }

  if (category === 'flushDraw' || category === 'comboDraw') {
    const flushSuit = pick(board.map((c) => c.suit))
    const r1 = randomRankExcluding(...boardRanks)
    const r2 = randomRankExcluding(r1, ...boardRanks)
    return [
      { rank: r1, suit: flushSuit },
      { rank: r2, suit: flushSuit },
    ]
  }

  if (category === 'gutshot' || category === 'oesd') {
    const r1 = randomRankExcluding(...boardRanks)
    const r2 = randomRankExcluding(r1, ...boardRanks)
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: r1, suit: s1 },
      { rank: r2, suit: s2 },
    ]
  }

  if (category === 'set') {
    const boardRank = pick(board).rank
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: boardRank, suit: s1 },
      { rank: boardRank, suit: s2 },
    ]
  }

  if (category === 'twoPair') {
    const r1 = board[0].rank
    const r2 = board.length > 1 ? board[1].rank : randomMidRank()
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: r1, suit: s1 },
      { rank: r2, suit: s2 },
    ]
  }

  if (category === 'nutFlush') {
    const flushSuit = pick(board.map((c) => c.suit))
    return [
      { rank: 'A' as Rank, suit: flushSuit },
      { rank: randomRankExcluding('A' as Rank, ...boardRanks), suit: flushSuit },
    ]
  }

  if (category === 'monster') {
    const r1 = randomHighRank()
    const r2 = randomHighRank()
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: r1, suit: s1 },
      { rank: r2, suit: s2 },
    ]
  }

  if (category === 'pair') {
    const r = randomHighRank()
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: r, suit: s1 },
      { rank: r, suit: s2 },
    ]
  }

  // Air / bluffCatch / draw / fallback
  const r1 = randomRankExcluding(...boardRanks)
  const r2 = randomRankExcluding(r1, ...boardRanks)
  const s1 = pick(SUITS_ARR)
  let s2: Suit
  do { s2 = pick(SUITS_ARR) } while (s2 === s1)
  return [
    { rank: r1, suit: s1 },
    { rank: r2, suit: s2 },
  ]
}

export default function TrainerPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const preflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'preflop')
  const postflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'postflop')
  const [selectedScenarioId, setSelectedScenarioId] = useState(preflopScenarios[0]?.id ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => (localStorage.getItem('gto-difficulty') as Difficulty) || 'intermediate'
  )
  const [sessionActive, setSessionActive] = useState(false)
  const [currentHand, setCurrentHand] = useState('')
  const [currentCards, setCurrentCards] = useState<Card[]>([])
  const [currentStrategy, setCurrentStrategy] = useState<Record<string, number>>({})
  const [drillState, setDrillState] = useState<'awaiting' | 'revealed'>('awaiting')
  const [lastResult, setLastResult] = useState<{ userAction: string; bestAction: string; bestFreq: number; score: number; isCorrect: boolean } | null>(null)
  const [results, setResults] = useState<{ isCorrect: boolean }[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [sessionSaved, setSessionSaved] = useState(false)
  const [showMobileStats, setShowMobileStats] = useState(false)
  const [pendingResults, setPendingResults] = useState<{ userAction: string; bestAction: string; bestFreq: number; score: number; isCorrect: boolean }[]>([])
  const [boardCards, setBoardCards] = useState<Card[]>([])
  const [handCategory, setHandCategory] = useState('')
  const [isPostflopDrill, setIsPostflopDrill] = useState(false)

  // Auto-advance settings from localStorage
  const [autoAdvance] = useState(() => localStorage.getItem('gto-auto-advance') === 'true')
  const [autoAdvanceDelay] = useState(() => Number(localStorage.getItem('gto-auto-advance-delay') || 2))
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const generatePreflopDrill = useCallback((data: typeof scenarioData) => {
    if (!data || !isPreflop(data)) return
    const hand = generateRandomHand(data.hands, difficulty)
    const strategy = data.hands[hand] ?? { fold: 1 }
    setCurrentHand(hand)
    setCurrentCards(handToCards(hand))
    setCurrentStrategy(strategy)
    setBoardCards([])
    setHandCategory('')
    setIsPostflopDrill(false)
    setDrillState('awaiting')
    setLastResult(null)
  }, [difficulty])

  const generatePostflopDrill = useCallback(
    (data: typeof scenarioData, meta: typeof selectedMeta) => {
      if (!data || !isPostflop(data) || !meta) return
      const pfData = data as PostflopScenarioData
      const categories = Object.keys(pfData.strategy)
      if (categories.length === 0) return

      const weighted: string[] = []
      for (const cat of categories) {
        if (cat === 'air') {
          if (Math.random() < 0.3) weighted.push(cat)
        } else {
          weighted.push(cat)
        }
      }
      if (weighted.length === 0) weighted.push(categories[0])
      const category = pickRandom(weighted)
      const strategy: Record<string, number> = pfData.strategy[category]

      let numBoardCards = 3
      if (pfData.turnType || meta.subCategory === 'turn') numBoardCards = 4
      else if (pfData.riverType || meta.subCategory === 'river') numBoardCards = 5

      const board = generateBoardByTexture(category, numBoardCards, meta.boardTexture ?? pfData.boardTexture)
      const heroHand = getRepresentativeHand(category, board)
      const handStr = `${heroHand[0].rank}${heroHand[0].suit}${heroHand[1].rank}${heroHand[1].suit}`

      setCurrentHand(handStr)
      setCurrentCards(heroHand)
      setCurrentStrategy(strategy)
      setBoardCards(board)
      setHandCategory(category)
      setIsPostflopDrill(true)
      setDrillState('awaiting')
      setLastResult(null)
    },
    [],
  )

  const generateDrill = useCallback(() => {
    if (!scenarioData || !selectedMeta) return
    if (isPreflop(scenarioData)) {
      generatePreflopDrill(scenarioData)
    } else if (isPostflop(scenarioData)) {
      generatePostflopDrill(scenarioData, selectedMeta)
    }
  }, [scenarioData, selectedMeta, generatePreflopDrill, generatePostflopDrill])

  // Auto-advance effect: when drillState becomes 'revealed' and autoAdvance is on, schedule next drill
  useEffect(() => {
    if (drillState === 'revealed' && autoAdvance && difficulty !== 'expert') {
      autoAdvanceTimer.current = setTimeout(() => {
        generateDrill()
      }, autoAdvanceDelay * 1000)
      return () => {
        if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
      }
    }
  }, [drillState, autoAdvance, autoAdvanceDelay, difficulty, generateDrill])

  const handleStart = async () => {
    if (!scenarioData || !selectedMeta) return
    setSessionActive(true)
    setResults([])
    setStreak(0)
    setBestStreak(0)

    if (user && isSupabaseConfigured) {
      const { error } = await supabase.from('training_sessions').insert({
        id: sessionId,
        user_id: user.id,
        scenario_type: selectedMeta.subCategory ?? 'unknown',
        scenario_params: { scenarioId: selectedScenarioId },
      })
      if (error) {
        console.error('[Training] Session save error:', error)
        showToast(`${t('toast.sessionSaveFailed')}: ${error.message}`, 'error')
      } else {
        setSessionSaved(true)
      }
    }

    generateDrill()
  }

  const submitAction = async (action: string) => {
    const actionFreq = currentStrategy[action] ?? 0
    const bestEntry = Object.entries(currentStrategy).sort((a, b) => b[1] - a[1])[0]
    const bestAction = bestEntry[0]
    const bestFreq = bestEntry[1]
    const isCorrect = action === bestAction
    const score = actionFreq * 100

    const result = { userAction: action, bestAction, bestFreq, score, isCorrect }
    setLastResult(result)
    setResults((prev) => [...prev, { isCorrect }])

    if (isCorrect) {
      setStreak((s) => {
        const next = s + 1
        setBestStreak((b) => Math.max(b, next))
        return next
      })
    } else {
      setStreak(0)
    }

    // Build drill data for Supabase
    const drillData: Record<string, unknown> = {
      user_id: user?.id,
      session_id: sessionId,
      hand: currentHand,
      position: selectedMeta?.position ?? null,
      scenario_type: selectedMeta?.subCategory ?? 'unknown',
      gto_action: bestAction,
      gto_frequencies: JSON.stringify(currentStrategy),
      user_action: action,
      score,
      is_correct: isCorrect,
    }
    if (isPostflopDrill) {
      drillData.board_cards = boardCards.map((c) => `${c.rank}${c.suit}`).join(',')
      drillData.hand_category = handCategory
    }

    // In expert mode, skip showing feedback and go straight to next drill
    if (difficulty === 'expert') {
      setPendingResults((prev) => [...prev, result])
      if (user && isSupabaseConfigured && sessionSaved) {
        await supabase.from('drill_results').insert(drillData)
      }
      generateDrill()
      return
    }

    setDrillState('revealed')

    // Persist to Supabase if logged in
    if (user && isSupabaseConfigured && sessionSaved) {
      const { error } = await supabase.from('drill_results').insert(drillData)
      if (error) {
        console.error('[Training] Failed to save drill result:', error)
      }
    }
  }

  const endSession = async () => {
    setSessionActive(false)

    // Show expert mode results at end
    if (difficulty === 'expert' && pendingResults.length > 0) {
      setDrillState('revealed')
      setLastResult(pendingResults[pendingResults.length - 1])
    }
    setPendingResults([])

    // Update training session stats in Supabase
    if (user && isSupabaseConfigured && sessionSaved && results.length > 0) {
      const correctHands = results.filter((r) => r.isCorrect).length
      const { error } = await supabase
        .from('training_sessions')
        .update({
          ended_at: new Date().toISOString(),
          total_hands: results.length,
          correct_hands: correctHands,
          accuracy: Math.round((correctHands / results.length) * 100 * 100) / 100,
        })
        .eq('id', sessionId)
      if (error) {
        showToast(t('toast.sessionUpdateFailed'), 'error')
      }
    }
  }

  const totalHands = results.length
  const correctHands = results.filter((r) => r.isCorrect).length
  const accuracy = totalHands > 0 ? (correctHands / totalHands) * 100 : 0

  // Build available actions based on scenario type
  const allActionSet = isPostflopDrill
    ? new Set([...POSTFLOP_STANDARD_ACTIONS, ...Object.keys(currentStrategy)])
    : new Set([...PREFLOP_STANDARD_ACTIONS, ...Object.keys(currentStrategy)])
  const availableActions = [...allActionSet]

  // Scenario selection screen
  if (!sessionActive) {
    const difficulties: { key: Difficulty; labelKey: string; descKey: string; color: string }[] = [
      { key: 'beginner', labelKey: 'difficulty.beginner', descKey: 'difficulty.beginnerDesc', color: 'border-green-600 bg-green-900/30 ring-green-600' },
      { key: 'intermediate', labelKey: 'difficulty.intermediate', descKey: 'difficulty.intermediateDesc', color: 'border-blue-600 bg-blue-900/30 ring-blue-600' },
      { key: 'advanced', labelKey: 'difficulty.advanced', descKey: 'difficulty.advancedDesc', color: 'border-orange-600 bg-orange-900/30 ring-orange-600' },
      { key: 'expert', labelKey: 'difficulty.expert', descKey: 'difficulty.expertDesc', color: 'border-purple-600 bg-purple-900/30 ring-purple-600' },
    ]

    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">{t('trainer.select')}</h1>

          {/* Difficulty selector */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">{t('difficulty.title')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {difficulties.map((d) => (
                <button
                  key={d.key}
                  onClick={() => {
                    setDifficulty(d.key)
                    localStorage.setItem('gto-difficulty', d.key)
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    difficulty === d.key
                      ? `${d.color} ring-1`
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{t(d.labelKey as Parameters<typeof t>[0])}</div>
                  <div className="text-xs text-gray-500 mt-1">{t(d.descKey as Parameters<typeof t>[0])}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Preflop scenarios */}
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

          {/* Postflop scenarios */}
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
                  {s.exampleBoard && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('range.exampleBoard' as Parameters<typeof t>[0])} {s.exampleBoard.join(' ')}
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleStart}
            disabled={!scenarioData}
            className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded-lg font-semibold text-base md:text-lg transition-colors"
          >
            {t('trainer.start')}
          </button>
        </div>
      </div>
    )
  }

  // Training session
  const scenarioName = selectedMeta?.name ?? ''

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="text-xs md:text-sm text-gray-500 mb-4 uppercase tracking-wider">
          {scenarioName}
        </div>

        {/* Board cards (postflop only) */}
        {isPostflopDrill && boardCards.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 text-center mb-1">{t('trainer.board' as Parameters<typeof t>[0])}</div>
            <div className="flex gap-2 md:gap-3 justify-center">
              {boardCards.map((card, i) => (
                <CardDisplay key={`board-${i}`} card={card} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Hand category label (postflop only) */}
        {isPostflopDrill && handCategory && (
          <div className="text-xs md:text-sm text-gray-400 mb-2">
            {t('trainer.category' as Parameters<typeof t>[0])}:{' '}
            <span className="text-white font-medium">{getCategoryLabel(handCategory)}</span>
          </div>
        )}

        <div className="flex gap-2 md:gap-3 mb-4 md:mb-6">
          {currentCards.map((card, i) => (
            <CardDisplay key={`hero-${i}`} card={card} size="lg" />
          ))}
        </div>

        <div className="text-base md:text-lg text-gray-400 mb-6 md:mb-8">
          {t('trainer.hand')}: <span className="text-white font-mono font-bold text-lg md:text-xl">{currentHand}</span>
        </div>

        {drillState === 'awaiting' && (
          <ActionButtons
            actions={availableActions}
            onSelect={submitAction}
          />
        )}

        {drillState === 'revealed' && lastResult && (
          <div className="text-center max-w-lg w-full px-2">
            <div className={`text-xl md:text-2xl font-bold mb-4 ${lastResult.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {lastResult.isCorrect ? t('trainer.correct') : t('trainer.wrong')}
            </div>
            <div className="text-sm md:text-base text-gray-300 mb-4">
              {t('trainer.yourChoice')}: <span className="text-white font-bold">{getActionLabel(lastResult.userAction, t)}</span>
              {' -> '} {t('trainer.score')}: <span className="text-white">{lastResult.score.toFixed(0)}</span>/100
            </div>

            {/* Best action display */}
            <div className="mb-4 text-sm text-gray-400">
              {t('trainer.bestAction' as Parameters<typeof t>[0])}:{' '}
              <span className="text-green-400 font-bold">{getActionLabel(lastResult.bestAction, t)}</span>
              {' '}({Math.round(lastResult.bestFreq * 100)}%)
            </div>

            <div className="mb-6">
              <div className="text-sm text-gray-500 mb-2">{t('trainer.gto')}</div>
              <FrequencyBar strategy={currentStrategy} userAction={lastResult.userAction} />
            </div>

            <button
              onClick={generateDrill}
              className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
            >
              {t('trainer.next')}
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
            <h3 className="text-lg font-semibold text-white mb-4">{t('trainer.stats')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <StatItem label={t('trainer.hands')} value={totalHands} />
              <StatItem label={t('trainer.accuracy')} value={`${accuracy.toFixed(1)}%`} />
              <StatItem label={t('trainer.streak')} value={streak} highlight="orange" />
              <StatItem label={t('trainer.bestStreak')} value={bestStreak} highlight="yellow" />
            </div>
            <button
              onClick={endSession}
              className="w-full mt-4 min-h-[44px] px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              {t('trainer.end')}
            </button>
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 bg-gray-900 border-l border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-6">{t('trainer.stats')}</h3>
        <div className="space-y-4">
          <StatItem label={t('trainer.hands')} value={totalHands} />
          <StatItem label={t('trainer.accuracy')} value={`${accuracy.toFixed(1)}%`} />
          <StatItem label={t('trainer.streak')} value={streak} highlight="orange" />
          <StatItem label={t('trainer.bestStreak')} value={bestStreak} highlight="yellow" />
        </div>
        <button
          onClick={endSession}
          className="w-full mt-8 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          {t('trainer.end')}
        </button>
      </div>
    </div>
  )
}

function StatItem({ label, value, highlight }: { label: string; value: string | number; highlight?: 'orange' | 'yellow' }) {
  const colorClass = highlight === 'orange' ? 'text-orange-400' : highlight === 'yellow' ? 'text-yellow-400' : 'text-white'
  return (
    <div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  )
}
