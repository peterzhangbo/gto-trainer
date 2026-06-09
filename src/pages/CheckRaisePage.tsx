import { useState, useCallback, useMemo } from 'react'
import {
  getAllScenarios,
  getScenarioById,
  isPostflop,
  type PostflopScenarioData,
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

const CATEGORY_LABELS: Record<string, string> = {
  set: '暗三 Set',
  twoPair: '两对 Two Pair',
  topPair_topKicker: '顶对好踢脚 Top Pair Best Kicker',
  middlePair: '中对 Middle Pair',
  flushDraw: '同花听牌 Flush Draw',
  oesd: '两头顺听牌 OESD',
  gutshot: '卡顺听牌 Gutshot',
  comboDraw: '组合听牌 Combo Draw',
  air: '空气 Air',
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

// Sizing explanation helpers
function getCheckRaiseExplanation(
  category: string,
  bestAction: string,
  t: (k: string) => string,
): string {
  const isValue = category === 'set' || category === 'twoPair'
  const isDraw = category === 'flushDraw' || category === 'oesd' || category === 'comboDraw' || category === 'gutshot'
  const isMade = category.startsWith('topPair') || category === 'middlePair'

  if (bestAction === 'fold') {
    return t('checkRaise.explain.fold')
  }
  if (bestAction === 'call') {
    if (isDraw) return t('checkRaise.explain.callDraw')
    if (isMade) return t('checkRaise.explain.callMade')
    return t('checkRaise.explain.callDefault')
  }
  // raise
  if (bestAction === 'raise') {
    if (isValue) return t('checkRaise.explain.raiseValue')
    if (isDraw) return t('checkRaise.explain.raiseBluff')
    return t('checkRaise.explain.raiseDefault')
  }
  return t('checkRaise.explain.default')
}

function getSizingExplanation(
  category: string,
  t: (k: string) => string,
): string {
  const isValue = category === 'set' || category === 'twoPair'
  const isDraw = category === 'flushDraw' || category === 'oesd' || category === 'comboDraw' || category === 'gutshot'
  if (isValue) return t('checkRaise.explain.sizingValue')
  if (isDraw) return t('checkRaise.explain.sizingBluff')
  return t('checkRaise.explain.sizingDefault')
}

// ---------------------------------------------------------------------------
// Board generation
// ---------------------------------------------------------------------------

function generateBoardByTexture(numCards: number, boardTexture?: string): Card[] {
  const tex = boardTexture ?? 'dry-high'
  let flop: Card[]

  if (tex === 'dry-high') {
    const high = randomHighRank()
    const low1 = randomLowRank()
    const low2 = randomLowRank()
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: high, suit: shuffled[0] },
      { rank: low1, suit: shuffled[1] },
      { rank: low2, suit: shuffled[2] },
    ]
  } else if (tex === 'wet-connected') {
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
  } else if (tex === 'paired') {
    const pairRank = randomMidRank()
    const other = randomRankExcluding(pairRank)
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: pairRank, suit: shuffled[0] },
      { rank: pairRank, suit: shuffled[1] },
      { rank: other, suit: shuffled[2] },
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
    const r = randomRankExcluding(...usedRanks)
    board.push({ rank: r, suit: pickRandom(SUITS_ARR) })
  }
  if (numCards >= 5) {
    const usedRanks = board.map((c) => c.rank)
    const r = randomRankExcluding(...usedRanks)
    board.push({ rank: r, suit: pickRandom(SUITS_ARR) })
  }
  return board
}

// ---------------------------------------------------------------------------
// Hand generation
// ---------------------------------------------------------------------------

