import { useState, useCallback, useEffect, useRef } from 'react'
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
import FrequencyBar from '@/components/poker/FrequencyBar'
import { useI18n } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const SUITS_ARR: Suit[] = ['s', 'h', 'd', 'c']

const ALL_SCENARIOS = getAllScenarios()

const SUBCATEGORY_I18N: Record<string, string> = {
  rfi: 'scenario.rfi',
  threebet: 'scenario.threebet',
  defend: 'scenario.defend',
  'c-bet': 'scenario.cbet',
  turn: 'scenario.turn',
  river: 'scenario.river',
}

const TIME_LIMITS = [30, 60, 120, 300] as const

type Difficulty = 'beginner' | 'intermediate' | 'advanced'

const DIFFICULTY_CONFIG: Record<Difficulty, { filterHand: (strat: Record<string, number>) => boolean }> = {
  beginner: {
    filterHand: (strat) => {
      const maxFreq = Math.max(...Object.values(strat))
      return maxFreq >= 0.8
    },
  },
  intermediate: {
    filterHand: () => true,
  },
  advanced: {
    filterHand: (strat) => {
      const sorted = Object.values(strat).sort((a, b) => b - a)
      if (sorted.length < 2) return false
      return sorted[0] - sorted[1] <= 0.15
    },
  },
}

const PREFLOP_STANDARD_ACTIONS = ['fold', 'call', 'raise']
const POSTFLOP_STANDARD_ACTIONS = ['check', 'fold', 'call', 'raise']

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

