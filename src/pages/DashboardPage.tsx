import { useState } from 'react'

export default function DashboardPage() {
  // Mock data - will be replaced with real data from Supabase
  const [stats] = useState({
    totalDrills: 247,
    overallAccuracy: 68.4,
    preflopAccuracy: 72.1,
    postflopAccuracy: 61.8,
    currentStreak: 5,
    longestStreak: 12,
    bestScenario: 'RFI BTN',
    worstScenario: 'C-bet Wet',
    recentSessions: [
      { date: '2026-05-31', scenario: 'RFI BTN', hands: 50, accuracy: 74 },
      { date: '2026-05-30', scenario: '3bet SB vs BTN', hands: 30, accuracy: 62 },
      { date: '2026-05-29', scenario: 'RFI CO', hands: 45, accuracy: 70 },
      { date: '2026-05-28', scenario: 'C-bet Dry', hands: 25, accuracy: 58 },
    ],
  })

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">训练仪表板</h1>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="总训练手数" value={stats.totalDrills} />
          <StatCard label="整体正确率" value={`${stats.overallAccuracy}%`} />
          <StatCard label="翻前正确率" value={`${stats.preflopAccuracy}%`} />
          <StatCard label="翻后正确率" value={`${stats.postflopAccuracy}%`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Streak info */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">连续记录</h2>
            <div className="flex gap-8">
              <div>
                <div className="text-4xl font-bold text-orange-400">{stats.currentStreak}</div>
                <div className="text-sm text-gray-500 mt-1">当前连对</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-yellow-400">{stats.longestStreak}</div>
                <div className="text-sm text-gray-500 mt-1">最高连对</div>
              </div>
            </div>
          </div>

          {/* Best/Worst scenarios */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">场景表现</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">最强场景</span>
                <span className="text-green-400 font-semibold">{stats.bestScenario}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">最弱场景</span>
                <span className="text-red-400 font-semibold">{stats.worstScenario}</span>
              </div>
            </div>
          </div>

          {/* Recent sessions */}
          <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">最近训练</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 text-sm text-gray-500 font-normal">日期</th>
                    <th className="text-left py-2 text-sm text-gray-500 font-normal">场景</th>
                    <th className="text-right py-2 text-sm text-gray-500 font-normal">手数</th>
                    <th className="text-right py-2 text-sm text-gray-500 font-normal">正确率</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSessions.map((s, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-3 text-gray-400 text-sm">{s.date}</td>
                      <td className="py-3 text-white">{s.scenario}</td>
                      <td className="py-3 text-gray-300 text-right">{s.hands}</td>
                      <td className="py-3 text-right">
                        <span className={`font-semibold ${
                          s.accuracy >= 70 ? 'text-green-400' : s.accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {s.accuracy}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity heatmap placeholder */}
          <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">训练活跃度</h2>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 28 }, (_, i) => {
                const intensity = Math.random()
                return (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm"
                    style={{
                      backgroundColor: intensity > 0.7
                        ? '#22c55e'
                        : intensity > 0.4
                        ? '#15803d'
                        : intensity > 0.1
                        ? '#14532d'
                        : '#1f2937',
                    }}
                    title={`${Math.floor(intensity * 50)} 手`}
                  />
                )
              })}
            </div>
            <div className="flex justify-end gap-2 mt-2 text-xs text-gray-600">
              <span>少</span>
              <div className="w-3 h-3 rounded-sm bg-gray-800" />
              <div className="w-3 h-3 rounded-sm bg-green-900" />
              <div className="w-3 h-3 rounded-sm bg-green-700" />
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span>多</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}
