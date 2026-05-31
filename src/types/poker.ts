export type Suit = 's' | 'h' | 'd' | 'c'
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2'

export interface Card {
  rank: Rank
  suit: Suit
}

export interface Hand {
  card1: Card
  card2: Card
}

export type HandNotation = string // e.g. "AKs", "TT", "QJo"

export type Position =
  | 'UTG'
  | 'UTG1'
  | 'MP'
  | 'MP1'
  | 'CO'
  | 'BTN'
  | 'SB'
  | 'BB'

export type PreflopAction =
  | 'fold'
  | 'call'
  | 'raise'
  | '3bet'
  | '4bet'
  | 'all-in'

export type PostflopAction =
  | 'check'
  | 'bet'
  | 'call'
  | 'raise'
  | 'fold'
  | 'all-in'

export interface BoardTexture {
  paired: boolean
  monotone: boolean
  connected: boolean
  twoTone: boolean
  highCard: boolean
  label:
    | 'monotone'
    | 'paired-high'
    | 'connected-two-tone'
    | 'dry'
    | 'wet'
    | 'semi-connected'
}

export type HandCategory =
  | 'overpair'
  | 'topPair'
  | 'middlePair'
  | 'overcards'
  | 'gutshot'
  | 'flushDraw'
  | 'straightDraw'
  | 'air'

export interface StrategyEntry {
  [action: string]: number
}

export interface Scenario {
  id: string
  type: 'rfi' | '3bet' | 'call3bet' | 'cbet' | 'vs_cbet'
  position: string
  villainPosition?: string
  street: 'preflop' | 'flop' | 'turn' | 'river'
  stackDepth: number
}

export interface Drill {
  id: string
  scenario: Scenario
  hand: Card[]
  board?: Card[]
  pot: number
  stack: number
  gtoStrategy: StrategyEntry
  position: string
}

export interface DrillResult {
  drillId: string
  userAction: string
  gtoBestAction: string
  score: number
  timestamp: number
}

export interface SessionConfig {
  scenarioType: string
  position: string
  villainPosition?: string
  stackDepth: number
  street: 'preflop' | 'flop' | 'turn' | 'river'
  drillCount: number
  autoAdvance: boolean
}

export interface UserStats {
  totalDrills: number
  totalSessions: number
  averageScore: number
  bestStreak: number
  accuracyByAction: Record<string, { correct: number; total: number }>
  recentSessions: SessionSummary[]
}

export interface SessionSummary {
  id: string
  date: string
  scenarioType: string
  drillCount: number
  averageScore: number
}

export interface MatrixCell {
  row: number
  col: number
  hand: string
  type: 'pair' | 'suited' | 'offsuit'
  entry: StrategyEntry | null
  primaryAction: string
  primaryFreq: number
  color: string
}
