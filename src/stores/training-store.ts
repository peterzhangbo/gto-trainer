import { create } from 'zustand'
import type { SessionConfig, Drill, DrillResult, StrategyEntry, Card } from '@/types'
import { generateDeck, shuffleDeck, handToNotation, RANKS } from '@/lib/poker/cards'
import { getRandomBoard } from '@/lib/poker/equity'
import { DEFAULT_SESSION_CONFIG } from '@/config/constants'

interface TrainingState {
  config: SessionConfig | null
  sessionActive: boolean
  currentDrill: Drill | null
  drillState: 'idle' | 'awaiting' | 'revealed'
  results: DrillResult[]
  streak: number
  bestStreak: number
  drillIndex: number
  startSession: (config: SessionConfig) => void
  generateDrill: () => void
  submitAction: (action: string) => void
  nextDrill: () => void
  endSession: () => void
}

function getRandomHand(deck: Card[]): { hand: Card[]; remaining: Card[] } {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return {
    hand: shuffled.slice(0, 2),
    remaining: shuffled.slice(2),
  }
}

function generateMockStrategy(handNotation: string): StrategyEntry {
  const first = handNotation[0]
  const second = handNotation[1]
  const r1 = RANKS.indexOf(first as (typeof RANKS)[number])
  const r2 = RANKS.indexOf(second as (typeof RANKS)[number])

  const strength = 1 - (Math.min(r1, r2) / 12)

  if (strength > 0.7) {
    return {
      actions: { raise: 0.8, call: 0.15, fold: 0.05 },
      ev: 1.5 + Math.random() * 2,
      frequency: 1.0,
    }
  } else if (strength > 0.4) {
    return {
      actions: { raise: 0.3, call: 0.5, fold: 0.2 },
      ev: 0.2 + Math.random(),
      frequency: 0.8,
    }
  } else if (strength > 0.2) {
    return {
      actions: { raise: 0.1, call: 0.2, fold: 0.7 },
      ev: -0.5 + Math.random() * 0.3,
      frequency: 0.5,
    }
  } else {
    return {
      actions: { fold: 0.9, raise: 0.05, call: 0.05 },
      ev: -2 + Math.random() * 0.5,
      frequency: 0.2,
    }
  }
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  config: null,
  sessionActive: false,
  currentDrill: null,
  drillState: 'idle',
  results: [],
  streak: 0,
  bestStreak: 0,
  drillIndex: 0,

  startSession: (config: SessionConfig) => {
    set({
      config,
      sessionActive: true,
      results: [],
      streak: 0,
      drillIndex: 0,
    })
    get().generateDrill()
  },

  generateDrill: () => {
    const config = get().config ?? DEFAULT_SESSION_CONFIG
    const deck = shuffleDeck(generateDeck())
    const { hand, remaining } = getRandomHand(deck)
    const notation = handToNotation(hand[0], hand[1])
    const gtoStrategy = generateMockStrategy(notation)

    let board: Card[] | undefined
    let pot = 1.5
    let stack = config.stackDepth

    if (config.street !== 'preflop') {
      const boardSize = config.street === 'flop' ? 3 : config.street === 'turn' ? 4 : 5
      board = getRandomBoard(hand, boardSize)
      pot = 5 + Math.random() * 10
      stack = config.stackDepth - pot / 2
    } else {
      if (config.scenarioType === 'rfi') {
        pot = 1.5
        stack = config.stackDepth - 2
      } else if (config.scenarioType === '3bet') {
        pot = 7
        stack = config.stackDepth - 7
      } else {
        pot = 6
        stack = config.stackDepth - 6
      }
    }

    const drillId = crypto.randomUUID()
    const actions = Object.keys(gtoStrategy.actions)
    const primaryAction = actions.reduce((a, b) =>
      gtoStrategy.actions[a] >= gtoStrategy.actions[b] ? a : b
    )

    const drill: Drill = {
      id: drillId,
      scenario: {
        id: config.scenarioType,
        type: config.scenarioType as Drill['scenario']['type'],
        position: config.position,
        villainPosition: config.villainPosition,
        street: config.street,
        stackDepth: config.stackDepth,
      },
      hand,
      board,
      pot,
      stack,
      gtoStrategy: {
        ...gtoStrategy,
        actions: gtoStrategy.actions,
      },
      position: config.position,
    }

    set({ currentDrill: drill, drillState: 'awaiting' })
  },

  submitAction: (action: string) => {
    const drill = get().currentDrill
    if (!drill || get().drillState !== 'awaiting') return

    const gtoBestAction = Object.entries(drill.gtoStrategy.actions).reduce((a, b) =>
      a[1] >= b[1] ? a : b
    )[0]

    const actionFreq = drill.gtoStrategy.actions[action] || 0
    const score = Math.round(actionFreq * 100)
    const isCorrect = action === gtoBestAction

    const result: DrillResult = {
      drillId: drill.id,
      userAction: action,
      gtoBestAction,
      score,
      timestamp: Date.now(),
    }

    const newStreak = isCorrect ? get().streak + 1 : 0

    set({
      drillState: 'revealed',
      results: [...get().results, result],
      streak: newStreak,
      bestStreak: Math.max(get().bestStreak, newStreak),
    })
  },

  nextDrill: () => {
    const config = get().config
    if (!config) return

    const drillIndex = get().drillIndex + 1
    if (drillIndex >= config.drillCount) {
      get().endSession()
      return
    }

    set({ drillIndex })
    get().generateDrill()
  },

  endSession: () => {
    set({
      sessionActive: false,
      currentDrill: null,
      drillState: 'idle',
      config: null,
    })
  },
}))
