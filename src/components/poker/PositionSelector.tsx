import { cn } from '@/lib/utils/cn'
import { POSITIONS } from '@/config/constants'

interface PositionSelectorProps {
  selected: string
  onSelect: (position: string) => void
  disabled?: string[]
  className?: string
}

const positionCoords: Record<string, { x: number; y: number }> = {
  UTG: { x: 50, y: 15 },
  MP: { x: 85, y: 30 },
  CO: { x: 95, y: 60 },
  BTN: { x: 70, y: 85 },
  SB: { x: 30, y: 85 },
  BB: { x: 5, y: 60 },
}

export default function PositionSelector({ selected, onSelect, disabled = [], className }: PositionSelectorProps) {
  return (
    <div className={cn('relative mx-auto w-full max-w-xs', className)}>
      <div className="relative aspect-[4/3] w-full">
        <div className="absolute inset-[8%] rounded-[50%] border-2 border-gray-700 bg-gray-900/50">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-gray-600">
            TABLE
          </div>
        </div>

        {POSITIONS.map((pos) => {
          const coords = positionCoords[pos]
          const isSelected = pos === selected
          const isDisabled = disabled.includes(pos)

          return (
            <button
              key={pos}
              onClick={() => !isDisabled && onSelect(pos)}
              disabled={isDisabled}
              className={cn(
                'absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center',
                'rounded-full border-2 text-xs font-bold transition-all',
                isSelected
                  ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-500/30'
                  : isDisabled
                  ? 'border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400 hover:bg-gray-700'
              )}
              style={{
                left: `${coords.x}%`,
                top: `${coords.y}%`,
              }}
            >
              {pos}
            </button>
          )
        })}
      </div>
    </div>
  )
}
