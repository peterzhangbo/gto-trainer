import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { supabase, isSupabaseConfigured } from '@/config/supabase'

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
  hand: string
  scenario_type: string
  user_action: string
  gto_action: string
  score: number
  is_correct: boolean
  created_at: string
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [drills, setDrills] = useState<DrillRow[]>([])
  const [loading, setLoading] = useState(!!user && isSupabaseConfigured)

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

  // Compute stats
  const totalDrills = drills.length
  const correctDrills = drills.filter((d) => d.is_correct).length
  const overallAccuracy = totalDrills > 0 ? Math.round((correctDrills / totalDrills) * 100 * 10) / 10 : 0

  // Preflop vs postflop
  const preflopDrills = drills.filter((d) => ['rfi', 'threeBet', 'defend'].includes(d.scenario_type))
  const postflopDrills = drills.filter((d) => ['c-bet', 'turn', 'river'].includes(d.scenario_type))
  const preflopAccuracy = preflopDrills.length > 0
    ? Math.round((preflopDrills.filter((d) => d.is_correct).length / preflopDrills.length) * 100 * 10) / 10
    : 0
  const postflopAccuracy = postflopDrills.length > 0
    ? Math.round((postflopDrills.filter((d) => d.is_correct).length / postflopDrills.length) * 100 * 10) / 10
    : 0

  // Current streak
  let currentStreak = 0
  for (const d of drills) {
    if (d.is_correct) currentStreak++
    else break
  }

  // Longest streak
  let longestStreak = 0
  let streak = 0
  for (const d of [...drills].reverse()) {
    if (d.is_correct) {
      streak++
      longestStreak = Math.max(longestStreak, streak)
    } else {
      streak = 0
    }
  }

  // Scenario accuracy
  const scenarioStats: Record<string, { correct: number; total: number }> = {}
  for (const d of drills) {
    if (!scenarioStats[d.scenario_type]) scenarioStats[d.scenario_type] = { correct: 0, total: 0 }
    scenarioStats[d.scenario_type].total++
    if (d.is_correct) scenarioStats[d.scenario_type].correct++
  }

  const scenarioNames: Record<string, string> = {
    rfi: `${t('scenario.rfi')}`,
    threeBet: `${t('scenario.threebet')}`,
    defend: `${t('scenario.defend')}`,
    'c-bet': `${t('scenario.cbet')}`,
    turn: `${t('scenario.turn')}`,
    river: `${t('scenario.river')}`,
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">{t('dash.title')}</h1>
          <p className="text-gray-400">{t('dash.loginFirst')}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">{t('dash.loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">{t('dash.title')}</h1>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard label={t('dash.total')} value={totalDrills} />
          <StatCard label={t('dash.overall')} value={`${overallAccuracy}%`} />
          <StatCard label={t('dash.preflop')} value={preflopDrills.length > 0 ? `${preflopAccuracy}%` : '-'} />
          <StatCard label={t('dash.postflop')} value={postflopDrills.length > 0 ? `${postflopAccuracy}%` : '-'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Streak */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">{t('dash.streak')}</h2>
            <div className="flex gap-8">
              <div>
                <div className="text-2xl md:text-4xl font-bold text-orange-400">{currentStreak}</div>
                <div className="text-xs md:text-sm text-gray-500 mt-1">{t('dash.current')}</div>
              </div>
              <div>
                <div className="text-2xl md:text-4xl font-bold text-yellow-400">{longestStreak}</div>
                <div className="text-xs md:text-sm text-gray-500 mt-1">{t('dash.longest')}</div>
              </div>
            </div>
          </div>

          {/* Scenario breakdown */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">{t('dash.performance')}</h2>
            <div className="space-y-3">
              {Object.entries(scenarioStats).map(([type, stat]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-gray-400">{scenarioNames[type] ?? type}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          (stat.correct / stat.total) >= 0.7 ? 'bg-green-500' :
                          (stat.correct / stat.total) >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(stat.correct / stat.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-white font-mono text-sm w-16 text-right">
                      {Math.round((stat.correct / stat.total) * 100)}%
                    </span>
                    <span className="text-gray-600 text-xs w-12 text-right">
                      {stat.total}{t('dash.handsSuffix')}
                    </span>
                  </div>
                </div>
              ))}
              {Object.keys(scenarioStats).length === 0 && (
                <p className="text-gray-500">{t('dash.noData')}</p>
              )}
            </div>
          </div>

          {/* Recent sessions */}
          <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">{t('dash.recent')}</h2>
            {sessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 text-sm text-gray-500 font-normal">{t('dash.date')}</th>
                      <th className="text-left py-2 text-sm text-gray-500 font-normal">{t('dash.scenario')}</th>
                      <th className="text-right py-2 text-sm text-gray-500 font-normal">{t('dash.hands')}</th>
                      <th className="text-right py-2 text-sm text-gray-500 font-normal">{t('dash.accuracy')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.filter((s) => s.total_hands > 0).map((s) => (
                      <tr key={s.id} className="border-b border-gray-800/50">
                        <td className="py-3 text-gray-400 text-sm">
                          {new Date(s.started_at).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="py-3 text-white">{scenarioNames[s.scenario_type] ?? s.scenario_type}</td>
                        <td className="py-3 text-gray-300 text-right">{s.total_hands}</td>
                        <td className="py-3 text-right">
                          <span className={`font-semibold ${
                            (s.accuracy ?? 0) >= 70 ? 'text-green-400' :
                            (s.accuracy ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {s.accuracy ?? '-'}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">{t('dash.goTrain')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 md:p-4">
      <div className="text-xs md:text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold text-white">{value}</div>
    </div>
  )
}
