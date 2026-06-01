import { cn } from '@/lib/utils/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  color?: string
  label?: string
}

const sizeStyles = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
  xl: 'h-12 w-12 border-[3px]',
}

export default function Spinner({ size = 'md', className, color = 'border-red-500', label }: SpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3', className)} role="status" aria-label="Loading">
      <div className="relative">
        <div
          className={cn(
            'animate-spin rounded-full border-t-transparent',
            sizeStyles[size],
            color,
          )}
        />
        {/* Subtle glow ring behind spinner */}
        <div
          className={cn(
            'absolute inset-0 rounded-full opacity-20',
            color.replace('border-', 'bg-'),
            'blur-sm'
          )}
        />
      </div>
      {label && (
        <span className="text-sm text-gray-400 animate-pulse">{label}</span>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Skeleton loading primitives                                         */
/* ------------------------------------------------------------------ */

interface SkeletonProps {
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
}

export function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton bg-gray-800/50', roundedMap[rounded], className)}
      aria-hidden="true"
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 md:p-4">
      <Skeleton className="h-3 w-16 mb-2" rounded="sm" />
      <Skeleton className="h-7 w-24" rounded="sm" />
    </div>
  )
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" rounded="sm" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" rounded="lg" />
      ))}
    </div>
  )
}
