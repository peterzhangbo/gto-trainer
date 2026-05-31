import { useState, useMemo } from 'react'
import { getScenarioData, getAllScenarios, isPreflop, type ScenarioData } from '@/data/index'
import HandMatrix from '@/components/poker/HandMatrix'
import type { StrategyEntry } from '@/types/poker'

export default function RangeViewerPage() {
  const scenarios = getAllScenarios()
  const preflopScenarios = scenarios.filter((s) => s.category === 'preflop')
  const postflopScenarios = scenarios.filter((s) => s.category === 'postflop')

  const [selectedId, setSelectedId] = useState(preflopScenarios[0]?.id ?? '')
  const [selectedHand, setSelectedHand] = useState<string | null>(null)

  const data = useMemo<ScenarioData | null>(() => {
    const meta = scenarios.find((s) => s.id === selectedId)
    if (!meta) return null
    return getScenarioData({
      scenarioType: meta.subCategory,
      position: meta.position,
      villainPosition: meta.villainPosition,
      boardTexture: meta.boardTexture,
    })
  }, [selectedId, scenarios])

  const strategy = useMemo<Record<string, StrategyEntry>>(() => {
    if (!data || !isPreflop(data)) return {}
    return data.hands as Record<string, StrategyEntry>
  }, [data])

  const selectedEntry = selectedHand ? strategy[selectedHand] ?? null : null

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">范围查看器</h1>

        {/* Scenario selectors */}
        <div className="mb-8 space-y-4">
          <div>
            <h2 className="text-sm text-gray-500 mb-2 uppercase tracking-wider">翻前范围</h2>
            <div className="flex gap-2 flex-wrap">
              {preflopScenarios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setSelectedHand(null) }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedId === s.id
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s.position ? `${s.position} ` : ''}{s.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm text-gray-500 mb-2 uppercase tracking-wider">翻后范围</h2>
            <div className="flex gap-2 flex-wrap">
              {postflopScenarios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setSelectedHand(null) }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedId === s.id
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-8 items-start">
          {/* HandMatrix component */}
          <HandMatrix
            strategy={strategy}
            selectedHand={selectedHand}
            onSelectHand={setSelectedHand}
          />

          {/* Detail panel */}
          <div className="w-64 flex-shrink-0">
            {selectedHand ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="text-2xl font-bold text-white mb-4">{selectedHand}</h3>
                {selectedEntry ? (
                  <div className="space-y-3">
                    {Object.entries(selectedEntry).map(([action, freq]) => (
                      <div key={action}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">{action}</span>
                          <span className="text-white font-mono">{((freq as number) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all bg-red-500"
                            style={{ width: `${(freq as number) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">弃牌 100%</p>
                )}
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-gray-500 text-center">
                点击矩阵中的手牌查看详细策略
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
