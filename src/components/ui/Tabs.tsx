import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
}

export default function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  const activeTabData = tabs.find((t) => t.id === activeTab)

  return (
    <div className={cn('w-full', className)}>
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors',
              tab.id === activeTab
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            )}
          >
            {tab.label}
            {tab.id === activeTab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
            )}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {activeTabData?.content}
      </div>
    </div>
  )
}
