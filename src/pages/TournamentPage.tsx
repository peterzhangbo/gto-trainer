import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import {
  getScenarioData,
  getScenarioById,
  getAllScenarios,
  isPreflop,
  type ScenarioData,
} from '@/data/index'
import type { Card, Rank, Suit } from '@/types/poker'
import CardDisplay from '@/components/poker/CardDisplay'
import ActionButtons from '@/components/poker/ActionButtons'
import FrequencyBar from '@/components/poker/FrequencyBar'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TournamentStage = 'early' | 'middle' | 'bubble' | 'finalTable'

const STAGES: { key: TournamentStage; color: string }[] = [
  { key: 'early', color: 'border-green-600 bg-green-900/30 ring-green-600' },
  { key: 'middle', color: 'border-blue-600 bg-blue-900/30 ring-blue-600' },
  { key: 'bubble', color: 'border-red-600 bg-red-900/30 ring-red-600' },
  { key: 'finalTable', color: 'border-yellow-600 bg-yellow-900/30 ring-yellow-600' },
]

interface PayoutStructure {
  first: number
  second: number
  third: number
}

const DEFAULT_PAYOUT: PayoutStructure = { first: 50, second: 30, third: 20 }

// Stage-based range tightening multipliers (applied to raise/3bet frequencies)
const STAGE_TIGHTENING: Record<TournamentStage, number> = {
  early: 1.0,
  middle: 0.9,
  bubble: 0.65,
  finalTable: 0.8,
}

// ICM pressure: how much each chip is worth in tournament equity
function calculateICMPressure(
  heroStack: number,
  villainStack: number,
  payout: PayoutStructure,
  stage: TournamentStage,
): number {
  const totalChips = heroStack + villainStack
  if (totalChips === 0) return 0
  const chipShare = heroStack / totalChips
  const basePct =
    chipShare * payout.first +
    (1 - chipShare) * payout.second +
    (chipShare * 0.3) * payout.third

  // Pressure amplifies near bubble
  const stageMultiplier = stage === 'bubble' ? 1.8 : stage === 'finalTable' ? 1.3 : 1.0
  return basePct * stageMultiplier
}

// ---------------------------------------------------------------------------
// Hand / Card helpers
// ---------------------------------------------------------------------------

const SUITS_ARR: Suit[] = ['s', 'h', 'd', 'c']

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

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
  let s2: Suit
  do { s2 = pickRandom(SUITS_ARR) } while (s2 === s1)
  return [
    { rank: r1, suit: s1 },
    { rank: r2, suit: s2 },
  ]
}

function isFoldOnly(entry: Record<string, number>): boolean {
  const keys = Object.keys(entry)
  return keys.length === 1 && keys[0] === 'fold' && entry.fold === 1
}

// Apply ICM tightening to strategy frequencies
function tightenStrategy(
  strategy: Record<string, number>,
  tightening: number,
): Record<string, number> {
  if (isFoldOnly(strategy)) return strategy

  const result: Record<string, number> = {}
  let nonFoldTotal = 0

  for (const [action, freq] of Object.entries(strategy)) {
    if (action === 'fold') continue
    result[action] = freq * tightening
    nonFoldTotal += freq * tightening
  }

  // Normalize non-fold actions so they sum correctly
  if (nonFoldTotal > 0) {
    for (const action of Object.keys(result)) {
      result[action] = result[action] / nonFoldTotal * nonFoldTotal
    }
    // Fold gets the remainder
    result.fold = Math.max(0, 1 - nonFoldTotal)
  } else {
    result.fold = 1
  }

  return result
}

