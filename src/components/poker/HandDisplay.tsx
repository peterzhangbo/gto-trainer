import { cn } from '@/lib/utils/cn'
import CardDisplay from './CardDisplay'
import type { Card } from '@/types'
import { SUIT_SYMBOLS } from '@/lib/poker/cards'

interface HandDisplayProps {
  hand: { card1: Card; card2: Card } | Card[] | string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  compact?: boolean
}

function notationToCards(notation: string): { rank: string; display: string }[] {
  const rank1 = notation[0]
  const rank2 = notation[1]

  if (rank1 === rank2) {
    return [
      { rank: rank1, display: `${rank1}${SUIT_SYMBOLS.s}` },
      { rank: rank2, display: `${rank2}${SUIT_SYMBOLS.h}` },
    ]
  }

  const isSuited = notation.endsWith('s')
  if (isSuited) {
    return [
      { rank: rank1, display: `${rank1}${SUIT_SYMBOLS.s}` },
      { rank: rank2, display: `${rank2}${SUIT_SYMBOLS.s}` },
    ]
  }

  return [
    { rank: rank1, display: `${rank1}${SUIT_SYMBOLS.s}` },
    { rank: rank2, display: `${rank2}${SUIT_SYMBOLS.d}` },
  ]
}

export default function HandDisplay({ hand, size = 'md', className, compact = false }: HandDisplayProps) {
  if (typeof hand === 'string') {
    if (compact) {
      return (
        <span className={cn('inline-flex items-center gap-0.5', className)}>
          <span className="font-semibold text-gray-100">{hand}</span>
        </span>
      )
    }
    const cards = notationToCards(hand)
    return (
      <div className={cn('inline-flex items-center gap-1', className)}>
        {cards.map((c, i) => (
          <span
            key={i}
            className={cn(
              'rounded-md bg-gray-800 px-2 py-1 font-mono text-sm font-bold',
              c.display.includes(SUIT_SYMBOLS.h) || c.display.includes(SUIT_SYMBOLS.d)
                ? 'text-red-500'
                : 'text-gray-100'
            )}
          >
            {c.display}
          </span>
        ))}
      </div>
    )
  }

  const cards: Card[] = Array.isArray(hand) ? hand : [hand.card1, hand.card2]

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {cards.map((card, i) => (
        <CardDisplay key={i} card={card} size={size} />
      ))}
    </div>
  )
}
