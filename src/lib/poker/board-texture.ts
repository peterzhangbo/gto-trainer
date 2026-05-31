import type { Card, Rank, Suit, BoardTexture } from '@/types/poker'
export type { BoardTexture }
import { RANKS, SUITS, RANK_VALUES } from './cards'

export function classifyBoardTexture(board: [Card, Card, Card]): BoardTexture {
  const suits = board.map((c) => c.suit)
  const ranks = board.map((c) => RANK_VALUES[c.rank]).sort((a, b) => a - b)

  const suitSet = new Set(suits)

  const paired = board[0].rank === board[1].rank ||
    board[0].rank === board[2].rank ||
    board[1].rank === board[2].rank

  const monotone = suitSet.size === 1
  const twoTone = suitSet.size === 2
  const highCard = board.some((c) => RANK_VALUES[c.rank] >= 10)

  const rankSpread = ranks[2] - ranks[0]
  const connected = rankSpread <= 4
  const semiConnected = !connected && rankSpread <= 6

  let label: BoardTexture['label']

  if (monotone) {
    label = 'monotone'
  } else if (paired && highCard) {
    label = 'paired-high'
  } else if (connected && twoTone) {
    label = 'connected-two-tone'
  } else if (semiConnected && twoTone) {
    label = 'wet'
  } else if (connected) {
    label = 'wet'
  } else {
    label = 'dry'
  }

  return { paired, monotone, connected, twoTone, highCard, label }
}

export function generateRandomBoard(texture: BoardTexture): Card[] {
  const allCards: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      allCards.push({ rank, suit })
    }
  }

  function shuffle(cards: Card[]): Card[] {
    const arr = [...cards]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  function matchesTexture(cards: Card[]): boolean {
    const t = classifyBoardTexture(cards as [Card, Card, Card])
    return (
      t.paired === texture.paired &&
      t.monotone === texture.monotone &&
      t.connected === texture.connected &&
      t.twoTone === texture.twoTone &&
      t.highCard === texture.highCard
    )
  }

  for (let attempt = 0; attempt < 1000; attempt++) {
    const shuffled = shuffle(allCards)
    const flop = shuffled.slice(0, 3) as [Card, Card, Card]

    if (matchesTexture(flop)) {
      return flop
    }
  }

  return generateFallbackFlop(texture)
}

function generateFallbackFlop(texture: BoardTexture): Card[] {
  if (texture.monotone) {
    const suit: Suit = SUITS[Math.floor(Math.random() * SUITS.length)]
    const availableRanks = shuffleArray([...RANKS])
    return [
      { rank: availableRanks[0], suit },
      { rank: availableRanks[1], suit },
      { rank: availableRanks[2], suit },
    ]
  }

  if (texture.paired && texture.highCard) {
    const rank: Rank = RANKS[Math.floor(Math.random() * 5)]
    const suits = shuffleArray([...SUITS])
    const otherRanks = RANKS.filter((r) => r !== rank)
    const otherRank = otherRanks[Math.floor(Math.random() * otherRanks.length)]
    return [
      { rank, suit: suits[0] },
      { rank, suit: suits[1] },
      { rank: otherRank, suit: suits[2] },
    ]
  }

  if (texture.connected && texture.twoTone) {
    const startIdx = Math.floor(Math.random() * 9)
    const ranks = [RANKS[startIdx], RANKS[startIdx + 1], RANKS[startIdx + 2]]
    const suits = shuffleArray([...SUITS])
    return [
      { rank: ranks[0], suit: suits[0] },
      { rank: ranks[1], suit: suits[0] },
      { rank: ranks[2], suit: suits[1] },
    ]
  }

  const suits = shuffleArray([...SUITS])
  const ranks = shuffleArray([...RANKS])
  return [
    { rank: ranks[0], suit: suits[0] },
    { rank: ranks[7], suit: suits[1] },
    { rank: ranks[11], suit: suits[2] },
  ]
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
