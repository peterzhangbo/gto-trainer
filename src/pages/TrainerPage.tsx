import { useState, useCallback, useMemo } from 'react'
import { getScenarioData, getAllScenarios, isPreflop, type ScenarioData } from '@/data/index'
import type { Card, Rank, Suit } from '@/types/poker'
import CardDisplay from '@/components/poker/CardDisplay'
import ActionButtons from '@/components/poker/ActionButtons'
import FrequencyBar from '@/components/poker/FrequencyBar'
import { supabase, isSupabaseConfigured } from '@/config/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'

// Map action keys to i18n labels
const ACTION_LABEL_KEYS: Record<string, string> = {
  fold: 'trainer.fold',
  call: 'trainer.call',
  raise: 'trainer.raise',
  check: 'trainer.check',
  '3bet': 'trainer.threebet',
  threeBet: 'trainer.threebet',
}

function getActionLabel(action: string, t: (key: string) => string): string {
  const key = ACTION_LABEL_KEYS[action]
  if (key) return t(key)
  return action
}

const ALL_SCENARIOS = getAllScenarios()

// Standard actions always shown in training
const STANDARD_ACTIONS = ['fold', 'call', 'raise']

function generateRandomHand(strategy: Record<string, Record<string, number>>): string {
  const entries = Object.entries(strategy)
  const weighted: [string, Record<string, number>][] = []
  for (const [hand, strat] of entries) {
    const actions = Object.keys(strat)
    if (actions.length === 1 && actions[0] === 'fold') {
      if (Math.random() < 0.15) weighted.push([hand, strat])
    } else {
      weighted.push([hand, strat])
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

export default function TrainerPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const preflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'preflop')
  const [selectedScenarioId, setSelectedScenarioId] = useState(preflopScenarios[0]?.id ?? '')
  const [sessionActive, setSessionActive] = useState(false)
  const [currentHand, setCurrentHand] = useState('')
  const [currentCards, setCurrentCards] = useState<Card[]>([])
  const [currentStrategy, setCurrentStrategy] = useState<Record<string, number>>({})
  const [drillState, setDrillState] = useState<'awaiting' | 'revealed'>('awaiting')
  const [lastResult, setLastResult] = useState<{ userAction: string; bestAction: string; score: number; isCorrect: boolean } | null>(null)
  const [results, setResults] = useState<{ isCorrect: boolean }[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [sessionSaved, setSessionSaved] = useState(false)
  const [showMobileStats, setShowMobileStats] = useState(false)

  const scenarioData = useMemo<ScenarioData | null>(() => {
    const meta = ALL_SCENARIOS.find((s) => s.id === selectedScenarioId)
    if (!meta) return null
    return getScenarioData({ scenarioType: meta.subCategory, position: meta.position, villainPosition: meta.villainPosition, boardTexture: meta.boardTexture })
  }, [selectedScenarioId])

  const generateDrill = useCallback(() => {
    if (!scenarioData || !isPreflop(scenarioData)) return
    const hand = generateRandomHand(scenarioData.hands)
    const strategy = scenarioData.hands[hand] ?? { fold: 1 }
    setCurrentHand(hand)
    setCurrentCards(handToCards(hand))
    setCurrentStrategy(strategy)
    setDrillState('awaiting')
    setLastResult(null)
  }, [scenarioData])

  const handleStart = async () => {
    if (!scenarioData) return
    setSessionActive(true)
    setResults([])
    setStreak(0)
    setBestStreak(0)

    // Create training session in Supabase
    if (user && isSupabaseConfigured) {
      const { error } = await supabase.from('training_sessions').insert({
        id: sessionId,
        user_id: user.id,
        scenario_type: ALL_SCENARIOS.find((s) => s.id === selectedScenarioId)?.subCategory ?? 'unknown',
        scenario_params: { scenarioId: selectedScenarioId },
      })
      if (error) {
        console.error('[Training] Failed to create session:', error)
      } else {
        setSessionSaved(true)
      }
    }

    generateDrill()
  }

  const submitAction = async (action: string) => {
    const actionFreq = currentStrategy[action] ?? 0
    const bestAction = Object.entries(currentStrategy).sort((a, b) => b[1] - a[1])[0]
    const isCorrect = action === bestAction[0]
    const score = actionFreq * 100

    setLastResult({ userAction: action, bestAction: bestAction[0], score, isCorrect })
    setDrillState('revealed')
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

    // Persist to Supabase if logged in
    if (user && isSupabaseConfigured && sessionSaved) {
      const meta = ALL_SCENARIOS.find((s) => s.id === selectedScenarioId)
      const { error } = await supabase.from('drill_results').insert({
        user_id: user.id,
        session_id: sessionId,
        hand: currentHand,
        position: meta?.position ?? null,
        scenario_type: meta?.subCategory ?? 'unknown',
        gto_action: bestAction[0],
        gto_frequencies: JSON.stringify(currentStrategy),
        user_action: action,
        score,
        is_correct: isCorrect,
      })
      if (error) {
        console.error('[Training] Failed to save drill result:', error)
      }
    }
  }

  const endSession = async () => {
    setSessionActive(false)

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
        console.error('[Training] Failed to update session:', error)
      }
    }
  }

  const totalHands = results.length
  const correctHands = results.filter((r) => r.isCorrect).length
  const accuracy = totalHands > 0 ? (correctHands / totalHands) * 100 : 0

  // Always show standard actions + any extra from strategy
  const allActionSet = new Set([...STANDARD_ACTIONS, ...Object.keys(currentStrategy)])
  const availableActions = [...allActionSet]

  // Scenario selection screen
  if (!sessionActive) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">{t('trainer.select')}</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
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
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="text-xs md:text-sm text-gray-500 mb-4 uppercase tracking-wider">
          {ALL_SCENARIOS.find((s) => s.id === selectedScenarioId)?.name}
        </div>

        <div className="flex gap-2 md:gap-3 mb-4 md:mb-6">
          {currentCards.map((card, i) => (
            <CardDisplay key={i} card={card} size="lg" />
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
            <div className="text-sm md:text-base text-gray-300 mb-6">
              {t('trainer.yourChoice')}: <span className="text-white font-bold">{getActionLabel(lastResult.userAction, t)}</span>
              {' → '} {t('trainer.score')}: <span className="text-white">{lastResult.score.toFixed(0)}</span>/100
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
