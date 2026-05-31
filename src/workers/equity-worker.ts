// Web Worker for Monte Carlo equity calculation
// Runs in a separate thread to avoid blocking the UI

import { Hand } from 'pokersolver'

interface Card {
  rank: string
  suit: string
}

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const SUITS = ['s', 'h', 'd', 'c']

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

function cardToString(c: Card): string {
  return c.rank + c.suit
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isSameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit
}

function removeKnownCards(deck: Card[], ...known: (Card | null)[]): Card[] {
  const flat = known.filter(Boolean) as Card[]
  return deck.filter((c) => !flat.some((k) => isSameCard(c, k)))
}

interface EquityRequest {
  hero: Card[]
  villain: Card[] | null
  board: Card[]
  simulations: number
}

interface EquityResult {
  heroWins: number
  villainWins: number
  tie: number
  heroEquity: number
}

self.onmessage = (e: MessageEvent<EquityRequest>) => {
  const { hero, villain, board, simulations } = e.data
  let heroWins = 0
  let villainWins = 0
  let ties = 0

  for (let i = 0; i < simulations; i++) {
    let deck = removeKnownCards(createDeck(), hero[0], hero[1], villain?.[0], villain?.[1], ...board)
    deck = shuffleArray(deck)

    // Complete the board
    const fullBoard = [...board]
    while (fullBoard.length < 5 && deck.length > 0) {
      fullBoard.push(deck.pop()!)
    }

    // Deal villain if not specified
    let vCards = villain
    if (!vCards && deck.length >= 2) {
      vCards = [deck.pop()!, deck.pop()!]
    }

    if (!vCards) continue

    const heroStr = [...hero, ...fullBoard].map(cardToString)
    const villainStr = [...vCards, ...fullBoard].map(cardToString)

    const heroHand = Hand.solve(heroStr)
    const villainHand = Hand.solve(villainStr)
    const result = Hand.winners([heroHand, villainHand])

    if (result.length === 2) {
      ties++
    } else if (result[0] === heroHand) {
      heroWins++
    } else {
      villainWins++
    }

    // Report progress every 1000 simulations
    if (i > 0 && i % 1000 === 0) {
      self.postMessage({
        type: 'progress',
        progress: i / simulations,
      })
    }
  }

  const eq: EquityResult = {
    heroWins: (heroWins / simulations) * 100,
    villainWins: (villainWins / simulations) * 100,
    tie: (ties / simulations) * 100,
    heroEquity: ((heroWins + ties / 2) / simulations) * 100,
  }

  self.postMessage({ type: 'result', result: eq })
}
