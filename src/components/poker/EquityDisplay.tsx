import { cn } from '@/lib/utils/cn'
import { useI18n } from '@/lib/i18n'

interface EquityDisplayProps {
  heroWins: number
  villainWins: number
  tie: number
  className?: string
}

export default function EquityDisplay({ heroWins, villainWins, tie, className }: EquityDisplayProps) {
  const { t } = useI18n()
  const total = heroWins + villainWins + tie
  const heroPct = total > 0 ? heroWins : 0
  const villainPct = total > 0 ? villainWins : 0
  const tiePct = total > 0 ? tie : 0

  return (
    <div className={cn('w-full', className)}>
      <div className="flex h-8 w-full overflow-hidden rounded-lg">
        <div
          className="flex items-center justify-center bg-green-600 transition-all duration-500"
          style={{ width: `${heroPct}%` }}
        >
          {heroPct > 8 && (
            <span className="text-xs font-bold text-white">
              {heroPct.toFixed(1)}%
            </span>
          )}
        </div>
        <div
          className="flex items-center justify-center bg-gray-500 transition-all duration-500"
          style={{ width: `${tiePct}%` }}
        >
          {tiePct > 8 && (
            <span className="text-xs font-bold text-white">
              {tiePct.toFixed(1)}%
            </span>
          )}
        </div>
        <div
          className="flex items-center justify-center bg-red-600 transition-all duration-500"
          style={{ width: `${villainPct}%` }}
        >
          {villainPct > 8 && (
            <span className="text-xs font-bold text-white">
              {villainPct.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-green-500" />
          <span className="text-sm text-gray-300">
            {t('equity.hero')} <span className="font-semibold text-green-400">{heroPct.toFixed(1)}%</span>
          </span>
        </div>
        {tiePct > 0.5 && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-gray-500" />
            <span className="text-sm text-gray-300">
              {t('equity.tie')} <span className="font-semibold text-gray-400">{tiePct.toFixed(1)}%</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-red-500" />
          <span className="text-sm text-gray-300">
            {t('equity.villain')} <span className="font-semibold text-red-400">{villainPct.toFixed(1)}%</span>
          </span>
        </div>
      </div>
    </div>
  )
}
