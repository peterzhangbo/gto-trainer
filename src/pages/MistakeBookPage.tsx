import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { supabase, isSupabaseConfigured } from '@/config/supabase'
import { getAllScenarios } from '@/data/index'
import CardDisplay from '@/components/poker/CardDisplay'
import FrequencyBar from '@/components/poker/FrequencyBar'
import type { Card, Rank, Suit } from '@/types/poker'

interface DrillRow {
  id: string
  hand: string
  scenario_type: string
  user_action: string
  gto_action: string
  gto_frequencies: string
  score: number
  is_correct: boolean
  created_at: string
  position: string | null
}

const ALL_SCENARIOS = getAllScenarios()
const SCENARIO_TYPES = ['rfi', 'threeBet', 'defend', 'c-bet', 'turn', 'river']

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

export default function MistakeBookPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [mistakes, setMistakes] = useState<DrillRow[]>([])
  const [loading, setLoading] = useState(!!user && isSupabaseConfigured)
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return

    async function fetchMistakes() {
      const { data, error } = await supabase
        .from('drill_results')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_correct', false)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[MistakeBook] Failed to fetch:', error)
      } else if (data) {
        setMistakes(data)
      }
      setLoading(false)
    }

    fetchMistakes()
  }, [user])

  const scenarioNames: Record<string, string> = {
    rfi: t('scenario.rfi'),
    threeBet: t('scenario.threebet'),
    defend: t('scenario.defend'),
    'c-bet': t('scenario.cbet'),
    turn: t('scenario.turn'),
    river: t('scenario.river'),
  }

  const filtered = useMemo(() => {
    if (filterType === 'all') return mistakes
    return mistakes.filter((m) => m.scenario_type === filterType)
  }, [mistakes, filterType])

  // Accuracy per scenario
  const scenarioAccuracy = useMemo(() => {
    const stats: Record<string, { wrong: number; total: number }> = {}
    for (const m of mistakes) {
      if (!stats[m.scenario_type]) stats[m.scenario_type] = { wrong: 0, total: 0 }
      stats[m.scenario_type].wrong++
    }
    return stats
  }, [mistakes])

  const handleRepractice = (drill: DrillRow) => {
    const scenario = ALL_SCENARIOS.find((s) => s.subCategory === drill.scenario_type)
    if (scenario) {
      navigate('/trainer')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">{t('mistake.title')}</h1>
          <p className="text-gray-400">{t('mistake.loginFirst')}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">{t('history.loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t('mistake.title')}</h1>
          <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-2">
            <span className="text-sm text-gray-400">{t('mistake.total')}: </span>
            <span className="text-xl font-bold text-red-400">{mistakes.length}</span>
          </div>
        </div>

        {/* Scenario accuracy summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {SCENARIO_TYPES.map((type) => {
            const stat = scenarioAccuracy[type]
            return (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                className={`p-3 rounded-lg border text-center transition-all ${
                  filterType === type
                    ? 'bg-red-900/30 border-red-600 ring-1 ring-red-600'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="text-xs text-gray-500">{scenarioNames[type] ?? type}</div>
                <div className="text-lg font-bold text-red-400">{stat?.wrong ?? 0}</div>
              </button>
            )
          })}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t('mistake.filterAll')} ({mistakes.length})
          </button>
          {SCENARIO_TYPES.map((type) => {
            const count = mistakes.filter((m) => m.scenario_type === type).length
            if (count === 0) return null
            return (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {scenarioNames[type] ?? type} ({count})
              </button>
            )
          })}
        </div>

        {/* Mistake cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">{'✨'}</div>
            <p className="text-gray-400 text-lg">{t('mistake.noMistakes')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((drill) => {
              let frequencies: Record<string, number> = {}
              try {
                frequencies = JSON.parse(drill.gto_frequencies || '{}')
              } catch {
                // ignore parse errors
              }
              const cards = handToCards(drill.hand)

              return (
                <div
                  key={drill.id}
                  className="bg-gray-900 rounded-xl border border-gray-800 p-4 md:p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Hand display */}
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {cards.map((card, i) => (
                          <CardDisplay key={i} card={card} size="sm" />
                        ))}
                      </div>
                      <div>
                        <div className="text-white font-mono font-bold">{drill.hand}</div>
                        <div className="text-xs text-gray-500">
                          {scenarioNames[drill.scenario_type] ?? drill.scenario_type}
                        </div>
                      </div>
                    </div>

                    {/* Action comparison */}
                    <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-6">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">{t('mistake.yourAction')}</div>
                        <span className="inline-block px-3 py-1 rounded bg-red-900/40 text-red-300 text-sm font-semibold">
                          {getActionLabel(drill.user_action, t)}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">{t('mistake.correctAction')}</div>
                        <span className="inline-block px-3 py-1 rounded bg-green-900/40 text-green-300 text-sm font-semibold">
                          {getActionLabel(drill.gto_action, t)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">{t('mistake.frequencies')}</div>
                        <FrequencyBar strategy={frequencies} userAction={drill.user_action} />
                      </div>
                    </div>

                    {/* Re-practice button and date */}
                    <div className="flex flex-row md:flex-col items-center md:items-end gap-2">
                      <button
                        onClick={() => handleRepractice(drill)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium transition-colors whitespace-nowrap"
                      >
                        {t('mistake.repractice')}
                      </button>
                      <span className="text-xs text-gray-600">
                        {new Date(drill.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
