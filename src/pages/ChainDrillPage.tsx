import { useState, useCallback } from 'react'
import {
  
  getScenarioById,
  getAllScenarios,
  isPreflop,
  isPostflop,
  type ScenarioData,
  type PostflopScenarioData,
  DATA_REGISTRY,
} from '@/data/index'
import type { Card, Rank, Suit } from '@/types/poker'
import CardDisplay from '@/components/poker/CardDisplay'
import ActionButtons from '@/components/poker/ActionButtons'
import FrequencyBar from '@/components/poker/FrequencyBar'
import { useI18n } from '@/lib/i18n'

type Street = 'preflop' | 'flop' | 'turn' | 'river'

interface StreetResult {
  street: Street
  userAction: string
  bestAction: string
  bestFreq: number
  score: number
  strategy: Record<string, number>
}

const ALL_SCENARIOS = getAllScenarios()

const PREFLOP_STANDARD_ACTIONS = ['fold', 'call', 'raise']
const POSTFLOP_STANDARD_ACTIONS = ['check', 'fold', 'call', 'raise']

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


function randomLowRank(): Rank {
  return pickRandom(['6', '5', '4', '3', '2'] as const)
}

// Reuse hand card generation logic from TrainerPage
function handToCards(hand: string): Card[] {
  const r1 = hand[0] as Rank
  const r2 = hand[1] as Rank
  if (hand.length === 2) {
    return [
      { rank: r1, suit: SUITS_ARR[0] },
      { rank: r2, suit: SUITS_ARR[1] },
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
  let s2 = pickRandom(SUITS_ARR)
  while (s2 === s1) s2 = pickRandom(SUITS_ARR)
  return [
    { rank: r1, suit: s1 },
    { rank: r2, suit: s2 },
  ]
}

// Board generation (simplified from TrainerPage)
function generateFlopBoard(): Card[] {
  const high = randomHighRank()
  const low1 = randomLowRank()
  const low2 = randomLowRank()
  const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
  return [
    { rank: high, suit: shuffled[0] },
    { rank: low1, suit: shuffled[1] },
    { rank: low2, suit: shuffled[2] },
  ]
}

function addRandomCard(board: Card[]): Card {
  const usedRanks = board.map((c) => c.rank)
  const rank = randomRankExcluding(...usedRanks)
  return { rank, suit: pickRandom(SUITS_ARR) }
}

// Classify a preflop hand into a postflop category based on the board
function classifyHand(heroCards: Card[], board: Card[]): string {
  const heroRanks = heroCards.map((c) => c.rank)
  const boardRanks = board.map((c) => c.rank)
  const topBoardIdx = RANKS.indexOf(board[0].rank)

  // Check for pairs
  const heroPairRank = heroRanks[0] === heroRanks[1] ? heroRanks[0] : null
  if (heroPairRank) {
    const pairIdx = RANKS.indexOf(heroPairRank)
    if (pairIdx < topBoardIdx) return 'overpair'
    if (boardRanks.includes(heroPairRank)) return 'set'
    return 'middlePair'
  }

  // Check if hero cards match board
  const matchRanks = heroRanks.filter((r) => boardRanks.includes(r))
  if (matchRanks.length > 0) {
    const matchRank = matchRanks[0]
    if (matchRank === board[0].rank) {
      const kicker = heroRanks.find((r) => r !== matchRank)!
      const kickerIdx = RANKS.indexOf(kicker)
      if (kickerIdx <= 2) return 'topPair_topKicker'
      if (kickerIdx <= 5) return 'topPair_goodKicker'
      return 'topPair_weakKicker'
    }
    if (board.length > 1 && matchRank === board[1].rank) return 'middlePair'
    return 'bottomPair'
  }

  // Check for flush draw
  const heroSuits = heroCards.map((c) => c.suit)
  if (heroSuits[0] === heroSuits[1]) {
    const flushSuit = heroSuits[0]
    const boardOfSuit = board.filter((c) => c.suit === flushSuit).length
    if (boardOfSuit >= 2) return 'flushDraw'
  }

  // Check for overcards
  const heroHighIdx = Math.min(...heroRanks.map((r) => RANKS.indexOf(r)))
  if (heroHighIdx < topBoardIdx) return 'overcards'

  return 'air'
}

// Map board to best matching postflop scenario
function findPostflopScenario(street: Street, boardTexture?: string): PostflopScenarioData | null {
  const prefMap: Record<string, string[]> = {
    'dry-high': ['cbet_dry_high'],
    'wet-connected': ['cbet_wet_connected'],
    'paired': ['cbet_paired'],
    'monochrome': ['cbet_monochrome'],
  }

  const turnMap: Record<string, string[]> = {
    brick: ['turn_brick'],
    'flush-completing': ['turn_flush_completing'],
    'straight-completing': ['turn_straight_completing'],
    overcard: ['turn_overcard'],
    paired: ['turn_paired'],
  }

  const riverMap: Record<string, string[]> = {
    blank: ['river_blank'],
    scary: ['river_scary'],
    paired: ['river_paired'],
  }

  let candidateIds: string[] = []
  if (street === 'flop') {
    candidateIds = boardTexture ? (prefMap[boardTexture] ?? ['cbet_dry_high']) : ['cbet_dry_high']
  } else if (street === 'turn') {
    const textures = boardTexture ? (turnMap[boardTexture] ?? ['turn_brick']) : ['turn_brick']
    candidateIds = textures
  } else if (street === 'river') {
    const textures = boardTexture ? (riverMap[boardTexture] ?? ['river_blank']) : ['river_blank']
    candidateIds = textures
  }

  for (const id of candidateIds) {
    const data = DATA_REGISTRY[id]
    if (data && isPostflop(data)) return data as PostflopScenarioData
  }

  // Fallback: find any scenario of the right type
  for (const [key, data] of Object.entries(DATA_REGISTRY)) {
    if (isPostflop(data)) {
      if (street === 'flop' && key.startsWith('cbet_')) return data as PostflopScenarioData
      if (street === 'turn' && key.startsWith('turn_')) return data as PostflopScenarioData
      if (street === 'river' && key.startsWith('river_')) return data as PostflopScenarioData
    }
  }
  return null
}

// Get strategy for a hand category from postflop data, with fallback
function getStrategyForCategory(
  data: PostflopScenarioData,
  category: string,
): Record<string, number> | null {
  if (data.strategy[category]) return data.strategy[category]
  // Fallback: try common variants
  const fallbacks = ['air', 'overcards', 'middlePair', 'bottomPair']
  for (const fb of fallbacks) {
    if (data.strategy[fb]) return data.strategy[fb]
  }
  // Last resort: use first available
  const first = Object.values(data.strategy)[0]
  return first ?? null
}

// Action label mapping (reuse from TrainerPage)
const ACTION_LABEL_KEYS: Record<string, string> = {
  fold: 'trainer.fold',
  call: 'trainer.call',
  raise: 'trainer.raise',
  check: 'trainer.check',
  '3bet': 'trainer.threebet',
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

const CATEGORY_LABELS: Record<string, string> = {
  overpair: '超对 Overpair',
  topPair_topKicker: '顶对好踢脚 Top Pair Best Kicker',
  topPair_goodKicker: '顶对较好踢脚 Top Pair Good Kicker',
  topPair_weakKicker: '顶对弱踢脚 Top Pair Weak Kicker',
  middlePair: '中对 Middle Pair',
  bottomPair: '底对 Bottom Pair',
  overcards: '高牌 Overcards',
  flushDraw: '同花听牌 Flush Draw',
  air: '空气 Air',
  set: '暗三 Set',
}

function generateRandomHand(strategy: Record<string, Record<string, number>>): string {
  const entries = Object.entries(strategy)
  const weighted: [string, Record<string, number>][] = []
  for (const [hand, strat] of entries) {
    const actions = Object.keys(strat)
    const isFoldOnly = actions.length === 1 && actions[0] === 'fold' && strat.fold === 1
    if (isFoldOnly) {
      if (Math.random() < 0.40) weighted.push([hand, strat])
    } else {
      weighted.push([hand, strat])
    }
  }
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

// Default postflop strategy when no data is available
const DEFAULT_POSTFLOP_STRATEGY: Record<string, number> = { check: 0.60, bet_75pct: 0.40 }

export default function ChainDrillPage() {
  const { t } = useI18n()
  const preflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'preflop' && s.subCategory === 'rfi')
  const [selectedScenarioId, setSelectedScenarioId] = useState(preflopScenarios[0]?.id ?? '')
  const [sessionActive, setSessionActive] = useState(false)

  // Hand state
  const [heroHand, setHeroHand] = useState('')
  const [heroCards, setHeroCards] = useState<Card[]>([])
  const [boardCards, setBoardCards] = useState<Card[]>([])

  // Current street state
  const [currentStreet, setCurrentStreet] = useState<Street>('preflop')
  const [currentStrategy, setCurrentStrategy] = useState<Record<string, number>>({})
  const [currentCategory, setCurrentCategory] = useState('')
  const [drillState, setDrillState] = useState<'awaiting' | 'revealed'>('awaiting')

  // Results
  const [streetResults, setStreetResults] = useState<StreetResult[]>([])
  const [sessionResults, setSessionResults] = useState<{ totalScore: number; streets: number; hands: number }[]>([])

  // Preflop scenario data reference
  const [preflopData, setPreflopData] = useState<ScenarioData | null>(null)

  const startSession = useCallback(() => {
    const data = getScenarioById(selectedScenarioId)
    if (!data || !isPreflop(data)) return
    setPreflopData(data)
    setSessionActive(true)
    setSessionResults([])
    startNewHand(data)
  }, [selectedScenarioId])

  const startNewHand = useCallback((data?: ScenarioData) => {
    const pldata = data ?? preflopData
    if (!pldata || !isPreflop(pldata)) return

    const hand = generateRandomHand(pldata.hands)
    const strategy = pldata.hands[hand] ?? { fold: 1 }

    setHeroHand(hand)
    setHeroCards(handToCards(hand))
    setBoardCards([])
    setCurrentStreet('preflop')
    setCurrentStrategy(strategy)
    setCurrentCategory('')
    setStreetResults([])
    setDrillState('awaiting')
  }, [preflopData])

  const advanceToNextStreet = useCallback((action: string, strategy: Record<string, number>) => {
    const bestEntry = Object.entries(strategy).sort((a, b) => b[1] - a[1])[0]
    const bestAction = bestEntry[0]
    const bestFreq = bestEntry[1]
    const score = Math.round((strategy[action] ?? 0) * 100)

    const result: StreetResult = {
      street: currentStreet,
      userAction: action,
      bestAction,
      bestFreq,
      score,
      strategy,
    }
    const newResults = [...streetResults, result]
    setStreetResults(newResults)
    setDrillState('revealed')
  }, [currentStreet, streetResults])

  const moveToNextStreet = useCallback(() => {
    const lastResult = streetResults[streetResults.length - 1]
    if (!lastResult) return

    // If user folded, end the hand
    if (lastResult.userAction === 'fold') {
      const totalScore = streetResults.reduce((s, r) => s + r.score, 0)
      setSessionResults((prev) => [...prev, { totalScore, streets: streetResults.length, hands: 1 }])
      return
    }

    const nextStreetMap: Record<Street, Street | null> = {
      preflop: 'flop',
      flop: 'turn',
      turn: 'river',
      river: null,
    }
    const nextStreet = nextStreetMap[currentStreet]
    if (!nextStreet) {
      // Hand complete
      const totalScore = streetResults.reduce((s, r) => s + r.score, 0)
      setSessionResults((prev) => [...prev, { totalScore, streets: streetResults.length, hands: 1 }])
      return
    }

    // Build board for next street
    let newBoard = [...boardCards]
    if (nextStreet === 'flop') {
      newBoard = generateFlopBoard()
    } else {
      newBoard = [...boardCards, addRandomCard(boardCards)]
    }
    setBoardCards(newBoard)

    // Classify hand on new board
    const currentCards = heroCards.length > 0 ? heroCards : handToCards(heroHand)
    const category = classifyHand(currentCards, newBoard)
    setCurrentCategory(category)

    // Look up strategy for next street
    const pfData = findPostflopScenario(nextStreet)
    let strategy: Record<string, number>
    if (pfData) {
      strategy = getStrategyForCategory(pfData, category) ?? DEFAULT_POSTFLOP_STRATEGY
    } else {
      strategy = DEFAULT_POSTFLOP_STRATEGY
    }

    setCurrentStreet(nextStreet)
    setCurrentStrategy(strategy)
    setDrillState('awaiting')
  }, [streetResults, currentStreet, boardCards, heroCards, heroHand])

  const handleAction = useCallback((action: string) => {
    advanceToNextStreet(action, currentStrategy)
  }, [advanceToNextStreet, currentStrategy])

  const endSession = () => {
    setSessionActive(false)
    setSessionResults([])
  }

  const allSessionHands = sessionResults
  const totalSessionScore = allSessionHands.reduce((s, r) => s + r.totalScore, 0)
  const totalSessionStreets = allSessionHands.reduce((s, r) => s + r.streets, 0)
  const avgSessionScore = totalSessionStreets > 0 ? Math.round(totalSessionScore / totalSessionStreets) : 0

  // Scenario selection screen
  if (!sessionActive) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('chain.title')}</h1>
          <p className="text-gray-400 mb-6 md:mb-8">{t('chain.subtitle')}</p>

          <h2 className="text-lg font-semibold text-gray-300 mb-3">{t('chain.select')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
            {preflopScenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedScenarioId(s.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedScenarioId === s.id
                    ? 'bg-red-900/30 border-red-600 ring-1 ring-red-600'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                <span className="text-xs text-gray-500 uppercase">{s.subCategory}</span>
                <h3 className="text-lg font-semibold text-white mt-1">
                  {s.position ? `${s.position} ` : ''}{s.name}
                </h3>
              </button>
            ))}
          </div>

          <button
            onClick={startSession}
            disabled={!selectedScenarioId}
            className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded-lg font-semibold text-base md:text-lg transition-colors"
          >
            {t('chain.start')}
          </button>
        </div>
      </div>
    )
  }

  // Active training session
  const streetLabels: Record<Street, string> = {
    preflop: t('chain.preflop'),
    flop: t('chain.flop'),
    turn: t('chain.turn'),
    river: t('chain.river'),
  }

  const isHandComplete = drillState === 'revealed' && streetResults.length > 0 &&
    (streetResults[streetResults.length - 1].userAction === 'fold' || currentStreet === 'river')

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* Street indicator */}
        <div className="flex items-center gap-2 mb-4">
          {(['preflop', 'flop', 'turn', 'river'] as Street[]).map((s) => {
            const isActive = s === currentStreet
            const isDone = streetResults.some((r) => r.street === s)
            return (
              <div
                key={s}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-red-600 text-white'
                    : isDone
                      ? 'bg-green-800 text-green-300'
                      : 'bg-gray-800 text-gray-500'
                }`}
              >
                {streetLabels[s]}
              </div>
            )
          })}
        </div>

        {/* Board cards (postflop) */}
        {boardCards.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 text-center mb-1">{t('chain.board')}</div>
            <div className="flex gap-2 md:gap-3 justify-center">
              {boardCards.map((card, i) => (
                <CardDisplay key={`board-${i}`} card={card} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Hand category */}
        {currentCategory && currentStreet !== 'preflop' && (
          <div className="text-xs md:text-sm text-gray-400 mb-2">
            {t('trainer.category')}:{' '}
            <span className="text-white font-medium">{CATEGORY_LABELS[currentCategory] ?? currentCategory}</span>
          </div>
        )}

        {/* Hero hand */}
        <div className="flex gap-2 md:gap-3 mb-2">
          {heroCards.map((card, i) => (
            <CardDisplay key={`hero-${i}`} card={card} size="lg" />
          ))}
        </div>
        <div className="text-base md:text-lg text-gray-400 mb-6">
          {t('chain.heroHand')}: <span className="text-white font-mono font-bold text-lg md:text-xl">{heroHand}</span>
        </div>

        {/* Action buttons or revealed state */}
        {drillState === 'awaiting' && !isHandComplete && (
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-3">
              {t('chain.streetDecision')}: <span className="text-white font-semibold">{streetLabels[currentStreet]}</span>
            </div>
            <ActionButtons
              actions={currentStreet === 'preflop'
                ? [...PREFLOP_STANDARD_ACTIONS, ...Object.keys(currentStrategy)].filter((v, i, a) => a.indexOf(v) === i)
                : [...POSTFLOP_STANDARD_ACTIONS, ...Object.keys(currentStrategy)].filter((v, i, a) => a.indexOf(v) === i)
              }
              onSelect={handleAction}
            />
          </div>
        )}

        {drillState === 'revealed' && streetResults.length > 0 && (() => {
          const lastResult = streetResults[streetResults.length - 1]
          const freqScore = lastResult.score
          let feedbackColor: string
          if (freqScore >= 50) feedbackColor = 'text-green-400'
          else if (freqScore >= 25) feedbackColor = 'text-yellow-400'
          else if (freqScore >= 1) feedbackColor = 'text-orange-400'
          else feedbackColor = 'text-red-400'

          return (
            <div className="text-center max-w-lg w-full px-2" aria-live="polite">
              <div className={`text-xl font-bold mb-2 ${feedbackColor}`}>
                {freqScore >= 50 ? t('freq.excellent') : freqScore >= 25 ? t('freq.acceptable') : freqScore >= 1 ? t('freq.highDeviation') : t('freq.error')}
              </div>
              <div className="text-sm text-gray-300 mb-2">
                {t('chain.yourAction')}: <span className="text-white font-bold">{getActionLabel(lastResult.userAction, t)}</span>
                {' '}({lastResult.score}%)
              </div>

              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-2">{t('chain.revealed')}</div>
                <FrequencyBar strategy={lastResult.strategy} userAction={lastResult.userAction} />
              </div>

              {!isHandComplete && (
                <button
                  onClick={moveToNextStreet}
                  className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
                >
                  {t('chain.nextStreet')}
                </button>
              )}

              {isHandComplete && (
                <div className="mt-4">
                  <div className="text-lg font-semibold text-white mb-3">{t('chain.streetBreakdown')}</div>
                  <div className="space-y-2 mb-4">
                    {streetResults.map((r, i) => (
                      <div key={i} className="flex justify-between items-center bg-gray-800 rounded-lg px-4 py-2">
                        <span className="text-gray-300">{streetLabels[r.street]}</span>
                        <span className="text-gray-400">{getActionLabel(r.userAction, t)}</span>
                        <span className={`font-bold ${r.score >= 50 ? 'text-green-400' : r.score >= 25 ? 'text-yellow-400' : 'text-orange-400'}`}>
                          {r.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-lg font-bold text-white mb-4">
                    {t('chain.totalScore')}: {streetResults.reduce((s, r) => s + r.score, 0)} / {streetResults.length * 100}
                  </div>
                  <button
                    onClick={() => startNewHand()}
                    className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
                  >
                    {t('chain.newHand')}
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* Mobile stats toggle */}
        <div className="lg:hidden mt-6 w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('trainer.stats')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">{t('chain.handsPlayed')}</div>
                <div className="text-xl font-bold text-white">{allSessionHands.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">{t('chain.avgScore')}</div>
                <div className="text-xl font-bold text-white">{avgSessionScore}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">{t('chain.cumulativeScore')}</div>
                <div className="text-xl font-bold text-orange-400">{streetResults.reduce((s, r) => s + r.score, 0)}</div>
              </div>
            </div>
            <button
              onClick={endSession}
              className="w-full mt-4 min-h-[44px] px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              {t('chain.endSession')}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 bg-gray-900 border-l border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-6">{t('trainer.stats')}</h3>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-500">{t('chain.handsPlayed')}</div>
            <div className="text-xl font-bold text-white">{allSessionHands.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t('chain.avgScore')}</div>
            <div className="text-xl font-bold text-white">{avgSessionScore}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t('chain.cumulativeScore')}</div>
            <div className="text-xl font-bold text-orange-400">{streetResults.reduce((s, r) => s + r.score, 0)}</div>
          </div>
        </div>

        {/* Current hand street breakdown */}
        {streetResults.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-400 mb-2">{t('chain.streetBreakdown')}</h4>
            <div className="space-y-1">
              {streetResults.map((r, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-400">{streetLabels[r.street]}</span>
                  <span className={`font-mono ${r.score >= 50 ? 'text-green-400' : r.score >= 25 ? 'text-yellow-400' : 'text-orange-400'}`}>
                    {r.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={endSession}
          className="w-full mt-8 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          {t('chain.endSession')}
        </button>
      </div>
    </div>
  )
}
