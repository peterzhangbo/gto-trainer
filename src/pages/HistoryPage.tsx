import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { supabase, isSupabaseConfigured } from '@/config/supabase'
import CardDisplay from '@/components/poker/CardDisplay'
import type { Card, Rank, Suit } from '@/types/poker'

interface SessionRow {
  id: string
  scenario_type: string
  scenario_params: string
  started_at: string
  ended_at: string | null
  total_hands: number
  correct_hands: number
  accuracy: number | null
}

interface DrillRow {
  id: string
  session_id: string
  hand: string
  scenario_type: string
  user_action: string
  gto_action: string
  score: number
  is_correct: boolean
  created_at: string
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

export default function HistoryPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [drills, setDrills] = useState<DrillRow[]>([])
  const [loading, setLoading] = useState(!!user && isSupabaseConfigured)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return

    async function fetchData() {
      const [sessionsRes, drillsRes] = await Promise.all([
        supabase
          .from('training_sessions')
          .select('*')
          .eq('user_id', user!.id)
          .order('started_at', { ascending: false }),
        supabase
          .from('drill_results')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false }),
      ])

      if (sessionsRes.data) setSessions(sessionsRes.data)
      if (drillsRes.data) setDrills(drillsRes.data)
      setLoading(false)
    }

    fetchData()
  }, [user])

  const scenarioNames: Record<string, string> = {
    rfi: t('scenario.rfi'),
    threeBet: t('scenario.threebet'),
    defend: t('scenario.defend'),
    'c-bet': t('scenario.cbet'),
    turn: t('scenario.turn'),
    river: t('scenario.river'),
  }

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const groups: Record<string, SessionRow[]> = {}
    for (const s of sessions) {
      if (s.total_hands === 0) continue
      const dateKey = new Date(s.started_at).toLocaleDateString()
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(s)
    }
    return groups
  }, [sessions])

  // Accuracy over time for chart (last 10 sessions with data)
  const accuracyChart = useMemo(() => {
    return sessions
      .filter((s) => s.total_hands > 0 && s.accuracy != null)
      .slice(0, 10)
      .reverse()
      .map((s) => ({
        date: new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        accuracy: s.accuracy ?? 0,
      }))
  }, [sessions])

  const drillsForSession = (sessionId: string) => {
    return drills.filter((d) => d.session_id === sessionId)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">{t('history.title')}</h1>
          <p className="text-gray-400">{t('history.loginFirst')}</p>
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
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">{t('history.title')}</h1>

        {/* Accuracy chart */}
        {accuracyChart.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 md:p-6 mb-6 md:mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">{t('dash.accuracy')}</h2>
            <div className="flex items-end gap-1.5 h-32">
              {accuracyChart.map((point, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500">{Math.round(point.accuracy)}%</span>
                  <div
                    className={`w-full rounded-t transition-all ${
                      point.accuracy >= 70 ? 'bg-green-500' :
                      point.accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ height: `${Math.max(point.accuracy, 4)}%` }}
                  />
                  <span className="text-[9px] text-gray-600 truncate w-full text-center">
                    {point.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessions grouped by date */}
        {Object.keys(groupedSessions).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">{t('history.noSessions')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSessions).map(([date, dateSessions]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-gray-500 mb-3 px-1">{date}</h3>
                <div className="space-y-3">
                  {dateSessions.map((session) => {
                    const isExpanded = expandedSession === session.id
                    const sessionDrills = isExpanded ? drillsForSession(session.id) : []

                    return (
                      <div
                        key={session.id}
                        className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
                      >
                        {/* Session header */}
                        <button
                          onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                          className="w-full p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3 text-left hover:bg-gray-800/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-semibold">
                                {scenarioNames[session.scenario_type] ?? session.scenario_type}
                              </span>
                              <span className="text-xs text-gray-500 uppercase px-2 py-0.5 bg-gray-800 rounded">
                                {session.scenario_type}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(session.started_at).toLocaleTimeString()}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="text-center">
                              <div className="text-xs text-gray-500">{t('history.handsPlayed')}</div>
                              <div className="text-white font-semibold">{session.total_hands}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500">{t('dash.accuracy')}</div>
                              <div className={`font-semibold ${
                                (session.accuracy ?? 0) >= 70 ? 'text-green-400' :
                                (session.accuracy ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {session.accuracy != null ? `${Math.round(session.accuracy)}%` : '-'}
                              </div>
                            </div>
                            <span className="text-gray-500 text-sm">
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </div>
                        </button>

                        {/* Expanded drill details */}
                        {isExpanded && sessionDrills.length > 0 && (
                          <div className="border-t border-gray-800 p-4 md:p-5">
                            <div className="text-sm text-gray-500 mb-3">
                              {sessionDrills.length} {t('history.handsPlayed').toLowerCase()}
                            </div>
                            <div className="space-y-2">
                              {sessionDrills.map((drill) => {
                                const cards = handToCards(drill.hand)
                                return (
                                  <div
                                    key={drill.id}
                                    className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg ${
                                      drill.is_correct ? 'bg-green-900/10 border border-green-900/20' : 'bg-red-900/10 border border-red-900/20'
                                    }`}
                                  >
                                    {/* Hand */}
                                    <div className="flex items-center gap-2">
                                      <div className="flex gap-1">
                                        {cards.map((card, i) => (
                                          <CardDisplay key={i} card={card} size="sm" />
                                        ))}
                                      </div>
                                      <span className="text-white font-mono text-sm font-bold">{drill.hand}</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 flex-1">
                                      <span className="text-sm text-gray-400">
                                        {t('trainer.yourChoice')}: <span className="text-white">{getActionLabel(drill.user_action, t)}</span>
                                      </span>
                                      <span className="text-gray-600">{'→'}</span>
                                      <span className="text-sm text-gray-400">
                                        {t('drill.gtoLabel')}: <span className="text-green-400">{getActionLabel(drill.gto_action, t)}</span>
                                      </span>
                                    </div>

                                    {/* Score & indicator */}
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-mono text-gray-400">
                                        {t('history.score')}: {drill.score.toFixed(0)}
                                      </span>
                                      <span className={`text-sm font-bold ${
                                        drill.is_correct ? 'text-green-400' : 'text-red-400'
                                      }`}>
                                        {drill.is_correct ? t('history.correct') : t('history.wrong')}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
