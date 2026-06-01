import { cn } from '@/lib/utils/cn'
import type { Card, Rank, Suit } from '@/types'
import { RANKS, SUIT_SYMBOLS, isRedSuit } from '@/lib/poker/cards'

interface CardSelectorProps {
  selectedCards: Card[]
  onSelect: (card: Card) => void
  excludeCards?: Card[]
  className?: string
  maxSelectable?: number
}

export default function CardSelector({
  selectedCards,
  onSelect,
  excludeCards = [],
  className,
  maxSelectable,
}: CardSelectorProps) {
  function isCardSelected(card: Card): boolean {
    return selectedCards.some(
      (sc) => sc.rank === card.rank && sc.suit === card.suit
    )
  }

  function isCardExcluded(card: Card): boolean {
    return excludeCards.some(
      (ec) => ec.rank === card.rank && ec.suit === card.suit
    )
  }

  const suits: Suit[] = ['s', 'd', 'c', 'h']
  const ranks: Rank[] = [...RANKS].reverse()

  return (
    <div className={cn('w-full', className)}>
      <div className="flex flex-col gap-0.5">
        {suits.map((suit) => (
          <div key={suit} className="flex gap-0.5">
            <div
              className={cn(
                'flex w-9 items-center justify-center text-sm font-bold',
                isRedSuit(suit) ? 'text-red-500' : 'text-gray-400'
              )}
            >
              {SUIT_SYMBOLS[suit]}
            </div>
            {ranks.map((rank) => {
              const card: Card = { rank, suit }
              const selected = isCardSelected(card)
              const excluded = isCardExcluded(card)
              const disabled = excluded || (maxSelectable != null && selectedCards.length >= maxSelectable && !selected)
              const isRed = isRedSuit(suit)

              return (
                <button
                  key={`${rank}${suit}`}
                  onClick={() => !excluded && onSelect(card)}
                  disabled={disabled}
                  className={cn(
                    'flex h-11 w-9 items-center justify-center rounded border text-xs font-bold transition-all min-h-[44px]',
                    selected
                      ? 'border-yellow-400 bg-yellow-900/50 text-yellow-300'
                      : excluded
                      ? 'border-gray-800 bg-gray-800/50 text-gray-700 cursor-not-allowed'
                      : disabled
                      ? 'border-gray-800 bg-gray-900 text-gray-700 cursor-not-allowed'
                      : cn(
                          'border-gray-700 bg-gray-800 hover:border-gray-500 hover:bg-gray-700',
                          isRed ? 'text-red-400' : 'text-gray-200'
                        )
                  )}
                >
                  {rank}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
