import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import Navbar from './Navbar'

interface PageShellProps {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  noPadding?: boolean
}

const maxWidthStyles = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-7xl',
  full: 'max-w-full',
}

export default function PageShell({
  children,
  className,
  maxWidth = '2xl',
  noPadding = false,
}: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Navbar />
      <main
        className={cn(
          'mx-auto w-full flex-1',
          maxWidthStyles[maxWidth],
          !noPadding && 'px-4 py-6 sm:px-6 lg:px-8',
          className
        )}
      >
        {children}
      </main>
    </div>
  )
}
