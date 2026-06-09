import { useState, useCallback } from 'react'
import {
  isPostflop,
  type PostflopScenarioData,
  DATA_REGISTRY,
} from '@/data/index'
import type { Card, Rank, Suit } from '@/types/poker'
import CardDisplay from '@/components/poker/CardDisplay'
import FrequencyBar from '@/components/poker/FrequencyBar'
import { useI18n } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const SUITS_ARR: Suit[] = ['s', 'h', 'd', 'c']

type Street = 'flop' | 'turn' | 'river'

interface StreetChoice {
  street: Street
  userAction: string
  gtoAction: string
  gtoFreq: number
  strategy: Record<string, number>
  boardSnapshot: Card[]
  potSize: number
}

interface PlanResult {
  streets: StreetChoice[]
  totalScore: number
  evAnalysis: string
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

function randomLowRank(): Rank {
  return pickRandom(['6', '5', '4', '3', '2'] as const)
}

function randomMidRank(): Rank {
  return pickRandom(['T', '9', '8', '7'] as const)
}

// ---------------------------------------------------------------------------
// Board generation (supports various textures)
// ---------------------------------------------------------------------------

type BoardTexture = 'dry-high' | 'wet-connected' | 'paired' | 'monochrome'

function generateFlopBoard(texture?: BoardTexture): Card[] {
  const t = texture ?? pickRandom(['dry-high', 'wet-connected', 'paired'] as const)
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
  } else {
    // monochrome
    const suit = pickRandom(SUITS_ARR)
    const r1 = randomHighRank()
    const r2 = randomRankExcluding(r1)
    const r3 = randomRankExcluding(r1, r2)
    flop = [
      { rank: r1, suit },
      { rank: r2, suit },
      { rank: r3, suit },
    ]
  }

  return flop
}

function addNextCard(board: Card[]): Card {
  const usedRanks = board.map((c) => c.rank)
  const rank = randomRankExcluding(...usedRanks)
  return { rank, suit: pickRandom(SUITS_ARR) }
}

// ---------------------------------------------------------------------------
// Hero hand generation (value hands: top pair+, overpair, set, two pair)
// ---------------------------------------------------------------------------

type ValueHandType = 'overpair' | 'topPair_topKicker' | 'topPair_goodKicker' | 'set' | 'twoPair'

function generateValueHand(flop: Card[]): { cards: Card[]; category: ValueHandType } {
  const type = pickRandom(['overpair', 'topPair_topKicker', 'topPair_goodKicker', 'set', 'twoPair'] as const)
  const cards = buildHandForCategory(type, flop)
  return { cards, category: type }
}

function buildHandForCategory(type: ValueHandType, board: Card[]): Card[] {
  const topBoardRank = board[0].rank
  const topIdx = RANKS.indexOf(topBoardRank)
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

  if (type === 'overpair') {
    const overpairRanks = RANKS.slice(0, topIdx)
    const rank = overpairRanks.length > 0 ? pick(overpairRanks) : ('A' as Rank)
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: rank as Rank, suit: s1 },
      { rank: rank as Rank, suit: s2 },
    ]
  }

  if (type === 'topPair_topKicker') {
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: topBoardRank, suit: s1 },
      { rank: 'A' as Rank, suit: s2 },
    ]
  }

  if (type === 'topPair_goodKicker') {
    const kicker = pick(['K', 'Q'] as const)
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: topBoardRank, suit: s1 },
      { rank: kicker, suit: s2 },
    ]
  }

  if (type === 'set') {
    const boardRank = pick(board).rank
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [
      { rank: boardRank, suit: s1 },
      { rank: boardRank, suit: s2 },
    ]
  }

  // twoPair
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

// ---------------------------------------------------------------------------
// Hand classification for later streets
// ---------------------------------------------------------------------------

