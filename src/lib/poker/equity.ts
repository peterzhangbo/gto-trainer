import type { Card } from '@/types/poker'
import { createDeck, removeCards, dealCards, shuffleDeck, cardToString } from './cards'
import { Hand } from 'pokersolver'
import type { SolvedHand } from 'pokersolver'

export interface EquityResult {
  heroWins: number
  villainWins: number
  tie: number
  heroEquity: number
}

export function calculateEquity(
  heroCards: Card[],
  villainCards: Card[] | null,
  boardCards: Card[],
  numSimulations: number = 10000,
): EquityResult {
  let heroWins = 0
  let villainWins = 0
  let ties = 0

  const knownCards = [...heroCards, ...boardCards]

  for (let i = 0; i < numSimulations; i++) {
    let deck = shuffleDeck(createDeck())
    deck = removeCards(deck, knownCards)

    let currentVillain: Card[]
    if (villainCards) {
      currentVillain = villainCards
      deck = removeCards(deck, villainCards)
    } else {
      const dealt = dealCards(deck, 2)
      currentVillain = dealt.cards
      deck = dealt.remaining
    }

    const cardsNeeded = 5 - boardCards.length
    const { cards: extraBoardCards } = dealCards(deck, cardsNeeded)
    const fullBoard = [...boardCards, ...extraBoardCards]

    const heroStr = [...heroCards, ...fullBoard].map(cardToString)
    const villainStr = [...currentVillain, ...fullBoard].map(cardToString)

    const heroHand: SolvedHand = Hand.solve(heroStr)
    const villainHand: SolvedHand = Hand.solve(villainStr)

    const winners = Hand.winners([heroHand, villainHand])

    if (winners.length === 2) {
      ties++
    } else if (winners.length === 1 && winners[0] === heroHand) {
      heroWins++
    } else {
      villainWins++
    }
  }

  const total = heroWins + villainWins + ties

  return {
    heroWins: heroWins / total,
    villainWins: villainWins / total,
    tie: ties / total,
    heroEquity: (heroWins + ties / 2) / total,
  }
}

export function getRandomBoard(excludeCards: Card[], count: number): Card[] {
  const deck = shuffleDeck(createDeck())
  const filtered = removeCards(deck, excludeCards)
  const { cards } = dealCards(filtered, count)
  return cards
}
