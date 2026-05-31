import { cn } from '@/lib/utils/cn'

interface FooterProps {
  className?: string
}

export default function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn(
        'border-t border-gray-800 bg-gray-900 py-6',
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-red-500">GTO</span>
            <span className="text-sm font-bold text-gray-400">Trainer</span>
          </div>
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} GTO Trainer. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
