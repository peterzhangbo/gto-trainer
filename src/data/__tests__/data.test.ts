// @vitest-environment node
import { describe, it, expect } from 'vitest'
import metadata from '../metadata.json'

// All preflop data files (imported statically via @/data/index.ts in app, but here we test the JSON directly)
import utgData from '../preflop/rfi/utg.json'
import mpData from '../preflop/rfi/mp.json'
import coData from '../preflop/rfi/co.json'
import btnData from '../preflop/rfi/btn.json'
import sbData from '../preflop/rfi/sb.json'
import btnVsCoData from '../preflop/threebet/btn_vs_co.json'
import sbVsBtnData from '../preflop/threebet/sb_vs_btn.json'
import bbVsCoThreebetData from '../preflop/threebet/bb_vs_co.json'
import sbVsCoThreebetData from '../preflop/threebet/sb_vs_co.json'
import bbVsBtnData from '../preflop/defend/bb_vs_btn.json'
import bbVsCoDefendData from '../preflop/defend/bb_vs_co.json'
import bbVsUtgDefendData from '../preflop/defend/bb_vs_utg.json'

import dryHighData from '../postflop/c-bet/dry-high.json'
import wetConnectedData from '../postflop/c-bet/wet-connected.json'
import pairedData from '../postflop/c-bet/paired.json'
import monochromeData from '../postflop/c-bet/monochrome.json'
import brickTurnData from '../postflop/turn/brick-turn.json'
import flushCompletingTurnData from '../postflop/turn/flush-completing.json'
import straightCompletingTurnData from '../postflop/turn/straight-completing.json'
import overcardTurnData from '../postflop/turn/overcard-turn.json'
import blankRiverData from '../postflop/river/blank-river.json'
import scaryRiverData from '../postflop/river/scary-river.json'
import pairedRiverData from '../postflop/river/paired-river.json'
import pairedTurnData from '../postflop/turn/paired-turn.json'
import secondBarrelData from '../postflop/turn/second-barrel.json'
import valueBetRiverData from '../postflop/river/value-bet.json'
import bluffCatchRiverData from '../postflop/river/bluff-catch.json'

// ---------------------------------------------------------------------------
// Preflop data files
// ---------------------------------------------------------------------------

const PREFLOP_FILES: Array<{ name: string; data: Record<string, unknown> }> = [
  { name: 'rfi/utg', data: utgData },
  { name: 'rfi/mp', data: mpData },
  { name: 'rfi/co', data: coData },
  { name: 'rfi/btn', data: btnData },
  { name: 'rfi/sb', data: sbData },
  { name: 'threebet/btn_vs_co', data: btnVsCoData },
  { name: 'threebet/sb_vs_btn', data: sbVsBtnData },
  { name: 'threebet/bb_vs_co', data: bbVsCoThreebetData },
  { name: 'threebet/sb_vs_co', data: sbVsCoThreebetData },
  { name: 'defend/bb_vs_btn', data: bbVsBtnData },
  { name: 'defend/bb_vs_co', data: bbVsCoDefendData },
  { name: 'defend/bb_vs_utg', data: bbVsUtgDefendData },
]

// ---------------------------------------------------------------------------
// Postflop data files
// ---------------------------------------------------------------------------

const POSTFLOP_FILES: Array<{ name: string; data: Record<string, unknown> }> = [
  { name: 'c-bet/dry-high', data: dryHighData },
  { name: 'c-bet/wet-connected', data: wetConnectedData },
  { name: 'c-bet/paired', data: pairedData },
  { name: 'c-bet/monochrome', data: monochromeData },
  { name: 'turn/brick-turn', data: brickTurnData },
  { name: 'turn/flush-completing', data: flushCompletingTurnData },
  { name: 'turn/straight-completing', data: straightCompletingTurnData },
  { name: 'turn/overcard-turn', data: overcardTurnData },
  { name: 'turn/paired-turn', data: pairedTurnData },
  { name: 'turn/second-barrel', data: secondBarrelData },
  { name: 'river/blank-river', data: blankRiverData },
  { name: 'river/scary-river', data: scaryRiverData },
  { name: 'river/paired-river', data: pairedRiverData },
  { name: 'river/value-bet', data: valueBetRiverData },
  { name: 'river/bluff-catch', data: bluffCatchRiverData },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Preflop data integrity', () => {
  it.each(PREFLOP_FILES)(
    '$name should have exactly 169 hands',
    ({ data }) => {
      const hands = (data as { hands: Record<string, unknown> }).hands
      expect(Object.keys(hands)).toHaveLength(169)
    },
  )

  it.each(PREFLOP_FILES)(
    '$name should have all hand frequencies sum to 1.0',
    ({ data }) => {
      const hands = (data as {
        hands: Record<string, Record<string, number>>
      }).hands
      for (const freqs of Object.values(hands)) {
        const total = Object.values(freqs).reduce((a, b) => a + b, 0)
        expect(total).toBeCloseTo(1.0, 4)
      }
    },
  )
})

describe('Postflop data integrity', () => {
  it.each(POSTFLOP_FILES)(
    '$name should have strategy object with hand categories',
    ({ data }) => {
      const strategy = (data as {
        strategy: Record<string, unknown>
      }).strategy
      expect(strategy).toBeDefined()
      expect(Object.keys(strategy).length).toBeGreaterThan(0)
    },
  )

  it.each(POSTFLOP_FILES)(
    '$name should have all strategy frequencies sum to 1.0',
    ({ data }) => {
      const strategy = (data as {
        strategy: Record<string, Record<string, number>>
      }).strategy
      for (const freqs of Object.values(strategy)) {
        const total = Object.values(freqs).reduce((a, b) => a + b, 0)
        expect(total).toBeCloseTo(1.0, 4)
      }
    },
  )
})

describe('metadata.json', () => {
  const scenarios = (metadata as { scenarios: Array<{ id: string; filePath: string }> }).scenarios

  it('should have entries for all preflop data files', () => {
    const preflopPaths = PREFLOP_FILES.map(
      (f) => `preflop/${f.name}.json`,
    )
    for (const filePath of preflopPaths) {
      const found = scenarios.find((s) => s.filePath === filePath)
      expect(found).toBeDefined()
    }
  })

  it('should have entries for all postflop data files', () => {
    const postflopPaths = POSTFLOP_FILES.map(
      (f) => `postflop/${f.name}.json`,
    )
    for (const filePath of postflopPaths) {
      const found = scenarios.find((s) => s.filePath === filePath)
      expect(found).toBeDefined()
    }
  })

  it('should have unique IDs for all scenarios', () => {
    const ids = scenarios.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have exactly 27 scenario entries', () => {
    expect(scenarios).toHaveLength(27)
  })
})
