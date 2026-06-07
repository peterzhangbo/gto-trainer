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
import { ACTION_COLORS } from '@/config/constants'

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
  overpair: '超对 Overpair',
  topPair_topKicker: '顶对好踢脚 Top Pair Best Kicker',
  topPair_goodKicker: '顶对较好踢脚 Top Pair Good Kicker',
  topPair_weakKicker: '顶对弱踢脚 Top Pair Weak Kicker',
  topPair_good_kicker: '顶对较好踢脚 Top Pair Good Kicker',
  topPair_weak_kicker: '顶对弱踢脚 Top Pair Weak Kicker',
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

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

// ---------------------------------------------------------------------------
// Board generation (reuses TrainerPage patterns)
// ---------------------------------------------------------------------------

function generateBoardByTexture(numCards: number, boardTexture?: string): Card[] {
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
// Hand generation (same as TrainerPage)
// ---------------------------------------------------------------------------

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
    if (category.includes('topKicker') || category.includes('top_kicker')) {
      kicker = 'A'
    } else if (category.includes('goodKicker') || category.includes('good_kicker')) {
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

// ---------------------------------------------------------------------------
// Sizing explanation generator
// ---------------------------------------------------------------------------

function getSizingExplanation(category: string, bestSizing: string, t: (k: string) => string): string {
  const isBluff = category === 'air' || category === 'gutshot' || category === 'overcards'
  const isStrong = category === 'overpair' || category === 'set' || category === 'twoPair' || category === 'monster' || category === 'nutFlush'
  const isMedium = category.startsWith('topPair') || category === 'middlePair' || category === 'comboDraw' || category === 'oesd' || category === 'flushDraw'
  const isWeak = category === 'bottomPair'

  if (bestSizing === 'check') {
    if (isBluff) return t('betSizing.explain.checkBluff')
    return t('betSizing.explain.checkWeak')
  }

  if (isStrong) {
    if (bestSizing === 'bet_33pct') return t('betSizing.explain.strongSmall')
    if (bestSizing === 'bet_75pct') return t('betSizing.explain.strongLarge')
    if (bestSizing === 'bet_50pct') return t('betSizing.explain.strongMedium')
    if (bestSizing === 'bet_100pct') return t('betSizing.explain.strongFull')
  }

  if (isBluff) {
    if (bestSizing === 'bet_33pct') return t('betSizing.explain.bluffSmall')
    if (bestSizing === 'bet_75pct') return t('betSizing.explain.bluffLarge')
    if (bestSizing === 'bet_50pct') return t('betSizing.explain.bluffMedium')
  }

  if (isMedium) {
    if (bestSizing === 'bet_33pct') return t('betSizing.explain.mediumSmall')
    if (bestSizing === 'bet_75pct') return t('betSizing.explain.mediumLarge')
    if (bestSizing === 'bet_50pct') return t('betSizing.explain.mediumMedium')
  }

  if (isWeak) {
    return t('betSizing.explain.weakProbe')
  }

  return t('betSizing.explain.default')
}

// ---------------------------------------------------------------------------
// Get all postflop scenarios with sizing data
// ---------------------------------------------------------------------------

interface SizingScenario {
  id: string
  name: string
  subCategory: string
  boardTexture?: string
  data: PostflopScenarioData
}

function getSizingScenarios(): SizingScenario[] {
  const allScenarios = getAllScenarios()
  const result: SizingScenario[] = []

  for (const meta of allScenarios) {
    if (meta.category !== 'postflop') continue
    const data = getScenarioById(meta.id)
    if (!data || !isPostflop(data)) continue

    // Check if strategy entries contain sizing actions
    const hasSizing = Object.values(data.strategy).some((strat) =>
      Object.keys(strat).some((a) => a.startsWith('bet_'))
    )
    if (!hasSizing) continue

    result.push({
      id: meta.id,
      name: meta.name,
      subCategory: meta.subCategory,
      boardTexture: meta.boardTexture,
      data: data as PostflopScenarioData,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// Sizing option definition
// ---------------------------------------------------------------------------

interface SizingOption {
  action: string
  label: string
  potPct: number // e.g. 33, 50, 75, 100
}


function buildSizingOptions(strategy: Record<string, number>, t: (k: string) => string): SizingOption[] {
  const options: SizingOption[] = []
  const present = new Set(Object.keys(strategy))

  if (present.has('check')) {
    options.push({ action: 'check', label: t('betSizing.check'), potPct: 0 })
  }
  if (present.has('bet_33pct')) {
    options.push({ action: 'bet_33pct', label: '33%', potPct: 33 })
  }
  if (present.has('bet_50pct')) {
    options.push({ action: 'bet_50pct', label: '50%', potPct: 50 })
  }
  if (present.has('bet_75pct')) {
    options.push({ action: 'bet_75pct', label: '75%', potPct: 75 })
  }
  if (present.has('bet_100pct')) {
    options.push({ action: 'bet_100pct', label: '100%', potPct: 100 })
  }

  return options
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BetSizingPage() {
  const { t } = useI18n()

  const allSizingScenarios = useMemo(() => getSizingScenarios(), [])

  const [selectedScenarioId, setSelectedScenarioId] = useState(
    allSizingScenarios[0]?.id ?? ''
  )
  const [sessionActive, setSessionActive] = useState(false)

  // Drill state
  const [boardCards, setBoardCards] = useState<Card[]>([])
  const [heroCards, setHeroCards] = useState<Card[]>([])
  const [currentHand, setCurrentHand] = useState('')
  const [handCategory, setHandCategory] = useState('')
  const [currentStrategy, setCurrentStrategy] = useState<Record<string, number>>({})
  const [drillState, setDrillState] = useState<'awaiting' | 'revealed'>('awaiting')
  const [lastResult, setLastResult] = useState<{
    userAction: string
    bestAction: string
    bestFreq: number
    isCorrect: boolean
  } | null>(null)
  const [results, setResults] = useState<{ isCorrect: boolean }[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [showMobileStats, setShowMobileStats] = useState(false)

  const selectedScenario = useMemo(
    () => allSizingScenarios.find((s) => s.id === selectedScenarioId),
    [allSizingScenarios, selectedScenarioId]
  )

  const generateDrill = useCallback(() => {
    if (!selectedScenario) return
    const pfData = selectedScenario.data
    const categories = Object.keys(pfData.strategy)
    if (categories.length === 0) return

    // Weighted random category selection
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

    // Determine board card count
    let numBoardCards = 3
    if (pfData.turnType || selectedScenario.subCategory === 'turn') numBoardCards = 4
    else if (pfData.riverType || selectedScenario.subCategory === 'river') numBoardCards = 5

    const board = generateBoardByTexture(numBoardCards, selectedScenario.boardTexture ?? pfData.boardTexture)
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

  const submitSizing = (action: string) => {
    const bestEntry = Object.entries(currentStrategy).sort((a, b) => b[1] - a[1])[0]
    const bestAction = bestEntry[0]
    const bestFreq = bestEntry[1]
    const isCorrect = action === bestAction

    setLastResult({ userAction: action, bestAction, bestFreq, isCorrect })
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

  // Scenario selection screen
  if (!sessionActive) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('betSizing.title')}</h1>
          <p className="text-gray-400 mb-6 md:mb-8">{t('betSizing.subtitle')}</p>

          <h2 className="text-lg font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            {t('betSizing.selectScenario')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
            {allSizingScenarios.map((s) => {
              const streetLabel =
                s.subCategory === 'c-bet' ? t('scenario.cbet')
                : s.subCategory === 'turn' ? t('scenario.turn')
                : s.subCategory === 'river' ? t('scenario.river')
                : s.subCategory
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedScenarioId(s.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedScenarioId === s.id
                      ? 'bg-purple-900/30 border-purple-600 ring-1 ring-purple-600'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <span className="text-xs text-gray-500 uppercase">{streetLabel}</span>
                  <h3 className="text-base font-semibold text-white mt-1">{s.name}</h3>
                  {s.data.exampleBoard && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('range.exampleBoard')} {s.data.exampleBoard.join(' ')}
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleStart}
            disabled={!selectedScenario}
            className="min-h-[44px] px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white rounded-lg font-semibold text-base md:text-lg transition-colors"
          >
            {t('betSizing.startTraining')}
          </button>
        </div>
      </div>
    )
  }

  // Active session
  const sizingOptions = buildSizingOptions(currentStrategy, t)

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* Scenario label */}
        <div className="text-xs md:text-sm text-gray-500 mb-4 uppercase tracking-wider">
          {selectedScenario?.name}
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
          <span className="text-white font-mono font-bold text-lg md:text-xl">{currentHand}</span>
        </div>

        {/* Sizing prompt */}
        {drillState === 'awaiting' && (
          <div className="text-center w-full max-w-lg">
            <div className="text-sm text-gray-400 mb-4">{t('betSizing.chooseSizing')}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sizingOptions.map((opt) => {
                const isCheck = opt.action === 'check'
                const color = isCheck
                  ? 'bg-gray-600 hover:bg-gray-500 border-gray-500'
                  : 'bg-purple-700 hover:bg-purple-600 border-purple-500'
                return (
                  <button
                    key={opt.action}
                    onClick={() => submitSizing(opt.action)}
                    className={`relative rounded-xl border px-4 py-5 text-white font-bold transition-all min-h-[44px] ${color}`}
                  >
                    <div className="text-lg">{opt.label}</div>
                    {!isCheck && (
                      <div className="text-xs text-gray-300 mt-1">
                        {t('betSizing.potOf')} {opt.potPct}%
                      </div>
                    )}
                    {isCheck && (
                      <div className="text-xs text-gray-300 mt-1">{t('betSizing.pass')}</div>
                    )}
                  </button>
                )
              })}
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

            <div className="text-sm md:text-base text-gray-300 mb-2">
              {t('trainer.yourChoice')}:{' '}
              <span className="text-white font-bold">
                {lastResult.userAction === 'check' ? t('betSizing.check') : lastResult.userAction.replace('bet_', '').replace('pct', '%')}
              </span>
            </div>

            <div className="mb-4 text-sm text-gray-400">
              {t('trainer.bestAction')}:{' '}
              <span className="text-green-400 font-bold">
                {lastResult.bestAction === 'check' ? t('betSizing.check') : lastResult.bestAction.replace('bet_', '').replace('pct', '%')}
              </span>{' '}
              ({Math.round(lastResult.bestFreq * 100)}%)
            </div>

            {/* Frequency breakdown */}
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-2">{t('betSizing.frequencyBreakdown')}</div>
              <FrequencyBar strategy={currentStrategy} userAction={lastResult.userAction} />
            </div>

            {/* Sizing visualization with pot-relative buttons */}
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-2">{t('betSizing.sizingVisual')}</div>
              <div className="flex items-end justify-center gap-3">
                {sizingOptions.map((opt) => {
                  const freq = currentStrategy[opt.action] ?? 0
                  const isBest = opt.action === lastResult.bestAction
                  const isUser = opt.action === lastResult.userAction
                  const isCheck = opt.action === 'check'
                  const barHeight = Math.max(8, freq * 100)

                  return (
                    <div key={opt.action} className="flex flex-col items-center gap-1">
                      <div className="text-xs text-gray-400 font-mono">
                        {freq > 0 ? `${Math.round(freq * 100)}%` : '-'}
                      </div>
                      <div
                        className={`w-12 sm:w-16 rounded-t transition-all ${
                          isBest ? 'ring-2 ring-yellow-400' : ''
                        } ${isUser && !isBest ? 'ring-2 ring-white' : ''}`}
                        style={{
                          height: `${barHeight}px`,
                          backgroundColor: isCheck
                            ? ACTION_COLORS.check
                            : ACTION_COLORS[opt.action] ?? ACTION_COLORS.bet_50pct,
                        }}
                      />
                      <div className="text-xs text-gray-300 font-bold">{opt.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-left">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                {t('betSizing.whyThisSizing')}
              </div>
              <div className="text-sm text-gray-300">
                {getSizingExplanation(handCategory, lastResult.bestAction, t)}
              </div>
            </div>

            <button
              onClick={generateDrill}
              className="min-h-[44px] px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
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
              <StatItem label={t('trainer.streak')} value={streak} highlight="purple" />
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
          <StatItem label={t('trainer.streak')} value={streak} highlight="purple" />
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
  highlight?: 'purple' | 'yellow' | 'orange'
}) {
  const colorClass =
    highlight === 'purple'
      ? 'text-purple-400'
      : highlight === 'yellow'
        ? 'text-yellow-400'
        : highlight === 'orange'
          ? 'text-orange-400'
          : 'text-white'
  return (
    <div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  )
}
