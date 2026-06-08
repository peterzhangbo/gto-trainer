import { useState, useCallback } from 'react'

interface SessionConfig {
  scenarioType: string
  position: string
  stackDepth?: number
}

interface Drill {
  id: string
  hand: string
  position: string
  boardCards?: string[]
  scenarioType: string
  strategy: Record<string, number>
}

interface DrillResult {
  id: string
  userAction: string
  bestAction: string
  gtoFrequencies: Record<string, number>
  score: number
  isCorrect: boolean
}

interface TrainingSession {
  sessionActive: boolean
  currentDrill: Drill | null
  drillState: 'idle' | 'awaiting' | 'revealed'
  lastResult: DrillResult | null
  streak: number
  bestStreak: number
  stats: { totalHands: number; correctHands: number; accuracy: number }
  startSession: (config: SessionConfig) => void
  submitAction: (action: string) => void
  nextDrill: () => void
  endSession: () => void
}

// Sample GTO data for BTN RFI
const BTN_RFI: Record<string, Record<string, number>> = {
  AA: { raise: 1.0 }, KK: { raise: 1.0 }, QQ: { raise: 1.0 },
  JJ: { raise: 1.0 }, TT: { raise: 1.0 }, '99': { raise: 1.0 },
  '88': { raise: 1.0 }, '77': { raise: 0.9, fold: 0.1 },
  '66': { raise: 0.8, fold: 0.2 }, '55': { raise: 0.7, fold: 0.3 },
  '44': { raise: 0.6, fold: 0.4 }, '33': { raise: 0.5, fold: 0.5 },
  '22': { raise: 0.5, fold: 0.5 },
  AKs: { raise: 1.0 }, AQs: { raise: 1.0 }, AJs: { raise: 1.0 },
  ATs: { raise: 1.0 }, A9s: { raise: 0.9, fold: 0.1 },
  A8s: { raise: 0.8, fold: 0.2 }, A7s: { raise: 0.7, fold: 0.3 },
  A6s: { raise: 0.6, fold: 0.4 }, A5s: { raise: 0.7, fold: 0.3 },
  A4s: { raise: 0.6, fold: 0.4 }, A3s: { raise: 0.5, fold: 0.5 },
  A2s: { raise: 0.5, fold: 0.5 },
  AKo: { raise: 1.0 }, AQo: { raise: 0.9, fold: 0.1 },
  AJo: { raise: 0.7, fold: 0.3 }, ATo: { raise: 0.5, fold: 0.5 },
  KQs: { raise: 1.0 }, KJs: { raise: 1.0 }, KTs: { raise: 0.9, fold: 0.1 },
  K9s: { raise: 0.7, fold: 0.3 }, KQo: { raise: 0.8, fold: 0.2 },
  KJo: { raise: 0.5, fold: 0.5 },
  QJs: { raise: 1.0 }, QTs: { raise: 0.8, fold: 0.2 },
  Q9s: { raise: 0.6, fold: 0.4 }, QJo: { raise: 0.4, fold: 0.6 },
  JTs: { raise: 1.0 }, J9s: { raise: 0.7, fold: 0.3 },
  T9s: { raise: 0.9, fold: 0.1 }, T8s: { raise: 0.6, fold: 0.4 },
  '98s': { raise: 0.7, fold: 0.3 }, '97s': { raise: 0.5, fold: 0.5 },
  '87s': { raise: 0.6, fold: 0.4 }, '86s': { raise: 0.4, fold: 0.6 },
  '76s': { raise: 0.5, fold: 0.5 }, '75s': { raise: 0.3, fold: 0.7 },
  '65s': { raise: 0.4, fold: 0.6 }, '54s': { raise: 0.3, fold: 0.7 },
}

function pickRandomHand(): { hand: string; strategy: Record<string, number> } {
  const entries = Object.entries(BTN_RFI)
  // Weight by raise/non-fold frequency - more likely to see hands that are raised more
  const weighted: [string, Record<string, number>][] = []
  for (const [hand, strat] of entries) {
    const nonFoldFreq = 1 - (strat.fold ?? 0)
    const weight = Math.max(1, Math.round(nonFoldFreq * 10))
    for (let i = 0; i < weight; i++) {
      weighted.push([hand, strat])
    }
  }
  const idx = Math.floor(Math.random() * weighted.length)
  return { hand: weighted[idx][0], strategy: weighted[idx][1] }
}

export function useTrainingSession(): TrainingSession {
  const [sessionActive, setSessionActive] = useState(false)
  const [currentDrill, setCurrentDrill] = useState<Drill | null>(null)
  const [drillState, setDrillState] = useState<'idle' | 'awaiting' | 'revealed'>('idle')
  const [lastResult, setLastResult] = useState<DrillResult | null>(null)
  const [results, setResults] = useState<DrillResult[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [config, setConfig] = useState<SessionConfig | null>(null)

  const generateDrill = useCallback((cfg: SessionConfig): Drill => {
    const { hand, strategy } = pickRandomHand()
    return {
      id: crypto.randomUUID(),
      hand,
      position: cfg.position,
      scenarioType: cfg.scenarioType,
      strategy,
    }
  }, [])

  const startSession = useCallback((cfg: SessionConfig) => {
    setConfig(cfg)
    setSessionActive(true)
    setResults([])
    setStreak(0)
    setBestStreak(0)
    const drill = generateDrill(cfg)
    setCurrentDrill(drill)
    setDrillState('awaiting')
    setLastResult(null)
  }, [generateDrill])

  const submitAction = useCallback((action: string) => {
    if (!currentDrill) return
    const gtoStrategy = currentDrill.strategy

    const actionFreq = gtoStrategy[action] ?? 0
    const bestAction = Object.entries(gtoStrategy).sort((a, b) => b[1] - a[1])[0]
    const isCorrect = action === bestAction[0]
    const score = actionFreq * 100

    const result: DrillResult = {
      id: crypto.randomUUID(),
      userAction: action,
      bestAction: bestAction[0],
      gtoFrequencies: gtoStrategy,
      score,
      isCorrect,
    }

    setLastResult(result)
    setResults((prev) => [...prev, result])
    setDrillState('revealed')

    if (isCorrect) {
      setStreak((s) => {
        const next = s + 1
        setBestStreak((b) => Math.max(b, next))
        return next
      })
    } else {
      setStreak(0)
    }
  }, [currentDrill])

  const nextDrill = useCallback(() => {
    if (!config) return
    const drill = generateDrill(config)
    setCurrentDrill(drill)
    setDrillState('awaiting')
    setLastResult(null)
  }, [config, generateDrill])

  const endSession = useCallback(() => {
    setSessionActive(false)
    setCurrentDrill(null)
    setDrillState('idle')
    setLastResult(null)
  }, [])

  const totalHands = results.length
  const correctHands = results.filter((r) => r.isCorrect).length
  const accuracy = totalHands > 0 ? (correctHands / totalHands) * 100 : 0

  return {
    sessionActive,
    currentDrill,
    drillState,
    lastResult,
    streak,
    bestStreak,
    stats: { totalHands, correctHands, accuracy },
    startSession,
    submitAction,
    nextDrill,
    endSession,
  }
}
