import { cn } from '@/lib/utils/cn'
import type { StrategyEntry } from '@/types'
import HandMatrixCell from './HandMatrixCell'
import { RANKS } from '@/lib/poker/cards'

const MATRIX_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const

interface HandMatrixProps {
  strategy: Record<string, StrategyEntry>
  selectedHand?: string | null
  onSelectHand?: (hand: string) => void
  onHoverHand?: (hand: string | null) => void
  className?: string
}

function getHandAtPosition(row: number, col: number): { hand: string; type: 'pair' | 'suited' | 'offsuit' } {
  const rowRank = MATRIX_RANKS[row]
  const colRank = MATRIX_RANKS[col]

  if (row === col) {
    return { hand: `${rowRank}${colRank}`, type: 'pair' }
  }

  if (row < col) {
    return { hand: `${rowRank}${colRank}s`, type: 'suited' }
  }

  return { hand: `${colRank}${rowRank}o`, type: 'offsuit' }
}

export default function HandMatrix({
  strategy,
  selectedHand,
  onSelectHand,
  onHoverHand,
  className,
}: HandMatrixProps) {
  return (
    <div className={cn('inline-block', className)}>
      <div className="flex">
        <div className="w-6" />
        {MATRIX_RANKS.map((rank) => (
          <div
            key={`col-${rank}`}
            className="flex w-8 items-center justify-center text-xs font-bold text-gray-400"
          >
            {rank}
          </div>
        ))}
      </div>

      {MATRIX_RANKS.map((rowRank, rowIndex) => (
        <div key={`row-${rowRank}`} className="flex">
          <div className="flex w-6 items-center justify-center text-xs font-bold text-gray-400">
            {rowRank}
          </div>
          {MATRIX_RANKS.map((_, colIndex) => {
            const { hand, type } = getHandAtPosition(rowIndex, colIndex)
            const entry = strategy[hand] || null

            return (
              <div key={`${rowIndex}-${colIndex}`} className="w-8">
                <HandMatrixCell
                  hand={hand}
                  type={type}
                  entry={entry}
                  isSelected={selectedHand === hand}
                  onClick={() => onSelectHand?.(hand)}
                  onHover={(hovering) => onHoverHand?.(hovering ? hand : null)}
                />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