function generateRandomHand(strategy: Record<string, Record<string, number>>): string {
  const entries = Object.entries(strategy)
  const weighted: [string, Record<string, number>][] = []
  for (const [hand, strat] of entries) {
    const actions = Object.keys(strat)
    const isFoldOnlyHand = actions.length === 1 && actions[0] === 'fold' && strat.fold === 1
    if (isFoldOnlyHand) {
      if (Math.random() < 0.35) weighted.push([hand, strat])
    } else {
      weighted.push([hand, strat])
    }
  }
  if (weighted.length === 0) {
    for (const [hand, strat] of entries) {
      weighted.push([hand, strat])
    }
  }
  if (weighted.length === 0) return entries[0]?.[0] ?? 'AA'
  return weighted[Math.floor(Math.random() * weighted.length)][0]
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ALL_SCENARIOS = getAllScenarios()
const PREFLOP_STANDARD_ACTIONS = ['fold', 'call', 'raise']

export default function TournamentPage() {
  const { t } = useI18n()
  const preflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'preflop')

  // Setup state
  const [stage, setStage] = useState<TournamentStage>('early')
  const [heroStack, setHeroStack] = useState(30)
  const [villainStack, setVillainStack] = useState(30)
  const [payout, setPayout] = useState<PayoutStructure>({ ...DEFAULT_PAYOUT })
  const [selectedScenarioId, setSelectedScenarioId] = useState(preflopScenarios[0]?.id ?? '')

  // Session state
  const [sessionActive, setSessionActive] = useState(false)
  const [currentHand, setCurrentHand] = useState('')
  const [currentCards, setCurrentCards] = useState<Card[]>([])
  const [currentStrategy, setCurrentStrategy] = useState<Record<string, number>>({})
  const [originalStrategy, setOriginalStrategy] = useState<Record<string, number>>({})
  const [drillState, setDrillState] = useState<'awaiting' | 'revealed'>('awaiting')
  const [lastResult, setLastResult] = useState<{
    userAction: string
    bestAction: string
    bestFreq: number
    score: number
    isCorrect: boolean
    chipEV: number
    icmEV: number
  } | null>(null)
  const [results, setResults] = useState<{ isCorrect: boolean }[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [showMobileStats, setShowMobileStats] = useState(false)

  // Auto-advance
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

  const tightening = STAGE_TIGHTENING[stage]
  const icmPressure = calculateICMPressure(heroStack, villainStack, payout, stage)

  const generateDrill = useCallback(() => {
    if (!scenarioData || !isPreflop(scenarioData)) return
    const hand = generateRandomHand(scenarioData.hands)
    const origStrategy = scenarioData.hands[hand] ?? { fold: 1 }
    const adjustedStrategy = tightenStrategy(origStrategy, tightening)

    setCurrentHand(hand)
    setCurrentCards(handToCards(hand))
    setOriginalStrategy(origStrategy)
    setCurrentStrategy(adjustedStrategy)
    setDrillState('awaiting')
    setLastResult(null)
  }, [scenarioData, tightening])

  // Auto-advance effect
  useEffect(() => {
    if (drillState === 'revealed' && autoAdvance) {
      autoAdvanceTimer.current = setTimeout(() => {
        generateDrill()
      }, autoAdvanceDelay * 1000)
      return () => {
        if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
      }
    }
  }, [drillState, autoAdvance, autoAdvanceDelay, generateDrill])

  const handleStart = () => {
    if (!scenarioData || !isPreflop(scenarioData)) return
    setSessionActive(true)
    setResults([])
    setStreak(0)
    setBestStreak(0)
    generateDrill()
  }

  const submitAction = (action: string) => {
    // Chip EV: based on original (unadjusted) strategy
    const chipEV = (originalStrategy[action] ?? 0) * 100
    // ICM EV: based on tightened strategy
    const icmEV = (currentStrategy[action] ?? 0) * 100

    const bestEntry = Object.entries(currentStrategy).sort((a, b) => b[1] - a[1])[0]
    const bestAction = bestEntry[0]
    const bestFreq = bestEntry[1]
    const isCorrect = action === bestAction

    const result = { userAction: action, bestAction, bestFreq, score: icmEV, isCorrect, chipEV, icmEV }
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

    setDrillState('revealed')
  }

  const endSession = () => {
    setSessionActive(false)
  }

  const totalHands = results.length
  const correctHands = results.filter((r) => r.isCorrect).length
  const accuracy = totalHands > 0 ? (correctHands / totalHands) * 100 : 0

  // Setup screen
  if (!sessionActive) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('tournament.title')}</h1>
          <p className="text-gray-500 mb-6 md:mb-8 text-sm">{t('tournament.subtitle')}</p>

          {/* Tournament Stage */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">{t('tournament.stage')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STAGES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStage(s.key)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    stage === s.key
                      ? `${s.color} ring-1`
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{t(`tournament.${s.key}`)}</div>
                  <div className="text-xs text-gray-500 mt-1">{t(`tournament.${s.key}Desc`)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Stack Sizes */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">{t('tournament.stackSizes')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('tournament.heroStack')} (BB)</label>
                <input
                  type="number"
                  value={heroStack}
                  onChange={(e) => setHeroStack(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('tournament.villainStack')} (BB)</label>
                <input
                  type="number"
                  value={villainStack}
                  onChange={(e) => setVillainStack(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Payout Structure */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">{t('tournament.payout')}</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">1st (%)</label>
                <input
                  type="number"
                  value={payout.first}
                  onChange={(e) => setPayout((p) => ({ ...p, first: Math.max(0, Number(e.target.value)) }))}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">2nd (%)</label>
                <input
                  type="number"
                  value={payout.second}
                  onChange={(e) => setPayout((p) => ({ ...p, second: Math.max(0, Number(e.target.value)) }))}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">3rd (%)</label>
                <input
                  type="number"
                  value={payout.third}
                  onChange={(e) => setPayout((p) => ({ ...p, third: Math.max(0, Number(e.target.value)) }))}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ICM Pressure Indicator */}
          <div className="mb-6 md:mb-8 bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('tournament.icmPressure')}</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(icmPressure * 2, 100)}%`,
                    backgroundColor:
                      icmPressure > 35 ? '#ef4444' : icmPressure > 25 ? '#f97316' : '#22c55e',
                  }}
                />
              </div>
              <span className="text-white font-mono text-sm">{icmPressure.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{t('tournament.icmPressureDesc')}</p>
          </div>

          {/* Scenario selector */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">{t('trainer.select')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {preflopScenarios.slice(0, 6).map((s) => (
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
                  <h3 className="text-base font-semibold text-white mt-1">
                    {s.position ? `${s.position} ` : ''}{s.name}
                  </h3>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!scenarioData}
            className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded-lg font-semibold text-lg transition-colors"
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
        {/* Stage badge */}
        <div className="mb-2 px-3 py-1 rounded-full bg-gray-800 text-xs text-gray-400">
          {t(`tournament.${stage}`)} &middot; {heroStack}BB / {villainStack}BB &middot; ICM: {icmPressure.toFixed(1)}%
        </div>

        <div className="text-xs md:text-sm text-gray-500 mb-4 uppercase tracking-wider">
          {scenarioName}
        </div>

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
            actions={[...new Set([...PREFLOP_STANDARD_ACTIONS, ...Object.keys(currentStrategy)])]}
            onSelect={submitAction}
          />
        )}

        {drillState === 'revealed' && lastResult && (
          <div className="text-center max-w-lg w-full px-2">
            <div className={`text-xl md:text-2xl font-bold mb-4 ${lastResult.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {lastResult.isCorrect ? t('trainer.correct') : t('trainer.wrong')}
            </div>
            <div className="text-sm md:text-base text-gray-300 mb-2">
              {t('trainer.yourChoice')}: <span className="text-white font-bold">{getActionLabel(lastResult.userAction, t)}</span>
            </div>

            {/* Chip EV vs ICM EV */}
            <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">{t('tournament.chipEV')}</div>
                <div className="text-lg font-bold text-blue-400">{lastResult.chipEV.toFixed(0)}/100</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{t('tournament.icmEV')}</div>
                <div className="text-lg font-bold text-orange-400">{lastResult.icmEV.toFixed(0)}/100</div>
              </div>
            </div>

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
        <h3 className="text-lg font-semibold text-white mb-4">{t('tournament.tournamentInfo')}</h3>
        <div className="space-y-3 mb-6">
          <div>
            <div className="text-sm text-gray-500">{t('tournament.stage')}</div>
            <div className="text-white font-medium">{t(`tournament.${stage}`)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t('tournament.icmPressure')}</div>
            <div className="text-orange-400 font-bold">{icmPressure.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t('tournament.tightening')}</div>
            <div className="text-white font-mono">{Math.round((1 - tightening) * 100)}%</div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-white mb-4">{t('trainer.stats')}</h3>
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
