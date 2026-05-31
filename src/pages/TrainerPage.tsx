import { useState, useCallback, useMemo } from 'react'
import { getScenarioData, getAllScenarios, isPreflop, type ScenarioData } from '@/data/index'
import CardDisplay from '@/components/poker/CardDisplay'
import ActionButtons from '@/components/poker/ActionButtons'
import FrequencyBar from '@/components/poker/FrequencyBar'
import PositionSelector from '@/components/poker/PositionSelector'

const ALL_SCENARIOS = getAllScenarios()

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

function handToCards(hand: string): { rank: string; suit: string }[] {
  const SUITS = ['s', 'h', 'd', 'c']
  const r1 = hand[0]
  const r2 = hand[1]
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
  const preflopScenarios = ALL_SCENARIOS.filter((s) => s.category === 'preflop')
  const [selectedScenarioId, setSelectedScenarioId] = useState(preflopScenarios[0]?.id ?? '')
  const [selectedPosition, setSelectedPosition] = useState('BTN')
  const [sessionActive, setSessionActive] = useState(false)
  const [currentHand, setCurrentHand] = useState('')
  const [currentCards, setCurrentCards] = useState<{ rank: string; suit: string }[]>([])
  const [currentStrategy, setCurrentStrategy] = useState<Record<string, number>>({})
  const [drillState, setDrillState] = useState<'awaiting' | 'revealed'>('awaiting')
  const [lastResult, setLastResult] = useState<{ userAction: string; bestAction: string; score: number; isCorrect: boolean } | null>(null)
  const [results, setResults] = useState<{ isCorrect: boolean }[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

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

  const handleStart = () => {
    if (!scenarioData) return
    setSessionActive(true)
    setResults([])
    setStreak(0)
    setBestStreak(0)
    generateDrill()
  }

  const submitAction = (action: string) => {
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
  }

  const endSession = () => {
    setSessionActive(false)
  }

  const totalHands = results.length
  const correctHands = results.filter((r) => r.isCorrect).length
  const accuracy = totalHands > 0 ? (correctHands / totalHands) * 100 : 0

  const availableActions = Object.keys(currentStrategy)

  // Scenario selection screen
  if (!sessionActive) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">选择训练场景</h1>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
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

          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">选择位置</h2>
            <PositionSelector
              selected={selectedPosition}
              onSelect={setSelectedPosition}
            />
          </div>

          <button
            onClick={handleStart}
            disabled={!scenarioData}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded-lg font-semibold text-lg transition-colors"
          >
            开始训练
          </button>
        </div>
      </div>
    )
  }

  // Training session
  return (
    <div className="min-h-screen bg-gray-950 flex">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-sm text-gray-500 mb-4 uppercase tracking-wider">
          {ALL_SCENARIOS.find((s) => s.id === selectedScenarioId)?.name}
        </div>

        {/* Cards using CardDisplay component */}
        <div className="flex gap-3 mb-6">
          {currentCards.map((card, i) => (
            <CardDisplay key={i} card={card} size="lg" />
          ))}
        </div>

        <div className="text-lg text-gray-400 mb-8">
          手牌: <span className="text-white font-mono font-bold text-xl">{currentHand}</span>
        </div>

        {/* Action buttons */}
        {drillState === 'awaiting' && (
          <ActionButtons
            actions={availableActions}
            onSelect={submitAction}
          />
        )}

        {/* Result */}
        {drillState === 'revealed' && lastResult && (
          <div className="text-center max-w-lg w-full">
            <div className={`text-2xl font-bold mb-4 ${lastResult.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {lastResult.isCorrect ? '✓ 正确！' : '✗ 不是最优选择'}
            </div>
            <div className="text-gray-300 mb-6">
              你的选择: <span className="text-white font-bold">{lastResult.userAction}</span>
              {' → '} 得分: <span className="text-white">{lastResult.score.toFixed(0)}</span>/100
            </div>

            {/* Frequency bar */}
            <div className="mb-6">
              <div className="text-sm text-gray-500 mb-2">GTO 频率分布</div>
              <FrequencyBar
                strategy={currentStrategy}
                userAction={lastResult.userAction}
              />
            </div>

            <button
              onClick={generateDrill}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
            >
              下一题 →
            </button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-l border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-6">训练统计</h3>
        <div className="space-y-4">
          <StatItem label="总手数" value={totalHands} />
          <StatItem label="正确率" value={`${accuracy.toFixed(1)}%`} />
          <StatItem label="连对" value={streak} highlight="orange" />
          <StatItem label="最高连对" value={bestStreak} highlight="yellow" />
        </div>
        <button
          onClick={endSession}
          className="w-full mt-8 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          结束训练
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
