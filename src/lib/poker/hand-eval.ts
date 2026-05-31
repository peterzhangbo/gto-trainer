import type { Card } from '@/types/poker'
import { Hand } from 'pokersolver'
import type { SolvedHand } from 'pokersolver'

function cardToPokersolver(card: Card): string {
  return `${card.rank}${card.suit}`
}

export interface HandEvaluation {
  handName: string
  handRank: number
  description: string
}

const HAND_NAME_MAP: Record<string, string> = {
  'Straight Flush': 'Straight Flush', // pokersolver groups Royal Flush into this
  'Four of a Kind': 'Four of a Kind',
  'Full House': 'Full House',
  'Flush': 'Flush',
  'Straight': 'Straight',
  'Three of a Kind': 'Three of a Kind',
  'Two Pair': 'Two Pair',
  'Pair': 'One Pair',
  'High Card': 'High Card',
}

export function evaluateHand(cards: Card[]): HandEvaluation {
  const cardStrings = cards.map(cardToPokersolver)
  const hand: SolvedHand = Hand.solve(cardStrings)

  // Check if it's actually a royal flush (Ace-high straight flush)
  let handName = HAND_NAME_MAP[hand.name] ?? hand.name
  if (hand.name === 'Straight Flush') {
    const values = hand.cards.map((c) => c.value).sort()
    if (values.join('') === 'AJKQT') {
      handName = 'Royal Flush'
    }
  }

  return {
    handName,
    handRank: hand.rank,
    description: hand.descr,
  }
}

export function compareHands(
  hand1Cards: Card[],
  hand2Cards: Card[],
): 'hand1' | 'hand2' | 'tie' {
  const cardStrings1 = hand1Cards.map(cardToPokersolver)
  const cardStrings2 = hand2Cards.map(cardToPokersolver)

  const hand1: SolvedHand = Hand.solve(cardStrings1)
  const hand2: SolvedHand = Hand.solve(cardStrings2)

  const winners = Hand.winners([hand1, hand2])
  if (winners.length === 2) return 'tie'
  if (winners[0] === hand1) return 'hand1'
  return 'hand2'
}
