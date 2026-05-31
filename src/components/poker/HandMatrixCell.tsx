import { cn } from '@/lib/utils/cn'
import type { StrategyEntry } from '@/types'
import { ACTION_COLORS } from '@/config/constants'

interface HandMatrixCellProps {
  hand: string
  type: 'pair' | 'suited' | 'offsuit'
  entry: StrategyEntry | null
  isSelected?: boolean
  onClick?: () => void
  onHover?: (hovering: boolean) => void
}

function getPrimaryAction(entry: StrategyEntry | null): { action: string; freq: number } {
  if (!entry || !entry.actions || Object.keys(entry.actions).length === 0) {
    return { action: 'fold', freq: 0 }
  }
  const actions = Object.entries(entry.actions)
  const [action, freq] = actions.reduce((a, b) => (a[1] >= b[1] ? a : b))
  return { action, freq }
}

function getCellColor(action: string, freq: number): string {
  const baseColor = ACTION_COLORS[action] || ACTION_COLORS.fold
  const alpha = 0.3 + freq * 0.7
  const r = parseInt(baseColor.slice(1, 3), 16)
  const g = parseInt(baseColor.slice(3, 5), 16)
  const b = parseInt(baseColor.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function HandMatrixCell({
  hand,
  type,
  entry,
  isSelected = false,
  onClick,
  onHover,
}: HandMatrixCellProps) {
  const { action, freq } = getPrimaryAction(entry)
  const backgroundColor = entry ? getCellColor(action, freq) : 'rgba(31, 41, 55, 0.5)'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={cn(
        'flex flex-col items-center justify-center rounded border transition-all duration-150',
        'hover:scale-110 hover:z-10 hover:shadow-lg',
        isSelected
          ? 'border-white ring-2 ring-white/50'
          : 'border-gray-700/50 hover:border-gray-500',
        'aspect-square w-full cursor-pointer p-0.5'
      )}
      style={{ backgroundColor }}
    >
      <span
        className={cn(
          'text-[10px] font-bold leading-tight',
          type === 'pair' && 'text-white',
          type === 'suited' && 'text-gray-100',
          type === 'offsuit' && 'text-gray-300'
        )}
      >
        {hand}
      </span>
      {entry && (
        <span className="text-[8px] leading-none text-gray-200/70">
          {Math.round(freq * 100)}%
        </span>
      )}
    </button>
  )
}
