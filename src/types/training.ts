import type { Card } from './poker'

export interface Drill {
  id: string
  hand: Card[]
  position: string
  boardCards?: Card[]
  scenarioType: string
  scenarioParams: Record<string, unknown>
}

export interface DrillResult {
  id: string
  drill: Drill
  userAction: string
  gtoAction: string
  gtoFrequencies: Record<string, number>
  score: number
  isCorrect: boolean
  timestamp: number
}

export interface SessionConfig {
  scenarioType: string
  position?: string
  stackDepth?: number
  boardTexture?: string
}

export interface TrainingSession {
  id: string
  config: SessionConfig
  results: DrillResult[]
  stats: {
    totalDrills: number
    correctDrills: number
    averageScore: number
    accuracy: number
  }
}