function classifyOnBoard(heroCards: Card[], board: Card[]): string {
  const heroRanks = heroCards.map((c) => c.rank)
  const boardRanks = board.map((c) => c.rank)
  const topBoardIdx = RANKS.indexOf(board[0].rank)

  const heroPairRank = heroRanks[0] === heroRanks[1] ? heroRanks[0] : null
  if (heroPairRank) {
    const pairIdx = RANKS.indexOf(heroPairRank)
    if (pairIdx < topBoardIdx) return 'overpair'
    if (boardRanks.includes(heroPairRank)) return 'set'
    return 'middlePair'
  }

  const matchRanks = heroRanks.filter((r) => boardRanks.includes(r))
  if (matchRanks.length >= 2) return 'twoPair'
  if (matchRanks.length === 1) {
    const matchRank = matchRanks[0]
    if (matchRank === board[0].rank) {
      const kicker = heroRanks.find((r) => r !== matchRank)!
      const kickerIdx = RANKS.indexOf(kicker)
      if (kickerIdx <= 2) return 'topPair_topKicker'
      if (kickerIdx <= 5) return 'topPair_goodKicker'
      return 'topPair_weakKicker'
    }
    return 'middlePair'
  }

  return 'air'
}

// ---------------------------------------------------------------------------
// Postflop strategy lookup (reuse ChainDrillPage logic)
// ---------------------------------------------------------------------------

function findPostflopScenario(street: Street): PostflopScenarioData | null {
  let candidateIds: string[]
  if (street === 'flop') {
    candidateIds = ['cbet_dry_high', 'cbet_wet_connected', 'cbet_paired', 'cbet_monochrome']
  } else if (street === 'turn') {
    candidateIds = ['turn_brick', 'turn_flush_completing', 'turn_straight_completing', 'turn_overcard', 'turn_paired', 'turn_second_barrel']
  } else {
    candidateIds = ['river_blank', 'river_scary', 'river_paired', 'river_value_bet', 'river_bluff_catch']
  }

  for (const id of candidateIds) {
    const data = DATA_REGISTRY[id]
    if (data && isPostflop(data)) return data as PostflopScenarioData
  }

  for (const [, data] of Object.entries(DATA_REGISTRY)) {
    if (isPostflop(data)) {
      if (street === 'flop' && (data as PostflopScenarioData).scenario?.includes('cbet')) return data as PostflopScenarioData
      if (street === 'turn' && (data as PostflopScenarioData).turnType) return data as PostflopScenarioData
      if (street === 'river' && (data as PostflopScenarioData).riverType) return data as PostflopScenarioData
    }
  }
  return null
}

function getStrategyForCategory(
  data: PostflopScenarioData,
  category: string,
): Record<string, number> {
  if (data.strategy[category]) return data.strategy[category]
  // Try common fallbacks for value hands
  const fallbacks = ['topPair_topKicker', 'topPair_goodKicker', 'overpair', 'set', 'twoPair']
  for (const fb of fallbacks) {
    if (data.strategy[fb]) return data.strategy[fb]
  }
  const first = Object.values(data.strategy)[0]
  return first ?? { check: 0.5, bet_75pct: 0.5 }
}

// ---------------------------------------------------------------------------
// Get best GTO action from strategy
// ---------------------------------------------------------------------------

function getBestAction(strategy: Record<string, number>): { action: string; freq: number } {
  let best = { action: 'check', freq: 0 }
  for (const [action, freq] of Object.entries(strategy)) {
    if (freq > best.freq) best = { action, freq }
  }
  return best
}

function computePotSize(streets: StreetChoice[], startingPot: number): number {
  let pot = startingPot
  for (const s of streets) {
    const action = s.userAction
    if (action.startsWith('bet_')) {
      const pct = parseInt(action.replace('bet_', '').replace('pct', ''), 10) / 100
      const betAmount = Math.round(pot * pct)
      pot += betAmount * 2 // villain calls
    }
  }
  return pot
}

// ---------------------------------------------------------------------------
// Category label helper
// ---------------------------------------------------------------------------

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
  twoPair: '两对 Two Pair',
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

