declare module 'pokersolver' {
  interface SolvedHand {
    name: string
    rank: number
    descr: string
    cards: Array<{ value: string; suit: string; rank: number; wildValue: string }>
    cardPool: Array<{ value: string; suit: string; rank: number; wildValue: string }>
    values: Record<number, Array<{ value: string; suit: string; rank: number; wildValue: string }>>
    suits: Record<string, Array<{ value: string; suit: string; rank: number; wildValue: string }>>
    game: { descr: string }
    isPossible: boolean
    compare: (other: SolvedHand) => number
    qualifiesHigh: () => boolean
    loseTo: (other: SolvedHand) => boolean
    toString: () => string
  }

  interface HandStatic {
    solve(cards: string[], game?: string): SolvedHand
    winners(hands: SolvedHand[]): SolvedHand[]
  }

  export const Hand: HandStatic
}
