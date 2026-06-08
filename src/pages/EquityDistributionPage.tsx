import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { RANKS } from '@/lib/poker/cards'
import type { Card, Rank, Suit } from '@/types/poker'
import type { RangeMap } from '@/lib/poker/range-equity'
import { calculateEquity } from '@/lib/poker/equity'
import { extractRangeFromScenario } from '@/hooks/useRangeEquity'
import { DATA_REGISTRY } from '@/data/index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EquityCell {
  hand: string
  type: 'pair' | 'suited' | 'offsuit'
  equity: number
  inRange: boolean
}

type DistributionBucket = { label: string; count: number; hands: string[] }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUITS_ARR: Suit[] = ['s', 'h', 'd', 'c']

const PREFLOP_SCENARIO_IDS = Object.keys(DATA_REGISTRY).filter(
  id => !['cbet', 'turn', 'river'].some(prefix => id.startsWith(prefix)),
)

// ---------------------------------------------------------------------------
// Board helpers
// ---------------------------------------------------------------------------

function generateRandomFlop(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS_ARR) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  const shuffled = [...deck].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

function cardToDisplay(c: Card): string {
  const suitSymbols: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
  return `${c.rank}${suitSymbols[c.suit]}`
}

function isRedSuit(suit: Suit): boolean {
  return suit === 'h' || suit === 'd'
}

// ---------------------------------------------------------------------------
// Equity computation helpers
// ---------------------------------------------------------------------------

function notationToHeroCards(notation: string): Card[] {
  const rank1 = notation[0] as Rank
  const rank2 = notation[1] as Rank
  const idx1 = RANKS.indexOf(rank1)
  const idx2 = RANKS.indexOf(rank2)
  const hiRank = idx1 <= idx2 ? rank1 : rank2
  const loRank = idx1 <= idx2 ? rank2 : rank1

  if (notation.length === 2) {
    return [
      { rank: hiRank, suit: 's' },
      { rank: loRank, suit: 'h' },
    ]
  }

  if (notation.endsWith('s')) {
    const suit = 's' as Suit
    return [
      { rank: hiRank, suit },
      { rank: loRank, suit },
    ]
  }

  return [
    { rank: hiRank, suit: 's' as Suit },
    { rank: loRank, suit: 'h' as Suit },
  ]
}

// Compute equity for a single hand notation vs random hand on a given board
function computeHandEquity(notation: string, board: Card[]): number {
  const heroCards = notationToHeroCards(notation)
  const result = calculateEquity(heroCards, null, board, 300)
  return Math.round(result.heroEquity * 100)
}

// Build equity distribution buckets
function buildDistribution(cells: EquityCell[]): DistributionBucket[] {
  const buckets: DistributionBucket[] = []
  for (let i = 0; i < 10; i++) {
    const lo = i * 10
    const hi = (i + 1) * 10
    const label = `${lo}-${hi}%`
    const hands = cells.filter(c => c.equity >= lo && c.equity < hi).map(c => c.hand)
    buckets.push({ label, count: hands.length, hands })
  }
  // 100%
  const hundredHands = cells.filter(c => c.equity >= 100).map(c => c.hand)
  if (hundredHands.length > 0) {
    buckets[9] = { label: '90-100%', count: buckets[9].count + hundredHands.length, hands: [...buckets[9].hands, ...hundredHands] }
  }
  return buckets
}

// ---------------------------------------------------------------------------
// C-bet recommendation logic
// ---------------------------------------------------------------------------

