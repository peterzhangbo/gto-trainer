import type { SessionConfig } from '@/types'

export const POSITIONS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'] as const
export type Position = (typeof POSITIONS)[number]

export const SCENARIO_TYPES = [
  { id: 'rfi', label: 'Raise First In', category: 'Preflop' },
  { id: '3bet', label: '3-Bet', category: 'Preflop' },
  { id: 'call3bet', label: 'Call 3-Bet', category: 'Preflop' },
  { id: 'cbet', label: 'C-Bet', category: 'Postflop' },
  { id: 'vs_cbet', label: 'vs C-Bet', category: 'Postflop' },
] as const

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  scenarioType: 'rfi',
  position: 'BTN',
  stackDepth: 100,
  street: 'preflop',
  drillCount: 20,
  autoAdvance: true,
}

export const ACTION_COLORS: Record<string, string> = {
  raise: '#ef4444',
  fold: '#1f2937',
  call: '#3b82f6',
  check: '#6b7280',
  '3bet': '#f97316',
  bet_50pct: '#8b5cf6',
  bet_75pct: '#a855f7',
}

export const STACK_DEPTHS = [20, 40, 60, 80, 100, 150, 200] as const
