import { cn } from '@/lib/utils/cn'
import { ACTION_COLORS } from '@/config/constants'
import { useI18n } from '@/lib/i18n'

interface FrequencyBarProps {
  strategy: Record<string, number>
  userAction?: string
  className?: string
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  raise: 'action.raise',
  fold: 'action.fold',
  call: 'action.call',
  check: 'action.check',
  '3bet': 'action.threeBet',
  bet_50pct: 'action.bet50',
  bet_75pct: 'action.bet75',
  bet: 'action.raise',
  all_in: 'action.allIn',
}

const ACTION_LABEL_FALLBACK: Record<string, string> = {
  raise: '加注',
  fold: '弃牌',
  call: '跟注',
  check: '过牌',
  '3bet': '三次加注',
  bet_50pct: '下注50%',
  bet_75pct: '下注75%',
  bet: '下注',
  all_in: '全下',
}

export default function FrequencyBar({ strategy, userAction, className }: FrequencyBarProps) {
  const { t } = useI18n()
  const entries = Object.entries(strategy).filter(([, freq]) => freq > 0.01)
  const total = entries.reduce((sum, [, freq]) => sum + freq, 0)

  if (total === 0) {
    return (
      <div className={cn('h-6 w-full rounded bg-gray-800', className)}>
        <div className="flex h-full items-center justify-center text-xs text-gray-500">
          {t('trainer.noStrategyData')}
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
          const key = ACTION_LABEL_KEYS[action]
          const label = key ? t(key as Parameters<typeof t>[0]) : ACTION_LABEL_FALLBACK[action] || action

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
                {label}
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