function getCbetRecommendation(cells: EquityCell[], inRangeCells: EquityCell[]): {
  freq: number
  label_zh: string
  label_en: string
  reason_zh: string
  reason_en: string
} {
  const rangeCells = inRangeCells.length > 0 ? inRangeCells : cells
  const avgEquity = rangeCells.reduce((s, c) => s + c.equity, 0) / (rangeCells.length || 1)
  const highEquity = rangeCells.filter(c => c.equity >= 55).length
  const total = rangeCells.length || 1

  const highPct = highEquity / total

  if (avgEquity >= 50 && highPct >= 0.4) {
    return {
      freq: 70,
      label_zh: '高频 C-bet (70%)',
      label_en: 'High-Frequency C-bet (70%)',
      reason_zh: '你的范围在该牌面有明显优势，超过40%的手牌拥有55%+胜率。建议高频下注获取价值并施压。',
      reason_en: 'Your range has a clear advantage on this board, with 40%+ hands having 55%+ equity. High-frequency betting extracts value and applies pressure.',
    }
  }

  if (avgEquity >= 42) {
    return {
      freq: 50,
      label_zh: '中频 C-bet (50%)',
      label_en: 'Medium-Frequency C-bet (50%)',
      reason_zh: '范围优势中等，建议使用均衡的中频下注策略，用强牌和少量听牌组合下注。',
      reason_en: 'Moderate range advantage. Use balanced medium-frequency betting with strong hands and some draws.',
    }
  }

  return {
    freq: 25,
    label_zh: '低频 C-bet (25%)',
    label_en: 'Low-Frequency C-bet (25%)',
    reason_zh: '范围在该牌面较弱，建议大幅缩减下注频率，主要用坚果牌和强听牌下注。',
    reason_en: 'Your range is weak on this board. Reduce betting frequency significantly, using mainly nut hands and strong draws.',
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EquityCellView({ cell, onClick }: { cell: EquityCell; onClick?: () => void }) {
  // Color: green (high) -> yellow -> red (low)
  const eq = cell.equity
  let bg: string
  if (eq >= 65) bg = 'bg-emerald-600'
  else if (eq >= 55) bg = 'bg-emerald-500'
  else if (eq >= 45) bg = 'bg-lime-600'
  else if (eq >= 40) bg = 'bg-yellow-600'
  else if (eq >= 35) bg = 'bg-yellow-700'
  else if (eq >= 25) bg = 'bg-orange-700'
  else if (eq >= 15) bg = 'bg-red-700'
  else bg = 'bg-red-900'

  const border = cell.inRange ? 'ring-2 ring-white/60' : ''

  return (
    <button
      onClick={onClick}
      className={`${bg} ${border} rounded text-[9px] md:text-[10px] font-mono leading-tight p-[2px] md:p-0.5 text-white/90 hover:brightness-125 transition-all cursor-default select-none aspect-square flex items-center justify-center`}
      title={`${cell.hand}: ${cell.equity}%`}
    >
      {cell.equity}%
    </button>
  )
}

function DistributionBar({ bucket, maxCount }: { bucket: DistributionBucket; maxCount: number }) {
  const height = maxCount > 0 ? (bucket.count / maxCount) * 120 : 0

  const loLabel = parseInt(bucket.label)
  const color = loLabel >= 60 ? 'bg-emerald-500'
    : loLabel >= 40 ? 'bg-lime-600'
    : loLabel >= 20 ? 'bg-yellow-600'
    : 'bg-red-600'

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-gray-400">{bucket.count}</span>
      <div className="w-6 md:w-8 bg-gray-800 rounded-t relative" style={{ height: '120px' }}>
        <div
          className={`absolute bottom-0 left-0 right-0 ${color} rounded-t transition-all duration-500`}
          style={{ height: `${height}px` }}
        />
      </div>
      <span className="text-[8px] md:text-[9px] text-gray-500 text-center leading-tight w-8 md:w-10">
        {bucket.label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EquityDistributionPage() {
  const { t, lang } = useI18n()

  const [board, setBoard] = useState<Card[]>(() => generateRandomFlop())
  const [selectedScenario, setSelectedScenario] = useState(PREFLOP_SCENARIO_IDS[0])
  const [cells, setCells] = useState<EquityCell[]>([])
  const [distribution, setDistribution] = useState<DistributionBucket[]>([])
  const [computing, setComputing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedCell, setSelectedCell] = useState<EquityCell | null>(null)
  const computationRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutChainRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Get the current range map
  const rangeMap: RangeMap = useMemo(() => {
    try {
      const scenarioData = DATA_REGISTRY[selectedScenario]
      if (!scenarioData) return {}
      return extractRangeFromScenario(scenarioData)
    } catch {
      return {}
    }
  }, [selectedScenario])

  const inRangeSet = useMemo(() => new Set(
    Object.entries(rangeMap)
      .filter(([, freq]) => Object.values(freq as Record<string, number>).some(v => v > 0))
      .map(([notation]) => notation),
  ), [rangeMap])

  // Cancel pending computation when board changes or component unmounts
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
      for (const id of timeoutChainRef.current) clearTimeout(id)
      timeoutChainRef.current = []
      computationRef.current = false
      setComputing(false)
    }
  }, [])

  const runComputation = useCallback(() => {
    // Cancel any in-flight computation
    if (abortRef.current) {
      abortRef.current.abort()
    }
    for (const id of timeoutChainRef.current) clearTimeout(id)
    timeoutChainRef.current = []

    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    computationRef.current = true
    setComputing(true)
    setCells([])
    setDistribution([])
    setProgress(0)

    const allHands: string[] = []
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 13; col++) {
        const rank1 = RANKS[row]
        const rank2 = RANKS[col]
        if (row === col) allHands.push(`${rank1}${rank2}`)
        else if (row < col) allHands.push(`${rank1}${rank2}s`)
        else allHands.push(`${rank2}${rank1}o`)
      }
    }

    const results: EquityCell[] = []
    let idx = 0

    function processNext() {
      if (signal.aborted) return

      if (idx >= allHands.length) {
        setCells(results)
        setDistribution(buildDistribution(results))
        setComputing(false)
        computationRef.current = false
        return
      }

      const batchSize = 5
      const end = Math.min(idx + batchSize, allHands.length)

      for (let i = idx; i < end; i++) {
        if (signal.aborted) return
        const notation = allHands[i]
        const equity = computeHandEquity(notation, board)
        const row = RANKS.indexOf(notation[0] as Rank)
        const col = RANKS.indexOf(notation[1] as Rank)
        let type: 'pair' | 'suited' | 'offsuit'
        if (row === col) type = 'pair'
        else if (notation.endsWith('s')) type = 'suited'
        else type = 'offsuit'

        results.push({ hand: notation, type, equity, inRange: inRangeSet.has(notation) })
      }

      idx = end
      setProgress(Math.round((idx / allHands.length) * 100))
      const tid = setTimeout(processNext, 10)
      timeoutChainRef.current.push(tid)
    }

    processNext()
  }, [board, inRangeSet])

  const regenerateBoard = () => {
    setBoard(generateRandomFlop())
    setSelectedCell(null)
  }

  const scenarioLabel = (id: string): string => {
    const parts = id.split('_')
    const type = parts[0]
    if (type === 'rfi') return `${parts[1]?.toUpperCase()} RFI`
    if (type === 'threebet') return `${parts[1]?.toUpperCase()} 3Bet vs ${parts[3]?.toUpperCase()}`
    if (type === 'defend') return `BB Defend vs ${parts[4]?.toUpperCase()}`
    return id
  }

  // In-range cells for recommendation
  const inRangeCells = cells.filter(c => c.inRange)
  const recommendation = cells.length > 0 ? getCbetRecommendation(cells, inRangeCells.length > 0 ? inRangeCells : cells) : null

  const maxBucketCount = distribution.length > 0 ? Math.max(...distribution.map(d => d.count)) : 0

  // Grid cells in matrix order
  const gridCells: EquityCell[] = []
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const idx = row * 13 + col
      if (idx < cells.length) {
        const c = { ...cells[idx] }
        c.inRange = inRangeSet.has(c.hand)
        gridCells.push(c)
      }
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">{t('equityDist.title')}</h1>
      <p className="text-gray-400 mb-6">{t('equityDist.subtitle')}</p>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Board */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-2">{t('trainer.board')}</div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {board.map((c, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center justify-center w-9 h-12 bg-gray-800 border border-gray-600 rounded text-sm font-bold ${isRedSuit(c.suit) ? 'text-red-400' : 'text-white'}`}
                >
                  {cardToDisplay(c)}
                </span>
              ))}
            </div>
            <button
              onClick={regenerateBoard}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg text-gray-300 transition-colors"
            >
              {t('equityDist.regenerate')}
            </button>
          </div>
        </div>

        {/* Range selector */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-2">{t('equityDist.range')}</div>
          <select
            value={selectedScenario}
            onChange={e => setSelectedScenario(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
          >
            {PREFLOP_SCENARIO_IDS.map(id => (
              <option key={id} value={id}>{scenarioLabel(id)}</option>
            ))}
          </select>
        </div>

        {/* Run button */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-end">
          <button
            onClick={runComputation}
            disabled={computing}
            className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            {computing ? `${t('equityDist.computing')} ${progress}%` : t('equityDist.calculate')}
          </button>
        </div>
      </div>

      {computing && (
        <div className="mb-6">
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-red-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {cells.length > 0 && !computing && (
        <>
          {/* Equity Matrix */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3">{t('equityDist.matrixTitle')}</h2>
            <div className="overflow-x-auto">
              <div className="min-w-[360px]">
                {/* Header row */}
                <div className="grid gap-[2px] md:gap-1" style={{ gridTemplateColumns: '32px repeat(13, 1fr)' }}>
                  <div />
                  {RANKS.map(r => (
                    <div key={r} className="text-center text-[10px] text-gray-500 font-mono">{r}</div>
                  ))}
                </div>
                {/* Matrix rows */}
                {RANKS.map((rowRank, rowIdx) => (
                  <div
                    key={rowRank}
                    className="grid gap-[2px] md:gap-1"
                    style={{ gridTemplateColumns: '32px repeat(13, 1fr)' }}
                  >
                    <div className="flex items-center text-[10px] text-gray-500 font-mono pr-1">{rowRank}</div>
                    {RANKS.map((colRank, colIdx) => {
                      const cellIdx = rowIdx * 13 + colIdx
                      const cell = gridCells[cellIdx]
                      if (!cell) return <div key={colRank} />
                      return (
                        <EquityCellView
                          key={colRank}
                          cell={cell}
                          onClick={() => setSelectedCell(cell)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
              <span>{t('equityDist.low')}</span>
              <div className="flex gap-0.5">
                {['bg-red-900', 'bg-red-700', 'bg-orange-700', 'bg-yellow-700', 'bg-yellow-600', 'bg-lime-600', 'bg-emerald-500', 'bg-emerald-600'].map((c, i) => (
                  <div key={i} className={`w-4 h-3 ${c} rounded-sm`} />
                ))}
              </div>
              <span>{t('equityDist.high')}</span>
              <span className="ml-4">□ = {t('equityDist.inRange')}</span>
            </div>
          </div>

          {/* Selected cell detail */}
          {selectedCell && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-4">
                <span className="text-xl font-bold font-mono">{selectedCell.hand}</span>
                <span className={`text-2xl font-bold ${selectedCell.equity >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedCell.equity}%
                </span>
                <span className="text-sm text-gray-400">{t('equityDist.vsRandom')}</span>
                {selectedCell.inRange && (
                  <span className="text-xs bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded">{t('equityDist.inRange')}</span>
                )}
              </div>
            </div>
          )}

          {/* Distribution Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3">{t('equityDist.distributionTitle')}</h2>
            <div className="flex items-end justify-center gap-1 md:gap-1.5">
              {distribution.map((bucket, i) => (
                <DistributionBar key={i} bucket={bucket} maxCount={maxBucketCount} />
              ))}
            </div>

            {/* Nuts and Air summary */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-3">
                <div className="text-sm font-medium text-emerald-400 mb-1">{t('equityDist.nuts')}</div>
                <div className="text-xs text-gray-400">
                  {distribution.length > 0
                    ? distribution.slice(6).flatMap(b => b.hands).slice(0, 8).join(', ') + (distribution.slice(6).flatMap(b => b.hands).length > 8 ? '...' : '')
                    : '-'}
                </div>
              </div>
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <div className="text-sm font-medium text-red-400 mb-1">{t('equityDist.air')}</div>
                <div className="text-xs text-gray-400">
                  {distribution.length > 0
                    ? distribution.slice(0, 3).flatMap(b => b.hands).slice(0, 8).join(', ') + (distribution.slice(0, 3).flatMap(b => b.hands).length > 8 ? '...' : '')
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* C-bet Recommendation */}
          {recommendation && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-3">{t('equityDist.cbetTitle')}</h2>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-xl font-bold text-yellow-400 mb-2">
                  {lang === 'zh' ? recommendation.label_zh : recommendation.label_en}
                </div>
                <div className="text-sm text-gray-300">
                  {lang === 'zh' ? recommendation.reason_zh : recommendation.reason_en}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${recommendation.freq}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400">{recommendation.freq}%</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
