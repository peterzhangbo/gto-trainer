import type { Position, PreflopAction, PostflopAction } from './poker'

export type GTOStrategyEntry = Record<string, number>

export interface PreflopScenario {
  position: Position
  action: PreflopAction
  stackDepth: number
}

export interface PostflopScenario {
  street: 'flop' | 'turn' | 'river'
  boardTexture: string
  position: Position
  potSize: number
  stackDepth: number
  action: PostflopAction
}

export interface GTOLookupResult {
  strategy: GTOStrategyEntry
  bestAction: string
  ev: number
  source: string
  confidence: number
}

export interface ScenarioConfig {
  scenarioType: string
  position?: Position
  stackDepth?: number
  boardTexture?: string
}
