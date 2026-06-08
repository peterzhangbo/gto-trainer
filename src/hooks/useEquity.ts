import { useState, useCallback, useRef, useEffect } from 'react'
import type { Card } from '@/types/poker'
import { calculateEquity } from '@/lib/poker/equity'

interface EquityPercentageResult {
  heroWins: number
  villainWins: number
  tie: number
  heroEquity: number
}

interface UseEquityReturn {
  calculateEquity: (heroCards: Card[], villainCards: Card[] | null, boardCards: Card[], numSimulations?: number) => void
  result: EquityPercentageResult | null
  calculating: boolean
  reset: () => void
}

export function useEquity(): UseEquityReturn {
  const [result, setResult] = useState<EquityPercentageResult | null>(null)
  const [calculating, setCalculating] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const calculate = useCallback(
    (
      heroCards: Card[],
      villainCards: Card[] | null,
      boardCards: Card[],
      numSimulations: number = 10000
    ) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      setCalculating(true)
      setResult(null)

      timeoutRef.current = setTimeout(() => {
        try {
          const raw = calculateEquity(heroCards, villainCards, boardCards, numSimulations)
          setResult({
            heroWins: raw.heroWins * 100,
            villainWins: raw.villainWins * 100,
            tie: raw.tie * 100,
            heroEquity: raw.heroEquity * 100,
          })
        } catch {
          setResult(null)
        } finally {
          setCalculating(false)
          timeoutRef.current = null
        }
      }, 10)
    },
    []
  )

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setResult(null)
    setCalculating(false)
  }, [])

  return {
    calculateEquity: calculate,
    result,
    calculating,
    reset,
  }
}
