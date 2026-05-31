import { cn } from '@/lib/utils/cn'
import { ACTION_COLORS } from '@/config/constants'

interface FrequencyBarProps {
  strategy: Record<string, number>
  userAction?: string
  className?: string
}

const actionLabels: Record<string, string> = {
  raise: 'Raise',
  fold: 'Fold',
  call: 'Call',
  check: 'Check',
  '3bet': '3-Bet',
  bet_50pct: 'Bet 50%',
  bet_75pct: 'Bet 75%',
  bet: 'Bet',
  all_in: 'All In',
}

export default function FrequencyBar({ strategy, userAction, className }: FrequencyBarProps) {
  const entries = Object.entries(strategy).filter(([, freq]) => freq > 0.01)
  const total = entries.reduce((sum, [, freq]) => sum + freq, 0)

  if (total === 0) {
    return (
      <div className={cn('h-6 w-full rounded bg-gray-800', className)}>
        <div className="flex h-full items-center justify-center text-xs text-gray-500">
          No strategy data
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex h-6 w-full overflow-hidden rounded">
        {entries.map(([action, freq]) => {
          const width = (freq / total) * 100
          const color = ACTION_COLORS[action] || ACTION_COLORS.fold
          const isUserAction = action === userAction

          return (
            <div
              key={action}
              className={cn(
                'relative flex items-center justify-center transition-all',
                isUserAction && 'ring-2 ring-inset ring-white/60'
              )}
              style={{
                width: `${width}%`,
                backgroundColor: color,
              }}
            >
              {width > 8 && (
                <span className="truncate px-1 text-[10px] font-semibold text-white/90">
                  {Math.round(freq * 100)}%
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-3">
        {entries.map(([action, freq]) => {
          const color = ACTION_COLORS[action] || ACTION_COLORS.fold
          const isUserAction = action === userAction

          return (
            <div
              key={action}
              className={cn(
                'flex items-center gap-1.5 text-xs',
                isUserAction && 'font-bold text-white'
              )}
            >
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-300">
                {actionLabels[action] || action}
              </span>
              <span className="font-mono text-gray-400">
                {Math.round(freq * 100)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
