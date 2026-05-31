import { cn } from '@/lib/utils/cn'

interface ProgressProps {
  value: number
  color?: string
  showLabel?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

export default function Progress({
  value,
  color = 'bg-red-500',
  showLabel = false,
  className,
  size = 'md',
}: ProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value))

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-gray-400">Progress</span>
          <span className="font-medium text-gray-200">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-gray-800',
          sizeStyles[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            color
          )}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
