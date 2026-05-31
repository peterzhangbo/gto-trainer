import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps {
  children: ReactNode
  title?: string
  subtitle?: string
  action?: ReactNode
  className?: string
  padding?: boolean
}

export default function Card({ children, title, subtitle, action, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-800 bg-gray-900 shadow-lg',
        className
      )}
    >
      {(title || action) && (
        <div
          className={cn(
            'flex items-center justify-between border-b border-gray-800',
            padding && 'px-6 py-4'
          )}
        >
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={cn(padding && 'px-6 py-4')}>{children}</div>
    </div>
  )
}
