import { useState, useCallback, useRef } from 'react'
import type { Card } from '@/types/poker'
import type { RangeMap, RangeEquityResult } from '@/lib/poker/range-equity'
import { calculateRangeEquity } from '@/lib/poker/range-equity'
import type { ScenarioData } from '@/data/index'

export function extractRangeFromScenario(data: ScenarioData): RangeMap {
  if ('hands' in data) {
    return data.hands as RangeMap
  }
  return {}
}

interface UseRangeEquityReturn {
  calculateRangeEquity: (hero: RangeMap, villain: RangeMap, board: Card[], numSimulations?: number) => void
  result: RangeEquityResult | null
  calculating: boolean
  progress: number
  reset: () => void
}

export function useRangeEquity(): UseRangeEquityReturn {
  const [result, setResult] = useState<RangeEquityResult | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [progress, setProgress] = useState(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const calculate = useCallback(
    (hero: RangeMap, villain: RangeMap, board: Card[], numSimulations: number = 1000) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      setCalculating(true)
      setResult(null)
      setProgress(0)

      timeoutRef.current = setTimeout(() => {
        try {
          const raw = calculateRangeEquity(hero, villain, board, numSimulations, setProgress)
          setResult(raw)
          setProgress(1)
        } catch {
          setResult(null)
        } finally {
          setCalculating(false)
          timeoutRef.current = null
        }
      }, 10)
    },
    [],
  )

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setResult(null)
    setCalculating(false)
    setProgress(0)
  }, [])

  return {
    calculateRangeEquity: calculate,
    result,
    calculating,
    progress,
    reset,
  }
}