function getRepresentativeHand(category: string, board: Card[]): Card[] {
  const topBoardRank = board[0].rank
  const boardRanks = board.map((c) => c.rank)
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

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

  if (category.startsWith('topPair')) {
    const kicker: Rank = 'A'
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

  // Air / fallback
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

// ---------------------------------------------------------------------------
// Check-raise scenario loading
// ---------------------------------------------------------------------------

interface CheckRaiseScenario {
  id: string
  name: string
  data: PostflopScenarioData
}

function getCheckRaiseScenarios(): CheckRaiseScenario[] {
  const allScenarios = getAllScenarios()
  const result: CheckRaiseScenario[] = []

  for (const meta of allScenarios) {
    if (meta.subCategory !== 'check-raise') continue
    const data = getScenarioById(meta.id)
    if (!data || !isPostflop(data)) continue
    result.push({ id: meta.id, name: meta.name, data: data as PostflopScenarioData })
  }

  return result
}

// Sizing option for check-raise
interface SizingOption {
  key: string
  label: string
  multiplier: string
}

const SIZING_OPTIONS: SizingOption[] = [
  { key: 'raise_min', label: 'Min-Raise', multiplier: '2x' },
  { key: 'raise_25', label: '2.5x', multiplier: '2.5x' },
  { key: 'raise_3', label: '3x', multiplier: '3x' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CheckRaisePage() {
  const { t } = useI18n()

  const allScenarios = useMemo(() => getCheckRaiseScenarios(), [])

  const [selectedScenarioId, setSelectedScenarioId] = useState(
    allScenarios[0]?.id ?? '',
  )
  const [sessionActive, setSessionActive] = useState(false)

  // Drill state
  const [boardCards, setBoardCards] = useState<Card[]>([])
  const [heroCards, setHeroCards] = useState<Card[]>([])
  const [currentHand, setCurrentHand] = useState('')
  const [handCategory, setHandCategory] = useState('')
  const [currentStrategy, setCurrentStrategy] = useState<Record<string, number>>({})
  const [drillState, setDrillState] = useState<'awaiting' | 'sizing' | 'revealed'>('awaiting')
  const [lastResult, setLastResult] = useState<{
    userAction: string
    userSizing: string
    bestAction: string
    bestSizing: string
    isCorrect: boolean
    sizingCorrect: boolean
  } | null>(null)
  const [results, setResults] = useState<{ isCorrect: boolean; sizingCorrect: boolean }[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [showMobileStats, setShowMobileStats] = useState(false)

  const selectedScenario = useMemo(
    () => allScenarios.find((s) => s.id === selectedScenarioId),
    [allScenarios, selectedScenarioId],
  )

  const generateDrill = useCallback(() => {
    if (!selectedScenario) return
    const pfData = selectedScenario.data
    const categories = Object.keys(pfData.strategy)
    if (categories.length === 0) return

    // Weighted random: down-weight air
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

    const board = generateBoardByTexture(3, selectedScenario.data.boardTexture)
    const heroHand = getRepresentativeHand(category, board)
    const handStr = `${heroHand[0].rank}${heroHand[0].suit}${heroHand[1].rank}${heroHand[1].suit}`

    setBoardCards(board)
    setHeroCards(heroHand)
    setCurrentHand(handStr)
    setHandCategory(category)
    setCurrentStrategy(strategy)
    setDrillState('awaiting')
    setLastResult(null)
  }, [selectedScenario])

  const handleStart = () => {
    if (!selectedScenario) return
    setSessionActive(true)
    setResults([])
    setStreak(0)
    setBestStreak(0)
    generateDrill()
  }

  const handleActionChoice = (action: string) => {
    if (action === 'raise') {
      setDrillState('sizing')
    } else {
      // fold or call: evaluate immediately
      evaluate(action, '')
    }
  }

  const handleSizingChoice = (sizing: string) => {
    evaluate('raise', sizing)
  }

  const evaluate = (action: string, sizing: string) => {
    // Determine best action from strategy
    const entries = Object.entries(currentStrategy)
    const bestEntry = entries.sort((a, b) => b[1] - a[1])[0]
    const bestAction = bestEntry[0]

    const isCorrect = action === bestAction

    // For sizing correctness: if the user chose raise and raise is correct,
    // default correct sizing = 2.5x for value (2-2.5x), 3x for bluffs
    const isValue = handCategory === 'set' || handCategory === 'twoPair'
    const isDraw = handCategory === 'flushDraw' || handCategory === 'oesd' || handCategory === 'comboDraw' || handCategory === 'gutshot'
    let bestSizing = 'raise_25'
    if (isDraw) bestSizing = 'raise_3'
    else if (isValue) bestSizing = 'raise_min'

    const sizingCorrect = action === 'raise' && bestAction === 'raise' ? sizing === bestSizing : true

    setLastResult({
      userAction: action,
      userSizing: sizing,
      bestAction,
      bestSizing,
      isCorrect,
      sizingCorrect,
    })
    setResults((prev) => [...prev, { isCorrect, sizingCorrect }])

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
  const correctSizing = results.filter((r) => r.sizingCorrect).length
  const accuracy = totalHands > 0 ? (correctHands / totalHands) * 100 : 0
  const sizingAccuracy = totalHands > 0 ? (correctSizing / totalHands) * 100 : 0

  // ---- Scenario selection screen ----
  if (!sessionActive) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {t('checkRaise.title')}
          </h1>
          <p className="text-gray-400 mb-4">{t('checkRaise.subtitle')}</p>

          {/* Key concepts */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 mb-6 md:mb-8">
            <h2 className="text-base font-semibold text-white mb-3">
              {t('checkRaise.conceptsTitle')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-400">
              <div className="flex gap-2">
                <span className="text-red-400 font-bold shrink-0">1.</span>
                <span>{t('checkRaise.concept1')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-400 font-bold shrink-0">2.</span>
                <span>{t('checkRaise.concept2')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-yellow-400 font-bold shrink-0">3.</span>
                <span>{t('checkRaise.concept3')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-purple-400 font-bold shrink-0">4.</span>
                <span>{t('checkRaise.concept4')}</span>
              </div>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            {t('checkRaise.selectScenario')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
            {allScenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedScenarioId(s.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedScenarioId === s.id
                    ? 'bg-red-900/30 border-red-600 ring-1 ring-red-600'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                <span className="text-xs text-gray-500 uppercase">
                  {s.data.boardTexture ?? ''}
                </span>
                <h3 className="text-base font-semibold text-white mt-1">{s.name}</h3>
                {s.data.exampleBoard && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t('range.exampleBoard')} {s.data.exampleBoard.join(' ')}
                  </p>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handleStart}
            disabled={!selectedScenario}
            className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded-lg font-semibold text-base md:text-lg transition-colors"
          >
            {t('checkRaise.startTraining')}
          </button>
        </div>
      </div>
    )
  }

  // ---- Active session ----
  const actionButtons = [
    { key: 'fold', label: t('trainer.fold'), color: 'bg-gray-700 hover:bg-gray-600 border-gray-600' },
    { key: 'call', label: t('trainer.call'), color: 'bg-blue-700 hover:bg-blue-600 border-blue-500' },
    { key: 'raise', label: t('checkRaise.checkRaise'), color: 'bg-red-700 hover:bg-red-600 border-red-500' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* Scenario label */}
        <div className="text-xs md:text-sm text-gray-500 mb-4 uppercase tracking-wider">
          {selectedScenario?.name}
        </div>

        {/* Villain action indicator */}
        <div className="bg-orange-900/30 border border-orange-700/50 rounded-lg px-4 py-2 mb-4 text-sm text-orange-300">
          {t('checkRaise.villainBet')}
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
        {handCategory && (
          <div className="text-xs md:text-sm text-gray-400 mb-2">
            {t('trainer.category')}:{' '}
            <span className="text-white font-medium">{getCategoryLabel(handCategory)}</span>
          </div>
        )}

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

        {/* Step 1: Action choice */}
        {drillState === 'awaiting' && (
          <div className="text-center w-full max-w-lg">
            <div className="text-sm text-gray-400 mb-4">{t('checkRaise.chooseAction')}</div>
            <div className="grid grid-cols-3 gap-3">
              {actionButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => handleActionChoice(btn.key)}
                  className={`relative rounded-xl border px-4 py-5 text-white font-bold transition-all min-h-[44px] ${btn.color}`}
                >
                  <div className="text-base md:text-lg">{btn.label}</div>
                  {btn.key === 'raise' && (
                    <div className="text-xs text-gray-300 mt-1">{t('checkRaise.toCheckRaise')}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Sizing choice (only when user chose check-raise) */}
        {drillState === 'sizing' && (
          <div className="text-center w-full max-w-lg">
            <div className="text-sm text-gray-400 mb-4">{t('checkRaise.chooseSizing')}</div>
            <div className="grid grid-cols-3 gap-3">
              {SIZING_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleSizingChoice(opt.key)}
                  className="rounded-xl border border-red-500 bg-red-700/60 hover:bg-red-600 px-4 py-5 text-white font-bold transition-all min-h-[44px]"
                >
                  <div className="text-base md:text-lg">{opt.label}</div>
                  <div className="text-xs text-gray-300 mt-1">{opt.multiplier}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setDrillState('awaiting')}
              className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t('checkRaise.goBack')}
            </button>
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

            {/* User choice */}
            <div className="text-sm md:text-base text-gray-300 mb-2">
              {t('trainer.yourChoice')}:{' '}
              <span className="text-white font-bold">
                {lastResult.userAction === 'raise'
                  ? `${t('checkRaise.checkRaise')} (${SIZING_OPTIONS.find((o) => o.key === lastResult.userSizing)?.label ?? ''})`
                  : lastResult.userAction === 'call'
                    ? t('trainer.call')
                    : t('trainer.fold')}
              </span>
            </div>

            {/* Best action */}
            <div className="mb-4 text-sm text-gray-400">
              {t('trainer.bestAction')}:{' '}
              <span className="text-green-400 font-bold">
                {lastResult.bestAction === 'raise'
                  ? `${t('checkRaise.checkRaise')} (${SIZING_OPTIONS.find((o) => o.key === lastResult.bestSizing)?.label ?? ''})`
                  : lastResult.bestAction === 'call'
                    ? t('trainer.call')
                    : t('trainer.fold')}
              </span>
            </div>

            {/* Frequency breakdown */}
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-2">{t('checkRaise.frequencyBreakdown')}</div>
              <FrequencyBar strategy={currentStrategy} userAction={lastResult.userAction} />
            </div>

            {/* Sizing tips */}
            {lastResult.bestAction === 'raise' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 text-left">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  {t('checkRaise.sizingTip')}
                </div>
                <div className="text-sm text-gray-300">
                  {getSizingExplanation(handCategory, t)}
                </div>
              </div>
            )}

            {/* Explanation */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-left">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                {t('checkRaise.whyThisAction')}
              </div>
              <div className="text-sm text-gray-300">
                {getCheckRaiseExplanation(handCategory, lastResult.bestAction, t)}
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
              <StatItem label={t('checkRaise.sizingAccuracy')} value={`${sizingAccuracy.toFixed(1)}%`} />
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
          <StatItem label={t('checkRaise.sizingAccuracy')} value={`${sizingAccuracy.toFixed(1)}%`} />
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
