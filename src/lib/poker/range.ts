import type { HandNotation } from '@/types/poker'

export const RANKS_13: string[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

export interface MatrixCell {
  row: number
  col: number
  hand: HandNotation
  type: 'pair' | 'suited' | 'offsuit'
  entry: Record<string, number> | null
  primaryAction: string
  primaryFreq: number
  color: string
}

export function getHandNotation(row: number, col: number): {
  hand: HandNotation
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

export function expandRangeToMatrix(
  strategy: Record<string, Record<string, number>>,
): MatrixCell[] {
  const cells: MatrixCell[] = []

  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const { hand, type } = getHandNotation(row, col)
      const entry = strategy[hand] ?? null

      let primaryAction = ''
      let primaryFreq = 0

      if (entry) {
        const result = getPrimaryAction(entry)
        primaryAction = result.action
        primaryFreq = result.frequency
      }

      cells.push({
        row,
        col,
        hand,
        type,
        entry,
        primaryAction,
        primaryFreq,
        color: getActionColor(primaryAction),
      })
    }
  }

  return cells
}

export function getPrimaryAction(
  entry: Record<string, number>,
): { action: string; frequency: number } {
  let bestAction = ''
  let bestFreq = 0

  for (const [action, freq] of Object.entries(entry)) {
    if (freq > bestFreq) {
      bestFreq = freq
      bestAction = action
    }
  }

  return { action: bestAction, frequency: bestFreq }
}

function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    raise: '#ef4444',
    '3bet': '#ef4444',
    '4bet': '#dc2626',
    bet: '#f97316',
    call: '#22c55e',
    check: '#3b82f6',
    fold: '#6b7280',
    'all-in': '#a855f7',
  }
  return colors[action] ?? '#6b7280'
}
