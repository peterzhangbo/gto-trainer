import { cn } from '@/lib/utils/cn'
import type { StrategyEntry } from '@/types'
import Badge from '@/components/ui/Badge'
import { useI18n } from '@/lib/i18n'

interface ActionButtonsProps {
  actions: string[]
  onSelect: (action: string) => void
  disabled?: boolean
  revealed?: boolean
  gtoStrategy?: StrategyEntry | null
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  fold: 'action.fold',
  call: 'action.call',
  raise: 'action.raise',
  check: 'action.check',
  '3bet': 'action.threeBet',
  bet_50pct: 'action.bet50',
  bet_75pct: 'action.bet75',
  all_in: 'action.allIn',
}

const ACTION_LABEL_FALLBACK: Record<string, string> = {
  fold: '弃牌',
  call: '跟注',
  raise: '加注',
  check: '过牌',
  '3bet': '三次加注',
  bet_50pct: '下注50%',
  bet_75pct: '下注75%',
  all_in: '全下',
}

function getActionBg(action: string): string {
  switch (action) {
    case 'fold':
      return 'bg-red-700 hover:bg-red-600 border-red-600'
    case 'call':
      return 'bg-blue-700 hover:bg-blue-600 border-blue-600'
    case 'raise':
    case '3bet':
      return 'bg-green-700 hover:bg-green-600 border-green-600'
    case 'check':
      return 'bg-gray-600 hover:bg-gray-500 border-gray-500'
    case 'bet_50pct':
    case 'bet_75pct':
    case 'bet':
      return 'bg-purple-700 hover:bg-purple-600 border-purple-600'
    default:
      return 'bg-gray-700 hover:bg-gray-600 border-gray-600'
  }
}

function getBestAction(strategy: StrategyEntry | null | undefined): string | null {
  if (!strategy) return null
  const entries = Object.entries(strategy)
  if (entries.length === 0) return null
  return entries.reduce((a, b) => (a[1] >= b[1] ? a : b))[0]
}

export default function ActionButtons({
  actions,
  onSelect,
  disabled = false,
  revealed = false,
  gtoStrategy = null,
}: ActionButtonsProps) {
  const bestAction = revealed ? getBestAction(gtoStrategy) : null
  const { t } = useI18n()

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const isBest = action === bestAction
        const frequency = gtoStrategy?.[action]
        const key = ACTION_LABEL_KEYS[action]
        const label = key ? t(key as Parameters<typeof t>[0]) : ACTION_LABEL_FALLBACK[action] || action

        return (
          <button
            key={action}
            onClick={() => onSelect(action)}
            disabled={disabled}
            className={cn(
              'relative rounded-lg border px-5 py-3 text-sm font-bold text-white transition-all',
              getActionBg(action),
              disabled && 'opacity-50 cursor-not-allowed',
              isBest && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-900'
            )}
          >
            <span>{label}</span>
            {revealed && frequency != null && (
              <span className="ml-2 text-xs text-gray-200/70">
                {Math.round(frequency * 100)}%
              </span>
            )}
          </button>
        )
      })}

      {revealed && bestAction && (() => {
        const bestKey = ACTION_LABEL_KEYS[bestAction]
        const bestLabel = bestKey ? t(bestKey as Parameters<typeof t>[0]) : ACTION_LABEL_FALLBACK[bestAction] || bestAction
        return (
          <div className="flex w-full items-center gap-2 pt-2">
            <Badge variant="success">Best: {bestLabel}</Badge>
          </div>
        )
      })()}
    </div>
  )
}
