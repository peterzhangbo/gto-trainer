import { useMemo } from 'react'
import { RANKS_13, getPrimaryAction, expandRangeToMatrix } from '@/lib/poker/range'

interface StrategyEntry {
  actions: Record<string, number>
  ev: number
  frequency: number
}

const ACTION_COLORS: Record<string, string> = {
  raise: '#ef4444',
  '3bet': '#f97316',
  call: '#3b82f6',
  check: '#6b7280',
  fold: '#1f2937',
  bet_50pct: '#8b5cf6',
  bet_75pct: '#a855f7',
  bet: '#8b5cf6',
  all_in: '#dc2626',
}

function getCellColor(action: string, freq: number): string {
  const baseColor = ACTION_COLORS[action] || ACTION_COLORS.fold
  const alpha = 0.3 + freq * 0.7
  const r = parseInt(baseColor.slice(1, 3), 16)
  const g = parseInt(baseColor.slice(3, 5), 16)
  const b = parseInt(baseColor.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function useHandMatrix(strategy: Record<string, StrategyEntry>) {
  const cells = useMemo(() => {
    const flatStrategy: Record<string, Record<string, number>> = {}

    for (const [hand, entry] of Object.entries(strategy)) {
      if (entry && entry.actions) {
        flatStrategy[hand] = entry.actions
      }
    }

    const matrixCells = expandRangeToMatrix(flatStrategy)

    return matrixCells.map((cell) => {
      if (cell.entry) {
        const { action, frequency } = getPrimaryAction(cell.entry)
        return {
          ...cell,
          primaryAction: action,
          primaryFreq: frequency,
          color: getCellColor(action, frequency),
        }
      }
      return cell
    })
  }, [strategy])

  return cells
}

export function getHandAtPosition(row: number, col: number): {
  hand: string
  type: 'pair' | 'suited' | 'offsuit'
} {
  const rank1 = RANKS_13[row]
  const rank2 = RANKS_13[col]

  if (row === col) {
    return { hand: `${rank1}${rank2}`, type: 'pair' }
  }

  if (row < col) {
    return { hand: `${rank1}${rank2}s`, type: 'suited' }
  }

  return { hand: `${rank2}${rank1}o`, type: 'offsuit' }
}