const CATEGORY_LABELS: Record<string, string> = {
  overpair: '超对 Overpair',
  topPair_topKicker: '顶对好踢脚',
  topPair_goodKicker: '顶对较好踢脚',
  topPair_weakKicker: '顶对弱踢脚',
  middlePair: '中对',
  bottomPair: '底对',
  overcards: '高牌',
  gutshot: '卡顺听牌',
  oesd: '两头顺听牌',
  flushDraw: '同花听牌',
  comboDraw: '组合听牌',
  air: '空气',
  pair: '对子',
  draw: '听牌',
  bluffCatch: '抓诈唬',
  nutFlush: '坚果同花',
  set: '暗三',
  twoPair: '两对',
  monster: '怪兽牌',
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

function generateRandomHand(strategy: Record<string, Record<string, number>>, difficulty: Difficulty): string {
  const entries = Object.entries(strategy)
  const filterFn = DIFFICULTY_CONFIG[difficulty].filterHand
  const weighted: [string, Record<string, number>][] = []

  for (const [hand, strat] of entries) {
    if (!filterFn(strat)) continue
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

function generateBoardByTexture(numCards: number, boardTexture?: string): Card[] {
  const t = boardTexture ?? 'dry-high'
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
    const r1 = randomHighRank()
    const r2 = randomRankExcluding(r1)
    const r3 = randomRankExcluding(r1, r2)
    flop = [
      { rank: r1, suit },
      { rank: r2, suit },
      { rank: r3, suit },
    ]
  } else if (t === 'brick') {
    const shuffled = [...SUITS_ARR].sort(() => Math.random() - 0.5)
    flop = [
      { rank: randomMidRank(), suit: shuffled[0] },
      { rank: randomLowRank(), suit: shuffled[1] },
      { rank: randomLowRank(), suit: shuffled[2] },
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
  } else {
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
    return [{ rank: rank as Rank, suit: s1 }, { rank: rank as Rank, suit: s2 }]
  }

  if (category.startsWith('topPair')) {
    let kicker: Rank
    if (category === 'topPair_topKicker') kicker = 'A'
    else if (category === 'topPair_goodKicker') kicker = pick(['K', 'Q'] as const)
    else kicker = pick(['J', 'T', '9', '8', '7'] as const)
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [{ rank: topBoardRank, suit: s1 }, { rank: kicker, suit: s2 }]
  }

  if (category === 'overcards') {
    const overRanks = RANKS.slice(0, Math.max(topIdx, 1))
    const r1 = pick(overRanks)
    let r2: Rank
    do { r2 = pick(overRanks) } while (r2 === r1)
    const s1 = pick(SUITS_ARR)
    let s2: Suit
    do { s2 = pick(SUITS_ARR) } while (s2 === s1)
    return [{ rank: r1, suit: s1 }, { rank: r2, suit: s2 }]
  }

  if (category === 'flushDraw' || category === 'comboDraw' || category === 'nutFlush') {
    const flushSuit = pick(board.map((c) => c.suit))
    const r1 = randomRankExcluding(...boardRanks)
    const r2 = randomRankExcluding(r1, ...boardRanks)
    return [{ rank: category === 'nutFlush' ? 'A' as Rank : r1, suit: flushSuit }, { rank: r2, suit: flushSuit }]
  }

  // Default: random hand
  const r1 = randomRankExcluding(...boardRanks)
  const r2 = randomRankExcluding(r1, ...boardRanks)
  const s1 = pick(SUITS_ARR)
  let s2: Suit
  do { s2 = pick(SUITS_ARR) } while (s2 === s1)
  return [{ rank: r1, suit: s1 }, { rank: r2, suit: s2 }]
}

// High score storage
function getHighScore(key: string): number {
  try {
    return Number(localStorage.getItem(`gto-quiz-highscore-${key}`) ?? '0')
  } catch { return 0 }
}

function saveHighScore(key: string, score: number): void {
  try {
    const current = getHighScore(key)
    if (score > current) {
      localStorage.setItem(`gto-quiz-highscore-${key}`, String(score))
    }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizQuestion {
  hand: string
  cards: Card[]
  board: Card[]
  strategy: Record<string, number>
  bestAction: string
  category?: string
  isPostflop: boolean
}

type QuizPhase = 'setup' | 'active' | 'results'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuizPage() {
  const { t } = useI18n()
  const preflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'preflop')
  const postflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'postflop')

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('all')
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate')
  const [timeLimit, setTimeLimit] = useState(60)
  const [phase, setPhase] = useState<QuizPhase>('setup')

  // Active quiz state
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [questionCount, setQuestionCount] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; userAction: string; bestAction: string } | null>(null)
  const [showingFeedback, setShowingFeedback] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Generate a random scenario to pull data from
  const getRandomScenario = useCallback((): { data: ScenarioData; meta: typeof ALL_SCENARIOS[0] } | null => {
    let pool: typeof ALL_SCENARIOS
    if (selectedScenarioId === 'all') {
      pool = ALL_SCENARIOS
    } else {
      pool = ALL_SCENARIOS.filter((s) => s.id === selectedScenarioId)
    }
    if (pool.length === 0) return null

    const meta = pickRandom(pool)
    const data = getScenarioById(meta.id) ?? getScenarioData({
      scenarioType: meta.subCategory,
      position: meta.position,
      villainPosition: meta.villainPosition,
      boardTexture: meta.boardTexture,
    })
    if (!data) return null
    return { data, meta }
  }, [selectedScenarioId])

  const generateQuestionAsync = useCallback(async (): Promise<QuizQuestion | null> => {
    const result = getRandomScenario()
    if (!result) return null
    const { data, meta } = result

    if (isPreflop(data)) {
      const hand = generateRandomHand(data.hands, difficulty)
      const strategy = data.hands[hand] ?? { fold: 1 }
      const bestAction = Object.entries(strategy).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'fold'
      return {
        hand,
        cards: handToCards(hand),
        board: [],
        strategy,
        bestAction,
        isPostflop: false,
      }
    }

    if (isPostflop(data)) {
      const pfData = data as PostflopScenarioData
      const categories = Object.keys(pfData.strategy)
      if (categories.length === 0) return null
      const category = pickRandom(categories)
      const strategy = pfData.strategy[category]
      const bestAction = Object.entries(strategy).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'fold'

      let numCards = 3
      if (pfData.turnType || meta.subCategory === 'turn') numCards = 4
      else if (pfData.riverType || meta.subCategory === 'river') numCards = 5

      const board = generateBoardByTexture(numCards, meta.boardTexture ?? pfData.boardTexture)
      const heroHand = getRepresentativeHand(category, board)
      const handStr = `${heroHand[0].rank}${heroHand[0].suit}${heroHand[1].rank}${heroHand[1].suit}`

      return {
        hand: handStr,
        cards: heroHand,
        board,
        strategy,
        bestAction,
        category,
        isPostflop: true,
      }
    }

    return null
  }, [getRandomScenario, difficulty])

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const startQuiz = useCallback(() => {
    setPhase('active')
    setTimeLeft(timeLimit)
    setQuestionCount(0)
    setCorrectCount(0)
    setStreak(0)
    setBestStreak(0)
    setLastResult(null)
    setShowingFeedback(false)

    generateQuestionAsync().then(q => setCurrentQuestion(q))
  }, [timeLimit, generateQuestionAsync])

  // Timer
  useEffect(() => {
    if (phase !== 'active') return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up
          if (timerRef.current) clearInterval(timerRef.current)
          setPhase('results')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  // Save high score when results are shown
  useEffect(() => {
    if (phase === 'results') {
      const key = `${selectedScenarioId}-${difficulty}-${timeLimit}`
      saveHighScore(key, correctCount)
    }
  }, [phase, selectedScenarioId, difficulty, timeLimit, correctCount])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  const handleAnswer = useCallback((action: string) => {
    if (!currentQuestion || showingFeedback) return

    const isCorrect = action === currentQuestion.bestAction
    const newCount = questionCount + 1
    const newCorrect = isCorrect ? correctCount + 1 : correctCount
    const newStreak = isCorrect ? streak + 1 : 0
    const newBestStreak = Math.max(bestStreak, newStreak)

    setQuestionCount(newCount)
    setCorrectCount(newCorrect)
    setStreak(newStreak)
    setBestStreak(newBestStreak)
    setLastResult({ isCorrect, userAction: action, bestAction: currentQuestion.bestAction })
    setShowingFeedback(true)

    // Show feedback briefly then advance
    feedbackTimerRef.current = setTimeout(() => {
      setShowingFeedback(false)
      setLastResult(null)
      generateQuestionAsync().then(q => setCurrentQuestion(q))
    }, 800)
  }, [currentQuestion, showingFeedback, questionCount, correctCount, streak, bestStreak, generateQuestionAsync])

  const getAvailableActions = useCallback((question: QuizQuestion): string[] => {
    if (question.isPostflop) {
      return [...POSTFLOP_STANDARD_ACTIONS, ...Object.keys(question.strategy)]
    }
    return [...PREFLOP_STANDARD_ACTIONS, ...Object.keys(question.strategy)]
  }, [])

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const highScoreKey = `${selectedScenarioId}-${difficulty}-${timeLimit}`
  const highScore = getHighScore(highScoreKey)

  // ---- Setup Screen ----
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">{t('quiz.select')}</h1>

          {/* Scenario selector */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">{t('quiz.scenario')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setSelectedScenarioId('all')}
                className={`p-3 rounded-lg border text-left transition-all text-sm ${
                  selectedScenarioId === 'all'
                    ? 'bg-red-900/30 border-red-600 ring-1 ring-red-600'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                <span className="font-semibold text-white">{t('quiz.allScenarios')}</span>
              </button>
              {[...preflopScenarios, ...postflopScenarios].map((s) => {
                const i18nKey = SUBCATEGORY_I18N[s.subCategory]
                const subCatLabel = i18nKey ? t(i18nKey as Parameters<typeof t>[0]) : s.subCategory
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedScenarioId(s.id)}
                    className={`p-3 rounded-lg border text-left transition-all text-sm ${
                      selectedScenarioId === s.id
                        ? 'bg-red-900/30 border-red-600 ring-1 ring-red-600'
                        : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <span className="text-xs text-gray-500 uppercase">{subCatLabel}</span>
                    <div className="font-semibold text-white truncate">{s.position ? `${s.position} ` : ''}{s.name}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Difficulty selector */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">{t('quiz.difficulty')}</h2>
            <div className="grid grid-cols-3 gap-3">
              {(['beginner', 'intermediate', 'advanced'] as const).map((d) => {
                const colorMap = {
                  beginner: 'border-green-600 bg-green-900/30 ring-green-600',
                  intermediate: 'border-blue-600 bg-blue-900/30 ring-blue-600',
                  advanced: 'border-orange-600 bg-orange-900/30 ring-orange-600',
                }
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      difficulty === d
                        ? `${colorMap[d]} ring-1`
                        : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{t(`difficulty.${d}` as Parameters<typeof t>[0])}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time limit selector */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">{t('quiz.timeLimit')}</h2>
            <div className="grid grid-cols-4 gap-3">
              {TIME_LIMITS.map((tl) => (
                <button
                  key={tl}
                  onClick={() => setTimeLimit(tl)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    timeLimit === tl
                      ? 'bg-purple-900/30 border-purple-600 ring-1 ring-purple-600'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="text-lg font-bold text-white">{tl}</div>
                  <div className="text-xs text-gray-500">{t('quiz.seconds')}</div>
                </button>
              ))}
            </div>
          </div>

          {highScore > 0 && (
            <div className="mb-6 text-center">
              <span className="text-sm text-gray-500">{t('quiz.highScore')}: </span>
              <span className="text-lg font-bold text-yellow-400">{highScore}</span>
            </div>
          )}

          <button
            onClick={startQuiz}
            className="w-full min-h-[48px] px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-lg transition-colors"
          >
            {t('quiz.start')}
          </button>
        </div>
      </div>
    )
  }

  // ---- Active Quiz ----
  if (phase === 'active' && currentQuestion) {
    const availableActions = getAvailableActions(currentQuestion)
    // Deduplicate
    const uniqueActions = [...new Set(availableActions)]

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center p-4 md:p-8">
        {/* Timer and score bar */}
        <div className="w-full max-w-lg flex items-center justify-between mb-6">
          <div className="text-center">
            <div className="text-xs text-gray-500">{t('quiz.timeLeft')}</div>
            <div className={`text-2xl font-bold font-mono ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">{t('quiz.currentScore')}</div>
            <div className="text-xl font-bold text-white">{correctCount}/{questionCount}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">{t('quiz.streak')}</div>
            <div className={`text-xl font-bold ${streak > 0 ? 'text-orange-400' : 'text-gray-500'}`}>{streak}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-lg h-1 bg-gray-800 rounded-full mb-8">
          <div
            className="h-full bg-red-600 rounded-full transition-all duration-1000"
            style={{ width: `${(timeLeft / timeLimit) * 100}%` }}
          />
        </div>

        {/* Scenario label */}
        {currentQuestion.category && (
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
            {CATEGORY_LABELS[currentQuestion.category] ?? currentQuestion.category}
          </div>
        )}

        {/* Board (postflop only) */}
        {currentQuestion.board.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 text-center mb-1">{t('trainer.board' as Parameters<typeof t>[0])}</div>
            <div className="flex gap-2 justify-center">
              {currentQuestion.board.map((card, i) => (
                <CardDisplay key={`board-${i}`} card={card} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Hand display */}
        <div className="flex gap-2 md:gap-3 mb-3">
          {currentQuestion.cards.map((card, i) => (
            <CardDisplay key={`hero-${i}`} card={card} size="lg" />
          ))}
        </div>

        <div className="text-base text-gray-400 mb-6">
          {t('trainer.hand' as Parameters<typeof t>[0])}: <span className="text-white font-mono font-bold text-lg">{currentQuestion.hand}</span>
        </div>

        {/* Feedback overlay */}
        {showingFeedback && lastResult && (
          <div className={`mb-4 text-xl font-bold ${lastResult.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
            {lastResult.isCorrect ? t('trainer.correct') : t('trainer.wrong')}
          </div>
        )}

        {/* Action buttons */}
        {!showingFeedback && (
          <div className="flex flex-wrap gap-2 justify-center max-w-md w-full">
            {uniqueActions.map((action) => {
              const bgClass = action === 'fold' ? 'bg-red-700 hover:bg-red-600 border-red-600'
                : action === 'call' ? 'bg-blue-700 hover:bg-blue-600 border-blue-600'
                : action === 'check' ? 'bg-gray-600 hover:bg-gray-500 border-gray-500'
                : 'bg-green-700 hover:bg-green-600 border-green-600'
              const key = ACTION_LABEL_KEYS[action]
              const label = key ? t(key as Parameters<typeof t>[0]) : action
              return (
                <button
                  key={action}
                  onClick={() => handleAnswer(action)}
                  className={`flex-1 min-w-[80px] min-h-[44px] px-5 py-3 rounded-lg border text-sm font-bold text-white transition-all ${bgClass}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* GTO frequency (shown during feedback) */}
        {showingFeedback && (
          <div className="w-full max-w-md">
            <FrequencyBar strategy={currentQuestion.strategy} userAction={lastResult?.userAction} />
          </div>
        )}
      </div>
    )
  }

  // ---- Results Screen ----
  if (phase === 'results') {
    const accuracy = questionCount > 0 ? (correctCount / questionCount) * 100 : 0

    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl border border-gray-800 p-6 md:p-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('quiz.timesUp')}</h1>
          <p className="text-gray-500 mb-6">{t('quiz.results')}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-sm text-gray-500">{t('quiz.totalAnswered')}</div>
              <div className="text-2xl font-bold text-white">{questionCount}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-sm text-gray-500">{t('quiz.accuracy')}</div>
              <div className={`text-2xl font-bold ${accuracy >= 70 ? 'text-green-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {accuracy.toFixed(1)}%
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-sm text-gray-500">{t('quiz.bestStreak')}</div>
              <div className="text-2xl font-bold text-orange-400">{bestStreak}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-sm text-gray-500">{t('quiz.highScore')}</div>
              <div className="text-2xl font-bold text-yellow-400">{getHighScore(highScoreKey)}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mb-8 text-sm">
            <div>
              <span className="text-green-400 font-bold">{correctCount}</span>
              <span className="text-gray-500 ml-1">{t('quiz.correct')}</span>
            </div>
            <div>
              <span className="text-red-400 font-bold">{questionCount - correctCount}</span>
              <span className="text-gray-500 ml-1">{t('quiz.wrong')}</span>
            </div>
            <div>
              <span className="text-gray-300 font-bold">{formatTime(timeLimit)}</span>
              <span className="text-gray-500 ml-1">{t('quiz.timeUsed')}</span>
            </div>
          </div>

          <button
            onClick={() => setPhase('setup')}
            className="w-full min-h-[48px] px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-lg transition-colors"
          >
            {t('quiz.newQuiz')}
          </button>
        </div>
      </div>
    )
  }

  return null
}