// ---------------------------------------------------------------------------
// Action label helper
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, Record<string, string>> = {
  zh: {
    check: '过牌 Check',
    fold: '弃牌 Fold',
    call: '跟注 Call',
    raise: '加注 Raise',
    bet_33pct: '小注 33%',
    bet_50pct: '半池 50%',
    bet_75pct: '大注 75%',
    bet_100pct: '满池 100%',
  },
  en: {
    check: 'Check',
    fold: 'Fold',
    call: 'Call',
    raise: 'Raise',
    bet_33pct: 'Bet 33%',
    bet_50pct: 'Bet 50%',
    bet_75pct: 'Bet 75%',
    bet_100pct: 'Bet 100%',
  },
}

function getActionLabel(action: string, lang: string): string {
  return ACTION_LABELS[lang]?.[action] ?? action
}

// ---------------------------------------------------------------------------
// Street planning action options (the 3 choices per street)
// ---------------------------------------------------------------------------

interface PlanningOption {
  action: string
  label: string
  description: string
}

function getFlopOptions(t: (k: string) => string): PlanningOption[] {
  return [
    { action: 'bet_33pct', label: t('plan.opt.smallBet'), description: t('plan.opt.smallBetDesc') },
    { action: 'bet_75pct', label: t('plan.opt.largeBet'), description: t('plan.opt.largeBetDesc') },
    { action: 'check', label: t('plan.opt.check'), description: t('plan.opt.checkDesc') },
  ]
}

function getTurnOptions(t: (k: string) => string): PlanningOption[] {
  return [
    { action: 'bet_50pct', label: t('plan.opt.midBet'), description: t('plan.opt.midBetDesc') },
    { action: 'bet_75pct', label: t('plan.opt.largeBet'), description: t('plan.opt.largeBetDesc') },
    { action: 'check', label: t('plan.opt.check'), description: t('plan.opt.checkDesc') },
  ]
}

function getRiverOptions(t: (k: string) => string): PlanningOption[] {
  return [
    { action: 'bet_75pct', label: t('plan.opt.valueBet'), description: t('plan.opt.valueBetDesc') },
    { action: 'bet_100pct', label: t('plan.opt.potBet'), description: t('plan.opt.potBetDesc') },
    { action: 'check', label: t('plan.opt.check'), description: t('plan.opt.checkDesc') },
  ]
}

// ---------------------------------------------------------------------------
// EV / Plan evaluation
// ---------------------------------------------------------------------------

