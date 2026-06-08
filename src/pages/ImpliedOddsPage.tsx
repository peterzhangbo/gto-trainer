import { useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DrawScenario {
  name_zh: string
  name_en: string
  outs: number
  equity: number // percent on flop (2 cards to come, approximate)
}

interface OddsQuestion {
  id: string
  pot: number
  betToCall: number
  draw: DrawScenario
  impliedWinnings: number
  options: number[]
  impliedOddsOptions: number[]
  correctPotOddsIdx: number
  correctImpliedOddsIdx: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAWS: DrawScenario[] = [
  { name_zh: '同花听牌', name_en: 'Flush Draw', outs: 9, equity: 19 },
  { name_zh: '两头顺听牌', name_en: 'Open-Ended Straight Draw', outs: 8, equity: 17 },
  { name_zh: '卡顺听牌', name_en: 'Gutshot', outs: 4, equity: 9 },
  { name_zh: '同花+顺子组合听牌', name_en: 'Flush + Straight Draw', outs: 12, equity: 25 },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function generateQuestion(): OddsQuestion {
  const draw = pickRandom(DRAWS)
  const pot = pickRandom([40, 60, 80, 100, 120, 150, 200])
  const betToCall = pickRandom([10, 15, 20, 25, 30, 40, 50])
  const impliedWinnings = pickRandom([30, 50, 60, 80, 100])

  // Correct pot odds = betToCall / (pot + betToCall) * 100
  const correctPotOdds = Math.round((betToCall / (pot + betToCall)) * 100)

  // Correct implied odds = betToCall / (pot + betToCall + impliedWinnings) * 100
  const correctImpliedOdds = Math.round(
    (betToCall / (pot + betToCall + impliedWinnings)) * 100,
  )

  // Generate 4 options for pot odds question
  const potOddsOptions = generateOptions(correctPotOdds)
  const correctPotOddsIdx = potOddsOptions.indexOf(correctPotOdds)

  // Generate 4 options for implied odds question
  const impliedOddsOptions = generateOptions(correctImpliedOdds)
  const correctImpliedOddsIdx = impliedOddsOptions.indexOf(correctImpliedOdds)

  return {
    id: Date.now().toString(),
    pot,
    betToCall,
    draw,
    impliedWinnings,
    options: potOddsOptions,
    impliedOddsOptions,
    correctPotOddsIdx,
    correctImpliedOddsIdx,
  }
}

function generateOptions(correct: number): number[] {
  const set = new Set<number>([correct])
  // Add distractors close to the correct answer
  const offsets = [-5, -3, -2, -1, 1, 2, 3, 5, 7, 8]
  let attempts = 0
  while (set.size < 4 && attempts < 50) {
    const offset = pickRandom(offsets)
    const candidate = correct + offset
    if (candidate > 0 && candidate <= 100) {
      set.add(candidate)
    }
    attempts++
  }
  // Fill with random values if still < 4
  while (set.size < 4) {
    set.add(Math.max(1, Math.min(100, correct + Math.floor(Math.random() * 20) - 10)))
  }
  return shuffle([...set])
}

// ---------------------------------------------------------------------------
// Card display helpers
// ---------------------------------------------------------------------------

function SuitSymbol({ suit }: { suit: string }) {
  const color = suit === 'h' || suit === 'd' ? 'text-red-400' : 'text-white'
  const symbols: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
  return <span className={color}>{symbols[suit] ?? suit}</span>
}

function MiniCard({ rank, suit }: { rank: string; suit: string }) {
  return (
    <span className="inline-flex items-center justify-center w-8 h-10 bg-gray-800 border border-gray-600 rounded text-sm font-bold leading-none">
      {rank}
      <SuitSymbol suit={suit} />
    </span>
  )
}

function generateFlushDrawBoard(): { board: { rank: string; suit: string }[]; hand: { rank: string; suit: string }[] } {
  const suits = ['s', 'h', 'd', 'c']
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
  const mainSuit = pickRandom(suits)
  let otherSuit: string
  do { otherSuit = pickRandom(suits) } while (otherSuit === mainSuit)

  const boardRanks = shuffle(ranks).slice(0, 3)
  const board = boardRanks.map((r, i) => ({
    rank: r,
    suit: i < 2 ? mainSuit : otherSuit,
  }))

  // Hero has 2 cards of main suit for flush draw
  const remainingRanks = ranks.filter(r => !boardRanks.includes(r))
  const heroRanks = shuffle(remainingRanks).slice(0, 2)
  const hand = heroRanks.map(r => ({ rank: r, suit: mainSuit }))

  return { board, hand }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ImpliedOddsPage() {
  const { t, lang } = useI18n()

  const [started, setStarted] = useState(false)
  const [question, setQuestion] = useState<OddsQuestion>(() => generateQuestion())
  const [phase, setPhase] = useState<'potOdds' | 'impliedOdds' | 'done'>('potOdds')
  const [selectedPotOdds, setSelectedPotOdds] = useState<number | null>(null)
  const [selectedImpliedOdds, setSelectedImpliedOdds] = useState<number | null>(null)

  const [stats, setStats] = useState({ total: 0, correct: 0, streak: 0, bestStreak: 0 })

  const startTraining = useCallback(() => {
    const q = generateQuestion()
    setQuestion(q)
    setPhase('potOdds')
    setSelectedPotOdds(null)
    setSelectedImpliedOdds(null)
    setStarted(true)
  }, [])

  const nextQuestion = useCallback(() => {
    const q = generateQuestion()
    setQuestion(q)
    setPhase('potOdds')
    setSelectedPotOdds(null)
    setSelectedImpliedOdds(null)
  }, [])

  const potOddsCorrect = selectedPotOdds === question.correctPotOddsIdx
  const correctImpliedOdds = Math.round(
    (question.betToCall / (question.pot + question.betToCall + question.impliedWinnings)) * 100,
  )
  const impliedOddsOptionsFinal = question.impliedOddsOptions

  const correctImpliedOddsIdx = impliedOddsOptionsFinal.indexOf(correctImpliedOdds)
  const impliedOddsCorrect = selectedImpliedOdds === correctImpliedOddsIdx

  const potOddsPercent = Math.round((question.betToCall / (question.pot + question.betToCall)) * 100)
  const drawName = lang === 'zh' ? question.draw.name_zh : question.draw.name_en

  // Generate visual board for display
  const boardVisual = generateFlushDrawBoard()

  if (!started) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">{t('implied.title')}</h1>
        <p className="text-gray-400 mb-8">{t('implied.subtitle')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-red-400">{t('implied.potOddsConcept')}</h2>
            <div className="space-y-3 text-sm text-gray-300">
              <p>{t('implied.potOddsDesc')}</p>
              <div className="bg-gray-800 rounded-lg p-3 font-mono text-center">
                potOdds = betToCall / (pot + betToCall)
              </div>
              <p className="text-gray-400">{t('implied.potOddsExample')}</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-emerald-400">{t('implied.impliedOddsConcept')}</h2>
            <div className="space-y-3 text-sm text-gray-300">
              <p>{t('implied.impliedOddsDesc')}</p>
              <div className="bg-gray-800 rounded-lg p-3 font-mono text-center">
                impliedOdds = bet / (pot + bet + impliedWinnings)
              </div>
              <p className="text-gray-400">{t('implied.impliedOddsExample')}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{t('implied.commonDraws')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DRAWS.map((d) => (
              <div key={d.name_en} className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-sm font-medium mb-1">{lang === 'zh' ? d.name_zh : d.name_en}</div>
                <div className="text-2xl font-bold text-yellow-400">{d.outs}</div>
                <div className="text-xs text-gray-400">{t('implied.outs')}</div>
                <div className="text-sm text-emerald-400 mt-1">~{d.equity}% {t('implied.equity')}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={startTraining}
          className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-lg font-semibold transition-colors"
        >
          {t('implied.startTraining')}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('implied.title')}</h1>
          <p className="text-gray-400 text-sm">{t('implied.subtitle')}</p>
        </div>
        <button
          onClick={() => setStarted(false)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
        >
          {t('implied.back')}
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-6 text-sm">
        <span className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5">
          {t('implied.total')}: <strong>{stats.total}</strong>
        </span>
        <span className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5">
          {t('implied.accuracy')}: <strong>{stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%</strong>
        </span>
        <span className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5">
          {t('implied.streak')}: <strong>{stats.streak}</strong>
        </span>
      </div>

      {/* Scenario display */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-start gap-6">
          {/* Hero hand */}
          <div>
            <div className="text-xs text-gray-400 mb-2">{t('implied.heroHand')}</div>
            <div className="flex gap-1">
              {boardVisual.hand.map((c, i) => (
                <MiniCard key={i} rank={c.rank} suit={c.suit} />
              ))}
            </div>
          </div>
          {/* Board */}
          <div>
            <div className="text-xs text-gray-400 mb-2">{t('trainer.board')}</div>
            <div className="flex gap-1">
              {boardVisual.board.map((c, i) => (
                <MiniCard key={i} rank={c.rank} suit={c.suit} />
              ))}
            </div>
          </div>
          {/* Draw info */}
          <div className="ml-auto text-right">
            <div className="text-sm text-yellow-400 font-medium">{drawName}</div>
            <div className="text-xs text-gray-400">
              {question.draw.outs} {t('implied.outs')} | ~{question.draw.equity}% {t('implied.equity')}
            </div>
          </div>
        </div>
      </div>

      {/* Pot info */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400 mb-1">{t('calc.potSize')}</div>
          <div className="text-xl font-bold">${question.pot}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400 mb-1">{t('calc.betToCall')}</div>
          <div className="text-xl font-bold text-red-400">${question.betToCall}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400 mb-1">{t('implied.impliedWinnings')}</div>
          <div className="text-xl font-bold text-emerald-400">${question.impliedWinnings}</div>
        </div>
      </div>

      {/* Phase 1: Pot Odds */}
      {phase === 'potOdds' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">{t('implied.potOddsQuestion')}</h2>
          <p className="text-gray-300 text-sm mb-4">
            {t('implied.potOddsPrompt')
              .replace('{bet}', String(question.betToCall))
              .replace('{pot}', String(question.pot))}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {question.options.map((opt, idx) => {
              let borderColor = 'border-gray-700 hover:border-gray-500'
              let bg = 'bg-gray-800'
              if (selectedPotOdds !== null) {
                if (idx === question.correctPotOddsIdx) {
                  borderColor = 'border-emerald-500'
                  bg = 'bg-emerald-900/30'
                } else if (idx === selectedPotOdds && !potOddsCorrect) {
                  borderColor = 'border-red-500'
                  bg = 'bg-red-900/30'
                }
              }
              return (
                <button
                  key={idx}
                  disabled={selectedPotOdds !== null}
                  onClick={() => {
                    setSelectedPotOdds(idx)
                    const isCorrect = idx === question.correctPotOddsIdx
                    setStats(s => ({
                      total: s.total + 1,
                      correct: s.correct + (isCorrect ? 1 : 0),
                      streak: isCorrect ? s.streak + 1 : 0,
                      bestStreak: isCorrect ? Math.max(s.bestStreak, s.streak + 1) : s.bestStreak,
                    }))
                  }}
                  className={`p-4 rounded-xl border-2 text-center transition-colors ${borderColor} ${bg}`}
                >
                  <span className="text-lg font-bold">{opt}%</span>
                </button>
              )
            })}
          </div>

          {selectedPotOdds !== null && (
            <div className={`mt-4 p-4 rounded-lg ${potOddsCorrect ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-red-900/20 border border-red-800'}`}>
              <div className="font-semibold mb-1">
                {potOddsCorrect ? t('implied.correct') : t('implied.wrong')}
              </div>
              <div className="text-sm text-gray-300">
                {t('implied.potOddsFormula')
                  .replace('{bet}', String(question.betToCall))
                  .replace('{total}', String(question.pot + question.betToCall))}
                = {potOddsPercent}%
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {t('implied.potOddsMeaning').replace('{pct}', String(potOddsPercent))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase 2: Implied Odds */}
      {phase === 'impliedOdds' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">{t('implied.impliedOddsQuestion')}</h2>
          <p className="text-gray-300 text-sm mb-4">
            {t('implied.impliedOddsPrompt')
              .replace('{bet}', String(question.betToCall))
              .replace('{pot}', String(question.pot))
              .replace('{implied}', String(question.impliedWinnings))}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {impliedOddsOptionsFinal.map((opt, idx) => {
              let borderColor = 'border-gray-700 hover:border-gray-500'
              let bg = 'bg-gray-800'
              if (selectedImpliedOdds !== null) {
                if (idx === correctImpliedOddsIdx) {
                  borderColor = 'border-emerald-500'
                  bg = 'bg-emerald-900/30'
                } else if (idx === selectedImpliedOdds && !impliedOddsCorrect) {
                  borderColor = 'border-red-500'
                  bg = 'bg-red-900/30'
                }
              }
              return (
                <button
                  key={idx}
                  disabled={selectedImpliedOdds !== null}
                  onClick={() => {
                    setSelectedImpliedOdds(idx)
                    const isCorrect = idx === correctImpliedOddsIdx
                    setStats(s => ({
                      total: s.total + 1,
                      correct: s.correct + (isCorrect ? 1 : 0),
                      streak: isCorrect ? s.streak + 1 : 0,
                      bestStreak: isCorrect ? Math.max(s.bestStreak, s.streak + 1) : s.bestStreak,
                    }))
                    setPhase('done')
                  }}
                  className={`p-4 rounded-xl border-2 text-center transition-colors ${borderColor} ${bg}`}
                >
                  <span className="text-lg font-bold">{opt}%</span>
                </button>
              )
            })}
          </div>

          {selectedImpliedOdds !== null && (
            <div className={`mt-4 p-4 rounded-lg ${impliedOddsCorrect ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-red-900/20 border border-red-800'}`}>
              <div className="font-semibold mb-1">
                {impliedOddsCorrect ? t('implied.correct') : t('implied.wrong')}
              </div>
              <div className="text-sm text-gray-300">
                {t('implied.impliedOddsFormula')
                  .replace('{bet}', String(question.betToCall))
                  .replace('{total}', String(question.pot + question.betToCall + question.impliedWinnings))}
                = {correctImpliedOdds}%
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {t('implied.impliedOddsMeaning')
                  .replace('{pct}', String(correctImpliedOdds))
                  .replace('{draw}', String(question.draw.equity))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Done phase */}
      {phase === 'done' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('implied.summary')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">{t('implied.potOddsResult')}</div>
              <div className="text-xl font-bold text-yellow-400">{potOddsPercent}%</div>
              <div className="text-xs text-gray-400 mt-1">
                {t('implied.potOddsFormula')
                  .replace('{bet}', String(question.betToCall))
                  .replace('{total}', String(question.pot + question.betToCall))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">{t('implied.impliedOddsResult')}</div>
              <div className="text-xl font-bold text-emerald-400">{correctImpliedOdds}%</div>
              <div className="text-xs text-gray-400 mt-1">
                {t('implied.impliedOddsFormula')
                  .replace('{bet}', String(question.betToCall))
                  .replace('{total}', String(question.pot + question.betToCall + question.impliedWinnings))}
              </div>
            </div>
          </div>
          <div className={`p-4 rounded-lg ${question.draw.equity >= correctImpliedOdds ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-red-900/20 border border-red-800'}`}>
            <div className="font-semibold mb-1">
              {question.draw.equity >= correctImpliedOdds ? t('implied.profitableCall') : t('implied.unprofitableCall')}
            </div>
            <div className="text-sm text-gray-300">
              {t('implied.drawEquity')
                .replace('{draw}', drawName)
                .replace('{equity}', String(question.draw.equity))
                .replace('{impliedOdds}', String(correctImpliedOdds))}
            </div>
          </div>

          <button
            onClick={nextQuestion}
            className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors"
          >
            {t('implied.nextQuestion')}
          </button>
        </div>
      )}
    </div>
  )
}
