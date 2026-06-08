import type { Card, Rank, Suit } from '@/types'

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const SUITS: Suit[] = ['s', 'h', 'd', 'c']

const RANK_VALUES: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
}

export { RANKS, SUITS, RANK_VALUES, SUIT_SYMBOLS }

export function parseCard(str: string): Card | null {
  if (!str || str.length < 2) return null
  const rank = str[0].toUpperCase() as Rank
  const suit = str[1].toLowerCase() as Suit
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) return null
  return { rank, suit }
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'h' || suit === 'd'
}

export function generateDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function dealCards(deck: Card[], count: number): { cards: Card[]; remaining: Card[] } {
  return {
    cards: deck.slice(0, count),
    remaining: deck.slice(count),
  }
}

export function handToNotation(card1: Card, card2: Card): string {
  const rankOrder = RANKS
  const idx1 = rankOrder.indexOf(card1.rank)
  const idx2 = rankOrder.indexOf(card2.rank)

  const higher = idx1 <= idx2 ? card1 : card2
  const lower = idx1 <= idx2 ? card2 : card1

  if (higher.rank === lower.rank) {
    return `${higher.rank}${lower.rank}`
  }

  if (higher.suit === lower.suit) {
    return `${higher.rank}${lower.rank}s`
  }

  return `${higher.rank}${lower.rank}o`
}

export function notationToHandPair(notation: string): { rank1: Rank; rank2: Rank; type: 'pair' | 'suited' | 'offsuit' } {
  const rank1 = notation[0] as Rank
  const rank2 = notation[1] as Rank

  if (rank1 === rank2) {
    return { rank1, rank2, type: 'pair' }
  }

  if (notation.endsWith('s')) {
    return { rank1, rank2, type: 'suited' }
  }

  return { rank1, rank2, type: 'offsuit' }
}

export function createDeck(): Card[] {
  return generateDeck()
}

export function removeCards(deck: Card[], cardsToRemove: Card[]): Card[] {
  return deck.filter(
    (card) =>
      !cardsToRemove.some(
        (remove) => remove.rank === card.rank && remove.suit === card.suit,
      ),
  )
}