function evaluatePlan(streets: StreetChoice[], t: (k: string) => string): { score: number; analysis: string } {
  let totalScore = 0
  for (const s of streets) {
    const freq = s.strategy[s.userAction] ?? 0
    totalScore += Math.round(freq * 100)
  }
  const avgScore = Math.round(totalScore / streets.length)

  let analysis: string
  if (avgScore >= 70) {
    analysis = t('plan.eval.excellent')
  } else if (avgScore >= 50) {
    analysis = t('plan.eval.good')
  } else if (avgScore >= 30) {
    analysis = t('plan.eval.ok')
  } else {
    analysis = t('plan.eval.poor')
  }

  return { score: avgScore, analysis }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StreetPlanningPage() {
  const { t, lang } = useI18n()

  // Session state
  const [sessionActive, setSessionActive] = useState(false)
  const [currentStreet, setCurrentStreet] = useState<Street>('flop')
  const [showResult, setShowResult] = useState(false)

  // Hand state
  const [heroCards, setHeroCards] = useState<Card[]>([])
  const [heroCategory, setHeroCategory] = useState('')
  const [flopCards, setFlopCards] = useState<Card[]>([])
  const [turnCard, setTurnCard] = useState<Card | null>(null)
  const [riverCard, setRiverCard] = useState<Card | null>(null)

  // Strategy state
  const [flopStrategy, setFlopStrategy] = useState<Record<string, number>>({})
  const [turnStrategy, setTurnStrategy] = useState<Record<string, number>>({})
  const [riverStrategy, setRiverStrategy] = useState<Record<string, number>>({})

  // Results
  const [choices, setChoices] = useState<StreetChoice[]>([])
  const [sessionResults, setSessionResults] = useState<PlanResult[]>([])

  // Street labels
  const streetLabels: Record<Street, string> = {
    flop: t('plan.flop'),
    turn: t('plan.turn'),
    river: t('plan.river'),
  }

  // Generate a new scenario
  const startNewScenario = useCallback(() => {
    const flop = generateFlopBoard()
    const { cards, category } = generateValueHand(flop)
    const turn = addNextCard(flop)
    const river = addNextCard([...flop, turn])

    // Get strategies for each street
    const flopPfData = findPostflopScenario('flop')
    const turnPfData = findPostflopScenario('turn')
    const riverPfData = findPostflopScenario('river')

    const flopStrat = flopPfData ? getStrategyForCategory(flopPfData, category) : { check: 0.4, bet_33pct: 0.35, bet_75pct: 0.25 }

    // For turn and river, classify based on the board so far
    const turnBoard = [...flop, turn]
    const turnCategory = classifyOnBoard(cards, turnBoard)
    const turnStrat = turnPfData ? getStrategyForCategory(turnPfData, turnCategory) : { check: 0.5, bet_50pct: 0.25, bet_75pct: 0.25 }

    const riverBoard = [...flop, turn, river]
    const riverCategory = classifyOnBoard(cards, riverBoard)
    const riverStrat = riverPfData ? getStrategyForCategory(riverPfData, riverCategory) : { check: 0.4, bet_75pct: 0.35, bet_100pct: 0.25 }

    setFlopCards(flop)
    setTurnCard(turn)
    setRiverCard(river)
    setHeroCards(cards)
    setHeroCategory(category)
    setFlopStrategy(flopStrat)
    setTurnStrategy(turnStrat)
    setRiverStrategy(riverStrat)
    setCurrentStreet('flop')
    setChoices([])
    setShowResult(false)
  }, [])

  const handleStart = () => {
    setSessionActive(true)
    setSessionResults([])
    startNewScenario()
  }

  const handleAction = (action: string) => {
    const boardSnapshot = currentStreet === 'flop'
      ? [...flopCards]
      : currentStreet === 'turn'
        ? [...flopCards, turnCard!]
        : [...flopCards, turnCard!, riverCard!]

    const strategy = currentStreet === 'flop' ? flopStrategy : currentStreet === 'turn' ? turnStrategy : riverStrategy
    const best = getBestAction(strategy)

    // Compute pot at this point
    const basePot = 10
    const prevPot = computePotSize(choices, basePot)

    const choice: StreetChoice = {
      street: currentStreet,
      userAction: action,
      gtoAction: best.action,
      gtoFreq: best.freq,
      strategy,
      boardSnapshot,
      potSize: prevPot,
    }
    const newChoices = [...choices, choice]
    setChoices(newChoices)
    setShowResult(true)
  }

  const handleNext = () => {
    setShowResult(false)
    if (currentStreet === 'flop') {
      setCurrentStreet('turn')
    } else if (currentStreet === 'turn') {
      setCurrentStreet('river')
    } else {
      // All streets done - record result
      const allChoices = choices // already includes river
      const { score, analysis } = evaluatePlan(allChoices, t)

      const result: PlanResult = {
        streets: allChoices,
        totalScore: score,
        evAnalysis: analysis,
      }
      setSessionResults((prev) => [...prev, result])
      setSessionActive(false)
    }
  }

  // Current options for the active street
  const currentOptions = currentStreet === 'flop'
    ? getFlopOptions(t)
    : currentStreet === 'turn'
      ? getTurnOptions(t)
      : getRiverOptions(t)

  // Latest choice for result display
  const latestChoice = choices.length > 0 ? choices[choices.length - 1] : null

  // Results summary
  const allSessionResults = sessionResults
  const totalSessions = allSessionResults.length
  const avgScore = totalSessions > 0
    ? Math.round(allSessionResults.reduce((s, r) => s + r.totalScore, 0) / totalSessions)
    : 0

  // -----------------------------------------------------------------------
  // Results screen (between scenarios)
  // -----------------------------------------------------------------------
  if (!sessionActive && sessionResults.length > 0) {
    const lastResult = sessionResults[sessionResults.length - 1]
    const finalPot = computePotSize(lastResult.streets, 10)

    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('plan.title')}</h1>
          <p className="text-gray-400 mb-6 md:mb-8">{t('plan.subtitle')}</p>

          {/* Last result */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{t('plan.completePlan')}</h2>
              <div className={`text-2xl font-bold ${lastResult.totalScore >= 70 ? 'text-green-400' : lastResult.totalScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {lastResult.totalScore}%
              </div>
            </div>

            {/* Board + hero */}
            <div className="flex flex-col items-center mb-4">
              <div className="flex gap-1 md:gap-2 mb-2">
                {lastResult.streets[0].boardSnapshot.map((card, i) => (
                  <CardDisplay key={`board-${i}`} card={card} size="sm" />
                ))}
                {lastResult.streets.length > 1 && lastResult.streets[1].boardSnapshot.length > 3 && (
                  <CardDisplay card={lastResult.streets[1].boardSnapshot[3]} size="sm" />
                )}
                {lastResult.streets.length > 2 && lastResult.streets[2].boardSnapshot.length > 4 && (
                  <CardDisplay card={lastResult.streets[2].boardSnapshot[4]} size="sm" />
                )}
              </div>
              <div className="flex gap-1 md:gap-2">
                {heroCards.map((card, i) => (
                  <CardDisplay key={`hero-${i}`} card={card} size="sm" />
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">{getCategoryLabel(heroCategory)}</div>
            </div>

            {/* Street-by-street comparison */}
            <div className="space-y-3 mb-4">
              {lastResult.streets.map((s, i) => {
                const freq = s.strategy[s.userAction] ?? 0
                const score = Math.round(freq * 100)
                const isMatch = s.userAction === s.gtoAction
                return (
                  <div key={i} className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-300">{streetLabels[s.street]}</span>
                      <span className={`text-xs font-bold ${score >= 50 ? 'text-green-400' : score >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {score}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">{t('plan.yourPlan')}: </span>
                        <span className={isMatch ? 'text-green-400 font-bold' : 'text-white font-bold'}>
                          {getActionLabel(s.userAction, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">{t('plan.gtoRecommend')}: </span>
                        <span className="text-green-400 font-bold">
                          {getActionLabel(s.gtoAction, lang)} ({Math.round(s.gtoFreq * 100)}%)
                        </span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <FrequencyBar strategy={s.strategy} userAction={s.userAction} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* EV Analysis */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('plan.evAnalysis')}</div>
              <div className="text-sm text-gray-300">{lastResult.evAnalysis}</div>
              <div className="text-xs text-gray-500 mt-2">
                {t('plan.finalPot')}: <span className="text-white font-bold">${finalPot}</span>
                {' '}({t('plan.startingPot')}: $10)
              </div>
            </div>

            {/* Concept explanations */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t('plan.concepts')}</div>
              <div className="space-y-2 text-xs text-gray-400">
                <div><span className="text-purple-400 font-medium">{t('plan.concept.thinValue')}:</span> {t('plan.concept.thinValueDesc')}</div>
                <div><span className="text-blue-400 font-medium">{t('plan.concept.potControl')}:</span> {t('plan.concept.potControlDesc')}</div>
                <div><span className="text-orange-400 font-medium">{t('plan.concept.buildPot')}:</span> {t('plan.concept.buildPotDesc')}</div>
                <div><span className="text-yellow-400 font-medium">{t('plan.concept.changing')}:</span> {t('plan.concept.changingDesc')}</div>
              </div>
            </div>
          </div>

          {/* Session stats */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('trainer.stats')}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500">{t('plan.handsPlayed')}</div>
                <div className="text-xl font-bold text-white">{totalSessions}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">{t('plan.avgScore')}</div>
                <div className={`text-xl font-bold ${avgScore >= 70 ? 'text-green-400' : avgScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {avgScore}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">{t('plan.bestScore')}</div>
                <div className="text-xl font-bold text-yellow-400">
                  {Math.max(...allSessionResults.map((r) => r.totalScore))}%
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setSessionActive(true); startNewScenario() }}
              className="min-h-[44px] px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors"
            >
              {t('plan.nextScenario')}
            </button>
            <button
              onClick={() => { setSessionResults([]); setSessionActive(false) }}
              className="min-h-[44px] px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              {t('plan.backToSetup')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Setup screen
  // -----------------------------------------------------------------------
  if (!sessionActive) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('plan.title')}</h1>
          <p className="text-gray-400 mb-4">{t('plan.subtitle')}</p>

          {/* Key concepts */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h2 className="text-base font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              {t('plan.concepts')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm font-medium text-purple-400 mb-1">{t('plan.concept.thinValue')}</div>
                <div className="text-xs text-gray-400">{t('plan.concept.thinValueDesc')}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm font-medium text-blue-400 mb-1">{t('plan.concept.potControl')}</div>
                <div className="text-xs text-gray-400">{t('plan.concept.potControlDesc')}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm font-medium text-orange-400 mb-1">{t('plan.concept.buildPot')}</div>
                <div className="text-xs text-gray-400">{t('plan.concept.buildPotDesc')}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm font-medium text-yellow-400 mb-1">{t('plan.concept.changing')}</div>
                <div className="text-xs text-gray-400">{t('plan.concept.changingDesc')}</div>
              </div>
            </div>
          </div>

          {/* Flow description */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
            <h2 className="text-base font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              {t('plan.howItWorks')}
            </h2>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">1.</span>
                <span>{t('plan.step1')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">2.</span>
                <span>{t('plan.step2')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">3.</span>
                <span>{t('plan.step3')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">4.</span>
                <span>{t('plan.step4')}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            className="min-h-[44px] px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-base md:text-lg transition-colors"
          >
            {t('plan.startTraining')}
          </button>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Active training
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* Street progress indicator */}
        <div className="flex items-center gap-2 mb-4">
          {(['flop', 'turn', 'river'] as Street[]).map((s) => {
            const isActive = s === currentStreet
            const isDone = choices.some((c) => c.street === s)
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white'
                      : isDone
                        ? 'bg-green-800 text-green-300'
                        : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {streetLabels[s]}
                </div>
                {s !== 'river' && (
                  <div className={`w-6 h-px ${isDone ? 'bg-green-700' : 'bg-gray-700'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Board cards - reveal based on street */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 text-center mb-1">{t('trainer.board')}</div>
          <div className="flex gap-2 md:gap-3 justify-center">
            {flopCards.map((card, i) => (
              <CardDisplay key={`flop-${i}`} card={card} size="md" />
            ))}
            {currentStreet !== 'flop' && turnCard && (
              <CardDisplay card={turnCard} size="md" />
            )}
            {currentStreet === 'river' && riverCard && (
              <CardDisplay card={riverCard} size="md" />
            )}
            {currentStreet === 'flop' && (
              <>
                <CardDisplay card={{ rank: 'A', suit: 's' }} size="md" faceDown />
                <CardDisplay card={{ rank: 'A', suit: 's' }} size="md" faceDown />
              </>
            )}
            {currentStreet === 'turn' && (
              <CardDisplay card={{ rank: 'A', suit: 's' }} size="md" faceDown />
            )}
          </div>
        </div>

        {/* Hero hand */}
        <div className="flex gap-2 md:gap-3 mb-2">
          {heroCards.map((card, i) => (
            <CardDisplay key={`hero-${i}`} card={card} size="lg" />
          ))}
        </div>
        <div className="text-xs md:text-sm text-gray-400 mb-1">
          {t('trainer.category')}:{' '}
          <span className="text-white font-medium">{getCategoryLabel(heroCategory)}</span>
        </div>
        <div className="text-base md:text-lg text-gray-400 mb-6">
          {t('trainer.hand')}:{' '}
          <span className="text-white font-mono font-bold text-lg md:text-xl">
            {heroCards.map((c) => `${c.rank}${c.suit}`).join('')}
          </span>
        </div>

        {/* Action selection or result */}
        {!showResult && (
          <div className="text-center w-full max-w-lg">
            <div className="text-sm text-gray-400 mb-4">
              {t('plan.choosePlan')}: <span className="text-white font-semibold">{streetLabels[currentStreet]}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {currentOptions.map((opt) => {
                const isCheck = opt.action === 'check'
                const color = isCheck
                  ? 'bg-gray-700 hover:bg-gray-600 border-gray-600'
                  : 'bg-teal-700 hover:bg-teal-600 border-teal-500'
                return (
                  <button
                    key={opt.action}
                    onClick={() => handleAction(opt.action)}
                    className={`relative rounded-xl border px-4 py-5 text-white font-bold transition-all min-h-[44px] ${color}`}
                  >
                    <div className="text-base">{opt.label}</div>
                    <div className="text-xs text-gray-300 mt-1">{opt.description}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {showResult && latestChoice && (() => {
          const freq = latestChoice.strategy[latestChoice.userAction] ?? 0
          const score = Math.round(freq * 100)
          const isMatch = latestChoice.userAction === latestChoice.gtoAction
          let feedbackColor: string
          if (score >= 50) feedbackColor = 'text-green-400'
          else if (score >= 25) feedbackColor = 'text-yellow-400'
          else if (score >= 1) feedbackColor = 'text-orange-400'
          else feedbackColor = 'text-red-400'

          return (
            <div className="text-center max-w-lg w-full px-2" aria-live="polite" role="status">
              <div className={`text-xl md:text-2xl font-bold mb-3 ${feedbackColor}`}>
                {score >= 50 ? t('freq.excellent') : score >= 25 ? t('freq.acceptable') : score >= 1 ? t('freq.highDeviation') : t('freq.error')}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-gray-500 text-xs mb-1">{t('plan.yourPlan')}</div>
                  <div className={isMatch ? 'text-green-400 font-bold' : 'text-white font-bold'}>
                    {getActionLabel(latestChoice.userAction, lang)}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-gray-500 text-xs mb-1">{t('plan.gtoRecommend')}</div>
                  <div className="text-green-400 font-bold">
                    {getActionLabel(latestChoice.gtoAction, lang)} ({Math.round(latestChoice.gtoFreq * 100)}%)
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <FrequencyBar strategy={latestChoice.strategy} userAction={latestChoice.userAction} />
              </div>

              {/* Pot size tracking */}
              <div className="text-xs text-gray-500 mb-4">
                {t('plan.currentPot')}: <span className="text-white font-bold">${computePotSize(choices, 10)}</span>
              </div>

              <button
                onClick={handleNext}
                className="min-h-[44px] px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-semibold transition-colors"
              >
                {currentStreet === 'river' ? t('plan.viewResults') : t('plan.nextStreet')}
              </button>
            </div>
          )
        })()}

        {/* Mobile stats */}
        <div className="lg:hidden mt-6 w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('plan.progress')}</h3>
            <div className="space-y-2">
              {choices.map((c, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">{streetLabels[c.street]}</span>
                  <span className="text-white font-mono">{getActionLabel(c.userAction, lang)}</span>
                </div>
              ))}
              {choices.length === 0 && (
                <div className="text-xs text-gray-500">{t('plan.noChoicesYet')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 bg-gray-900 border-l border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('plan.progress')}</h3>

        <div className="space-y-3 mb-6">
          {choices.map((c, i) => {
            const score = Math.round((c.strategy[c.userAction] ?? 0) * 100)
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{streetLabels[c.street]}</span>
                  <span className={`font-mono font-bold ${score >= 50 ? 'text-green-400' : score >= 25 ? 'text-yellow-400' : 'text-orange-400'}`}>
                    {score}%
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {getActionLabel(c.userAction, lang)}
                  {c.userAction !== c.gtoAction && (
                    <span className="text-gray-600"> (GTO: {getActionLabel(c.gtoAction, lang)})</span>
                  )}
                </div>
              </div>
            )
          })}
          {choices.length === 0 && (
            <div className="text-xs text-gray-500">{t('plan.noChoicesYet')}</div>
          )}
        </div>

        {/* Pot tracking */}
        {choices.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-gray-500">{t('plan.currentPot')}</div>
            <div className="text-xl font-bold text-teal-400">${computePotSize(choices, 10)}</div>
          </div>
        )}

        <button
          onClick={() => { setSessionActive(false) }}
          className="w-full mt-8 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          {t('trainer.end')}
        </button>
      </div>
    </div>
  )
}
