import { cn } from '@/lib/utils/cn'
import { type Card, isRedSuit, SUIT_SYMBOLS, parseCard, type Rank, type Suit } from '@/lib/poker/cards'

interface CardDisplayProps {
  card: Card | string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  faceDown?: boolean
}

const rankDisplay: Record<string, string> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  T: '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
}

const sizeStyles = {
  sm: 'w-10 h-14 text-xs',
  md: 'w-14 h-20 text-sm',
  lg: 'w-20 h-28 text-base',
}

const suitSizeStyles = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
}

export default function CardDisplay({ card, size = 'md', className, faceDown = false }: CardDisplayProps) {
  const cardObj: Card = typeof card === 'string' ? parseCard(card) : card

  if (faceDown) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border-2 border-blue-800 bg-blue-900 shadow-md',
          sizeStyles[size],
          className
        )}
      >
        <div className="h-3/4 w-3/4 rounded border border-blue-600 bg-blue-800" />
      </div>
    )
  }

  const isRed = isRedSuit(cardObj.suit as Suit)
  const suitSymbol = SUIT_SYMBOLS[cardObj.suit as Suit]
  const rankText = rankDisplay[cardObj.rank] || cardObj.rank

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-between rounded-lg border border-gray-300 bg-white p-1 shadow-md',
        sizeStyles[size],
        className
      )}
    >
      <span
        className={cn(
          'font-bold leading-none',
          isRed ? 'text-red-600' : 'text-gray-900'
        )}
      >
        {rankText}
      </span>
      <span
        className={cn(
          'leading-none',
          isRed ? 'text-red-600' : 'text-gray-900',
          suitSizeStyles[size]
        )}
      >
        {suitSymbol}
      </span>
      <span
        className={cn(
          'font-bold leading-none rotate-180',
          isRed ? 'text-red-600' : 'text-gray-900'
        )}
      >
        {rankText}
      </span>
    </div>
  )
}
