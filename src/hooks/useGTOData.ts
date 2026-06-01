import { useState, useEffect, useCallback } from 'react'
import type { StrategyEntry } from '@/types/poker'
import { RANKS } from '@/lib/poker/cards'

interface GTOData {
  strategy: Record<string, StrategyEntry>
  metadata: {
    scenarioType: string
    position: string
    street: string
  }
}

function generateMockStrategy(scenarioType: string): Record<string, StrategyEntry> {
  const strategy: Record<string, StrategyEntry> = {}
  const ranks = [...RANKS]

  for (let i = 0; i < ranks.length; i++) {
    for (let j = 0; j < ranks.length; j++) {
      let hand: string
      if (i === j) {
        hand = `${ranks[i]}${ranks[j]}`
      } else if (i < j) {
        hand = `${ranks[i]}${ranks[j]}s`
      } else {
        hand = `${ranks[j]}${ranks[i]}o`
      }

      const higherIdx = Math.min(i, j)
      const strength = 1 - higherIdx / 12
      const isPair = i === j
      const isSuited = i < j

      let raiseFreq = 0
      let callFreq = 0

      if (scenarioType === 'rfi') {
        if (strength > 0.7 || (isPair && strength > 0.5)) {
          raiseFreq = 0.8 + Math.random() * 0.2
        } else if (strength > 0.45 || (isPair && strength > 0.25)) {
          raiseFreq = 0.3 + Math.random() * 0.4
        } else if (strength > 0.25 && isSuited) {
          raiseFreq = 0.1 + Math.random() * 0.15
        } else {
          raiseFreq = Math.random() * 0.05
        }
      } else if (scenarioType === '3bet') {
        if (strength > 0.8 || (isPair && i <= 4)) {
          raiseFreq = 0.7 + Math.random() * 0.3
          callFreq = 0.0
        } else if (strength > 0.6) {
          raiseFreq = 0.2 + Math.random() * 0.2
          callFreq = 0.3 + Math.random() * 0.2
        } else if (isPair || isSuited) {
          callFreq = 0.3 + Math.random() * 0.3
        }
      } else {
        if (strength > 0.6) {
          raiseFreq = 0.5 + Math.random() * 0.3
          callFreq = 0.2 + Math.random() * 0.2
        } else if (strength > 0.35) {
          callFreq = 0.4 + Math.random() * 0.3
        }
      }

      const foldFreq = Math.max(0, 1 - raiseFreq - callFreq)

      const total = raiseFreq + callFreq + foldFreq
      if (total > 0) {
        strategy[hand] = {
          raise: raiseFreq / total,
          call: callFreq / total,
          fold: foldFreq / total,
        }
      }
    }
  }

  return strategy
}

export function useGTOData(scenarioType: string, params: Record<string, string>) {
  const [data, setData] = useState<GTOData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const position = params.position || 'UTG'
  const key = `${scenarioType}-${position}-${params.stackDepth || '100'}`

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

    const timeout = setTimeout(() => {
      if (cancelled) return
      try {
        const strategy = generateMockStrategy(scenarioType)
        setData({
          strategy,
          metadata: {
            scenarioType,
            position,
            street: params.street || 'preflop',
          },
        })
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load GTO data')
          setLoading(false)
        }
      }
    }, 100)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [key, scenarioType, position, params.street, params.stackDepth])

  const getHandStrategy = useCallback(
    (hand: string): StrategyEntry | null => {
      if (!data) return null
      return data.strategy[hand] || null
    },
    [data]
  )

  const getBestAction = useCallback(
    (hand: string): string | null => {
      const entry = getHandStrategy(hand)
      if (!entry || !entry.actions) return null
      const actions = Object.entries(entry.actions)
      if (actions.length === 0) return null
      return actions.reduce((a, b) => (a[1] >= b[1] ? a : b))[0]
    },
    [getHandStrategy]
  )

  return { data, loading, error, getHandStrategy, getBestAction }
}
