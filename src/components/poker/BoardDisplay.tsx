import { cn } from '@/lib/utils/cn'
import CardDisplay from './CardDisplay'
import type { Card } from '@/types'

interface BoardDisplayProps {
  cards: Card[]
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const gapMap = {
  sm: '-ml-2',
  md: '-ml-3',
  lg: '-ml-4',
}

export default function BoardDisplay({ cards, size = 'md', className }: BoardDisplayProps) {
  if (!cards || cards.length === 0) return null

  return (
    <div className={cn('flex items-center justify-center', className)}>
      {cards.map((card, index) => (
        <div
          key={index}
          className={cn(
            index > 0 && gapMap[size],
            'relative'
          )}
          style={{ zIndex: index }}
        >
          <CardDisplay card={card} size={size} />
        </div>
      ))}
    </div>
  )
}
