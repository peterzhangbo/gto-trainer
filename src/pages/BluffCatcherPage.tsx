import { useState, useCallback } from 'react'
import type { Card, Rank, Suit } from '@/types/poker'
import CardDisplay from '@/components/poker/CardDisplay'
import FrequencyBar from '@/components/poker/FrequencyBar'
import { useI18n } from '@/lib/i18n'
import { getScenarioById, isPostflop, type PostflopScenarioData } from '@/data/index'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const SUITS_ARR: Suit[] = ['s', 'h', 'd', 'c']

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomRankExcluding(...excluded: Rank[]): Rank {
  const pool = RANKS.filter((r) => !excluded.includes(r))
  return pickRandom(pool)
}

// Bluff catcher categories: medium-strength hands that beat bluffs but lose to value
const BLUFF_CATCHER_CATEGORIES = [
  'topPair_weak_kicker',
  'middlePair',
  'bottomPair',
] as const

type BluffCatcherCategory = typeof BLUFF_CATCHER_CATEGORIES[number]

const CATEGORY_LABELS: Record<string, string> = {
  topPair_weak_kicker: '顶对弱踢脚 Top Pair Weak Kicker',
  middlePair: '中对 Middle Pair',
  bottomPair: '底对 Bottom Pair',
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

// River bluff-catch scenario (facing 75% pot bet)
const RIVER_BLUFF_CATCH_ID = 'river_bluff_catch'

function getRiverBluffCatchData(): PostflopScenarioData | null {
  const data = getScenarioById(RIVER_BLUFF_CATCH_ID)
  if (!data || !isPostflop(data)) return null
  return data as PostflopScenarioData
}

// ---------------------------------------------------------------------------
// Board generation
// ---------------------------------------------------------------------------

function generateRiverBoard(): Card[] {
  const high = pickRandom(['A', 'K', 'Q', 'J'] as const)
  const mid = pickRandom(['9', '8', '7', '6'] as const)
  const low = pickRandom(['5', '4', '3', '2'] as const)
  const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
  const flop: Card[] = [
    { rank: high, suit: shuffled[0] },
    { rank: mid, suit: shuffled[1] },
    { rank: low, suit: shuffled[2] },
  ]

  const turnRank = randomRankExcluding(high, mid, low)
  const riverRank = randomRankExcluding(high, mid, low, turnRank)

  return [
    ...flop,
    { rank: turnRank, suit: pickRandom(SUITS_ARR) },
    { rank: riverRank, suit: pickRandom(SUITS_ARR) },
  ]
}

// ---------------------------------------------------------------------------
// Hand generation for bluff catchers
// ---------------------------------------------------------------------------

function generateBluffCatcherHand(
  category: BluffCatcherCategory,
  board: Card[],
): Card[] {
  const boardRanks = board.map((c) => c.rank)
  const topBoardRank = board[0].rank
  const midBoardRank = board[1].rank
  const lowBoardRank = board[board.length - 1].rank

  const s1 = pickRandom(SUITS_ARR)
  let s2: Suit
  do { s2 = pickRandom(SUITS_ARR) } while (s2 === s1)

  if (category === 'topPair_weak_kicker') {
    // Pair the top card with a weak kicker (not A or K)
    const weakKickers: Rank[] = ['Q', 'J', 'T', '9', '8', '7']
    const kickerRank = weakKickers.filter((r) => !boardRanks.includes(r))
    const kicker = kickerRank.length > 0 ? pickRandom(kickerRank) : pickRandom(['J', 'T'] as const)
    return [
      { rank: topBoardRank, suit: s1 },
      { rank: kicker, suit: s2 },
    ]
  }

  if (category === 'middlePair') {
    // Pair the second-highest board card
    const kicker = randomRankExcluding(midBoardRank, topBoardRank, ...boardRanks)
    return [
      { rank: midBoardRank, suit: s1 },
      { rank: kicker, suit: s2 },
    ]
  }

  // bottomPair
  const kicker = randomRankExcluding(lowBoardRank, ...boardRanks)
  return [
    { rank: lowBoardRank, suit: s1 },
    { rank: kicker, suit: s2 },
  ]
}

// ---------------------------------------------------------------------------
// Concepts explanation
// ---------------------------------------------------------------------------

function getBluffCatcherExplanation(
  category: string,
  t: (k: string) => string,
): string {
  if (category === 'topPair_weak_kicker') {
    return t('bluff.explain.topPairWeak')
  }
  if (category === 'middlePair') {
    return t('bluff.explain.middlePair')
  }
  if (category === 'bottomPair') {
    return t('bluff.explain.bottomPair')
  }
  return t('bluff.explain.default')
}

function getFoldEvenAsBluffCatcherExplanation(t: (k: string) => string): string {
  return t('bluff.explain.foldEvenBluffCatcher')
}

// ---------------------------------------------------------------------------
// GTO correct answer determination
// ---------------------------------------------------------------------------

function getGTOAction(
  categoryStrategy: Record<string, number>,
  category: string,
): 'call' | 'fold' {
  // categoryStrategy is already the strategy for the specific category
  // e.g. { call: 0.4, fold: 0.5, raise: 0.1 }
  const callFreq = categoryStrategy.call ?? 0
  const foldFreq = categoryStrategy.fold ?? 0
  if (callFreq === 0 && foldFreq === 0) {
    // Fallback: medium-strength hands typically call more than fold
    if (category === 'topPair_weak_kicker') return 'call'
    if (category === 'middlePair') return 'fold'
    return 'fold' // bottomPair
  }
  return callFreq >= foldFreq ? 'call' : 'fold'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BluffCatcherPage() {
  const { t } = useI18n()

  const riverData = getRiverBluffCatchData()

  // Session state
  const [sessionActive, setSessionActive] = useState(false)
  const [boardCards, setBoardCards] = useState<Card[]>([])
  const [heroCards, setHeroCards] = useState<Card[]>([])
  const [currentHand, setCurrentHand] = useState('')
  const [handCategory, setHandCategory] = useState<BluffCatcherCategory>('middlePair')
  const [currentStrategy, setCurrentStrategy] = useState<Record<string, number>>({})
  const [drillState, setDrillState] = useState<'awaiting' | 'revealed'>('awaiting')
  const [lastResult, setLastResult] = useState<{
    userAction: string
    bestAction: 'call' | 'fold'
    isCorrect: boolean
  } | null>(null)
  const [results, setResults] = useState<{ isCorrect: boolean }[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [showMobileStats, setShowMobileStats] = useState(false)

  const generateDrill = useCallback(() => {
    const data = riverData
    if (!data) return

    const category = pickRandom(BLUFF_CATCHER_CATEGORIES)
    const board = generateRiverBoard()
    const heroHand = generateBluffCatcherHand(category, board)
    const handStr = `${heroHand[0].rank}${heroHand[0].suit}${heroHand[1].rank}${heroHand[1].suit}`

    // Get the strategy for this category from the bluff-catch data
    const strategy = data.strategy[category] ?? { call: 0.5, fold: 0.5 }

    setBoardCards(board)
    setHeroCards(heroHand)
    setCurrentHand(handStr)
    setHandCategory(category)
    setCurrentStrategy(strategy)
    setDrillState('awaiting')
    setLastResult(null)
  }, [riverData])

  const handleStart = () => {
    setSessionActive(true)
    setResults([])
    setStreak(0)
    setBestStreak(0)
    generateDrill()
  }

  const handleAction = (action: 'call' | 'fold') => {
    const bestAction = getGTOAction(currentStrategy, handCategory)
    const isCorrect = action === bestAction

    setLastResult({ userAction: action, bestAction, isCorrect })
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

    setDrillState('revealed')
  }

  const endSession = () => {
    setSessionActive(false)
  }

  const totalHands = results.length
  const correctHands = results.filter((r) => r.isCorrect).length
  const accuracy = totalHands > 0 ? (correctHands / totalHands) * 100 : 0

  // Pot odds for 75% pot bet: bet = 0.75 * pot => need to call 0.75 to win 1.75
  // Equity needed = 0.75 / (1 + 0.75 + 0.75) = 0.75 / 2.5 = 30%
  const potOddsPct = 30
  // MDF: 1 - (bet / (bet + pot)) = 1 - (0.75 / 1.75) = 57.14%
  const mdfPct = 57

  // ---- Setup screen ----
  if (!sessionActive) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {t('bluff.title')}
          </h1>
          <p className="text-gray-400 mb-4">{t('bluff.subtitle')}</p>

          {/* Key concepts */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 mb-6 md:mb-8">
            <h2 className="text-base font-semibold text-white mb-3">
              {t('bluff.conceptsTitle')}
            </h2>
            <div className="space-y-4 text-sm text-gray-400">
              <div className="flex gap-2">
                <span className="text-red-400 font-bold shrink-0">1.</span>
                <span>{t('bluff.concept1')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-400 font-bold shrink-0">2.</span>
                <span>{t('bluff.concept2')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-yellow-400 font-bold shrink-0">3.</span>
                <span>{t('bluff.concept3')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-purple-400 font-bold shrink-0">4.</span>
                <span>{t('bluff.concept4')}</span>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 mb-6 md:mb-8">
            <h2 className="text-base font-semibold text-white mb-3">
              {t('bluff.howItWorks')}
            </h2>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0">1.</span>
                <span>{t('bluff.step1')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0">2.</span>
                <span>{t('bluff.step2')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0">3.</span>
                <span>{t('bluff.step3')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0">4.</span>
                <span>{t('bluff.step4')}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded-lg font-semibold text-base md:text-lg transition-colors"
          >
            {t('bluff.startTraining')}
          </button>
        </div>
      </div>
    )
  }

  // ---- Active session ----
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* Scenario label */}
        <div className="text-xs md:text-sm text-gray-500 mb-4 uppercase tracking-wider">
          {t('bluff.riverScenario')}
        </div>

        {/* Villain action */}
        <div className="bg-orange-900/30 border border-orange-700/50 rounded-lg px-4 py-2 mb-4 text-sm text-orange-300">
          {t('bluff.villainBets')}
        </div>

        {/* Board cards */}
        {boardCards.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 text-center mb-1">{t('trainer.board')}</div>
            <div className="flex gap-2 md:gap-3 justify-center">
              {boardCards.map((card, i) => (
                <CardDisplay key={`board-${i}`} card={card} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Hand category */}
        <div className="text-xs md:text-sm text-gray-400 mb-2">
          {t('trainer.category')}:{' '}
          <span className="text-white font-medium">{getCategoryLabel(handCategory)}</span>
        </div>

        {/* Hero hand */}
        <div className="flex gap-2 md:gap-3 mb-4 md:mb-6">
          {heroCards.map((card, i) => (
            <CardDisplay key={`hero-${i}`} card={card} size="lg" />
          ))}
        </div>

        <div className="text-base md:text-lg text-gray-400 mb-6 md:mb-8">
          {t('trainer.hand')}:{' '}
          <span className="text-white font-mono font-bold text-lg md:text-xl">
            {currentHand}
          </span>
        </div>

        {/* Action buttons (awaiting) */}
        {drillState === 'awaiting' && (
          <div className="text-center w-full max-w-lg">
            <div className="text-sm text-gray-400 mb-4">{t('bluff.chooseAction')}</div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAction('call')}
                className="rounded-xl border border-blue-500 bg-blue-700 hover:bg-blue-600 px-6 py-5 text-white font-bold transition-all min-h-[44px]"
              >
                <div className="text-lg md:text-xl">{t('trainer.call')}</div>
              </button>
              <button
                onClick={() => handleAction('fold')}
                className="rounded-xl border border-gray-600 bg-gray-700 hover:bg-gray-600 px-6 py-5 text-white font-bold transition-all min-h-[44px]"
              >
                <div className="text-lg md:text-xl">{t('trainer.fold')}</div>
              </button>
            </div>
          </div>
        )}

        {/* Revealed state */}
        {drillState === 'revealed' && lastResult && (
          <div className="text-center max-w-lg w-full px-2" aria-live="polite" role="status">
            <div
              className={`text-xl md:text-2xl font-bold mb-4 ${
                lastResult.isCorrect ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {lastResult.isCorrect ? t('trainer.correct') : t('trainer.wrong')}
            </div>

            {/* User choice vs best action */}
            <div className="text-sm md:text-base text-gray-300 mb-1">
              {t('trainer.yourChoice')}:{' '}
              <span className="text-white font-bold">
                {lastResult.userAction === 'call' ? t('trainer.call') : t('trainer.fold')}
              </span>
            </div>
            <div className="mb-4 text-sm text-gray-400">
              {t('trainer.bestAction')}:{' '}
              <span className="text-green-400 font-bold">
                {lastResult.bestAction === 'call' ? t('trainer.call') : t('trainer.fold')}
              </span>
            </div>

            {/* Frequency breakdown */}
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-2">{t('bluff.gtoFrequencies')}</div>
              <FrequencyBar
                strategy={currentStrategy}
                userAction={lastResult.userAction}
              />
            </div>

            {/* Bluff catcher concept */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 text-left">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                {t('bluff.bluffCatcherLabel')}
              </div>
              <div className="text-sm text-gray-300">
                {t('bluff.bluffCatcherDef')}
              </div>
            </div>

            {/* Pot odds */}
            <div className="bg-gray-900 border border-blue-900/50 rounded-xl p-4 mb-4 text-left">
              <div className="text-xs text-blue-400 uppercase tracking-wider mb-1">
                {t('bluff.potOddsLabel')}
              </div>
              <div className="text-sm text-gray-300 mb-1">
                {t('bluff.potOddsDesc').replace('{pct}', String(potOddsPct))}
              </div>
              <div className="text-xs text-gray-500">
                {t('bluff.potOddsFormula')}
              </div>
            </div>

            {/* MDF */}
            <div className="bg-gray-900 border border-yellow-900/50 rounded-xl p-4 mb-4 text-left">
              <div className="text-xs text-yellow-400 uppercase tracking-wider mb-1">
                {t('bluff.mdfLabel')}
              </div>
              <div className="text-sm text-gray-300 mb-1">
                {t('bluff.mdfDesc').replace('{pct}', String(mdfPct))}
              </div>
              <div className="text-xs text-gray-500">
                {t('bluff.mdfFormula')}
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 text-left">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                {t('bluff.explanationLabel')}
              </div>
              <div className="text-sm text-gray-300">
                {getBluffCatcherExplanation(handCategory, t)}
              </div>
            </div>

            {/* When to fold even as bluff catcher */}
            <div className="bg-gray-900 border border-red-900/50 rounded-xl p-4 mb-6 text-left">
              <div className="text-xs text-red-400 uppercase tracking-wider mb-1">
                {t('bluff.foldWarning')}
              </div>
              <div className="text-sm text-gray-300">
                {getFoldEvenAsBluffCatcherExplanation(t)}
              </div>
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

        {showMobileStats && (
          <div className="lg:hidden w-full max-w-md mt-4 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('trainer.stats')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <StatItem label={t('trainer.hands')} value={totalHands} />
              <StatItem label={t('trainer.accuracy')} value={`${accuracy.toFixed(1)}%`} />
              <StatItem label={t('trainer.streak')} value={streak} highlight="red" />
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
          <StatItem label={t('trainer.streak')} value={streak} highlight="red" />
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

function StatItem({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | number
  highlight?: 'red' | 'yellow' | 'purple'
}) {
  const colorClass =
    highlight === 'red'
      ? 'text-red-400'
      : highlight === 'yellow'
        ? 'text-yellow-400'
        : highlight === 'purple'
          ? 'text-purple-400'
          : 'text-white'
  return (
    <div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  )
}
