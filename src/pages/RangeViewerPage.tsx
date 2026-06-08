import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { getScenarioData, getAllScenarios, isPreflop, isPostflop, type ScenarioData, type PostflopScenarioData, type PostflopStrategyEntry } from '@/data/index'
import type { StrategyEntry } from '@/types/poker'
import { useI18n } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

const ACTION_COLORS: Record<string, string> = {
  raise: '#ef4444',
  threeBet: '#f97316',
  '3bet': '#f97316',
  fourBet: '#dc2626',
  '4bet': '#dc2626',
  call: '#3b82f6',
  check: '#6b7280',
  fold: '#0a0a0a',
  bet_33pct: '#c084fc',
  bet_50pct: '#a855f7',
  bet_75pct: '#8b5cf6',
  bet_100pct: '#7c3aed',
}

const OVERLAY_ACTION_COLORS: Record<string, string> = {
  raise: '#fbbf24',
  threeBet: '#f59e0b',
  '3bet': '#f59e0b',
  fourBet: '#d97706',
  '4bet': '#d97706',
  call: '#06b6d4',
  check: '#84cc16',
  fold: '#1a1a1a',
  bet_33pct: '#f472b6',
  bet_50pct: '#ec4899',
  bet_75pct: '#db2777',
  bet_100pct: '#be185d',
}


const ACTION_LABEL_KEYS: Record<string, string> = {
  raise: 'action.raise',
  threeBet: 'action.threeBet',
  '3bet': 'action.threeBet',
  fourBet: 'action.fourBet',
  '4bet': 'action.fourBet',
  call: 'action.call',
  check: 'action.check',
  fold: 'action.fold',
  bet_75pct: 'action.bet75',
  bet_50pct: 'action.bet50',
  bet_33pct: 'action.bet33',
  bet_100pct: 'action.bet100',
}

const ACTION_LABEL_FALLBACK: Record<string, string> = {
  raise: '加注',
  threeBet: '三次加注',
  '3bet': '三次加注',
  fourBet: '四次加注',
  '4bet': '四次加注',
  call: '跟注',
  check: '过牌',
  fold: '弃牌',
  bet_75pct: '下注75%',
  bet_50pct: '下注50%',
  bet_33pct: '下注33%',
  bet_100pct: '下注100%',
}

const LEGEND_ACTIONS = [
  'raise',
  'threeBet',
  'fourBet',
  'call',
  'check',
  'bet_33pct',
  'bet_50pct',
  'bet_75pct',
  'bet_100pct',
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHandNotation(row: number, col: number): string {
  if (row === col) return RANKS[row] + RANKS[col]
  if (row < col) return RANKS[row] + RANKS[col] + 's'
  return RANKS[col] + RANKS[row] + 'o'
}

function getComboCount(hand: string): number {
  if (hand.length === 2) return 6 // pair
  if (hand.endsWith('s')) return 4 // suited
  return 12 // offsuit
}

function getHandDescription(_hand: string, entry: StrategyEntry, t: (key: string) => string): string {
  const actions = Object.entries(entry).sort(([, a], [, b]) => b - a)
  if (actions.length === 0) return t('action.fold')
  const [bestAction, bestFreq] = actions[0]
  const label = getActionLabel(bestAction, t)
  if (bestFreq >= 0.9) return `${label} ${(bestFreq * 100).toFixed(0)}%`
  return `${t('range.mixedStrategy')} - ${t('range.mainly')} ${label} ${(bestFreq * 100).toFixed(0)}%`
}


function isFoldOnly(entry: Record<string, number>): boolean {
  const keys = Object.keys(entry)
  return keys.length === 1 && keys[0] === 'fold' && entry.fold === 1
}

function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? '#6b7280'
}

function getOverlayActionColor(action: string): string {
  return OVERLAY_ACTION_COLORS[action] ?? '#84cc16'
}

function getActionLabel(action: string, t: (key: string) => string): string {
  const key = ACTION_LABEL_KEYS[action]
  if (key) return t(key)
  return ACTION_LABEL_FALLBACK[action] ?? action
}

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// ---------------------------------------------------------------------------
// Tooltip position type
// ---------------------------------------------------------------------------

interface TooltipPos {
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Segment builder (shared by MatrixCell)
// ---------------------------------------------------------------------------

function buildSegments(entry: StrategyEntry | undefined, foldOnly: boolean): { action: string; freq: number }[] {
  const segments: { action: string; freq: number }[] = []
  if (entry && !foldOnly) {
    for (const [action, freq] of Object.entries(entry)) {
      const f = typeof freq === 'number' ? freq : 0
      if (f > 0.005 && action !== 'fold') {
        segments.push({ action, freq: f })
      }
    }
    segments.sort((a, b) => b.freq - a.freq)
    if (entry.fold && entry.fold > 0.005) {
      segments.push({ action: 'fold', freq: entry.fold })
    }
  }
  return segments
}

// ---------------------------------------------------------------------------
// MatrixCell (memoized to avoid re-rendering 169 cells on every state change)
// ---------------------------------------------------------------------------

interface CellProps {
  hand: string
  entry: StrategyEntry | undefined
  overlayEntry: StrategyEntry | undefined
  isSelected: boolean
  overlayMode: boolean
  onClick: () => void
  onMouseEnter: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseLeave: () => void
}

const MatrixCell = React.memo(function MatrixCell({
  hand,
  entry,
  overlayEntry,
  isSelected,
  overlayMode,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: CellProps) {
  const foldOnly = entry ? isFoldOnly(entry) : true
  const overlayFoldOnly = overlayEntry ? isFoldOnly(overlayEntry) : true

  const segments = useMemo(() => buildSegments(entry, foldOnly), [entry, foldOnly])
  const overlaySegments = useMemo(
    () => buildSegments(overlayMode ? overlayEntry : undefined, overlayFoldOnly),
    [overlayMode, overlayEntry, overlayFoldOnly],
  )

  const showOverlay = overlayMode && overlaySegments.length > 0

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`w-12 min-w-[48px] min-h-[48px] h-12 m-px rounded-md flex flex-col items-center justify-center transition-all relative select-none bg-gray-900 border border-gray-800/50 ${
        isSelected
          ? 'ring-2 ring-red-500 scale-105 z-10 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
          : 'hover:scale-105 hover:z-10 hover:shadow-[0_0_8px_rgba(255,255,255,0.15)]'
      }`}
    >
      {showOverlay ? (
        <div className="absolute inset-0 flex overflow-hidden rounded-md">
          <div className="w-1/2 h-full flex">
            {segments.length > 0 ? segments.map((seg) => (
              <div
                key={seg.action}
                className="h-full"
                style={{
                  width: `${(seg.freq / segments.reduce((s, x) => s + x.freq, 0)) * 100}%`,
                  backgroundColor: getActionColor(seg.action),
                  opacity: 0.85,
                }}
              />
            )) : (
              <div className="h-full w-full bg-gray-900" />
            )}
          </div>
          <div className="w-1/2 h-full flex">
            {overlaySegments.map((seg) => (
              <div
                key={seg.action}
                className="h-full"
                style={{
                  width: `${(seg.freq / overlaySegments.reduce((s, x) => s + x.freq, 0)) * 100}%`,
                  backgroundColor: getOverlayActionColor(seg.action),
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
        </div>
      ) : segments.length > 0 ? (
        <div className="absolute inset-0 flex overflow-hidden rounded-md">
          {segments.map((seg, i) => (
            <div
              key={seg.action}
              className="h-full"
              style={{
                width: `${seg.freq * 100}%`,
                background: i === 0
                  ? `linear-gradient(180deg, ${getActionColor(seg.action)}dd 0%, ${getActionColor(seg.action)} 100%)`
                  : getActionColor(seg.action),
              }}
            />
          ))}
        </div>
      ) : null}
      <span
        className={`relative z-10 text-[10px] font-bold leading-none ${
          foldOnly ? 'text-gray-600' : 'text-white/90'
        }`}
      >
        {hand}
      </span>
    </button>
  )
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RangeViewerPage() {
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const scenarios = useMemo(() => getAllScenarios(), [])
  const preflopScenarios = useMemo(() => scenarios.filter((s) => s.category === 'preflop'), [scenarios])
  const postflopScenarios = useMemo(() => scenarios.filter((s) => s.category === 'postflop'), [scenarios])
  const { t } = useI18n()

  const [selectedId, setSelectedId] = useState(preflopScenarios[0]?.id ?? '')
  const [selectedHand, setSelectedHand] = useState<string | null>(null)
  const [hoveredHand, setHoveredHand] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ x: 0, y: 0 })
  const [showMobileOverlay, setShowMobileOverlay] = useState(false)
  const [mobileOverlayHand, setMobileOverlayHand] = useState<string | null>(null)
  const [overlayMode, setOverlayMode] = useState(false)
  const [overlayScenarioId, setOverlayScenarioId] = useState<string>('')
  const matrixRef = useRef<HTMLDivElement>(null)

  // Detect if we are on a touch / narrow device
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches)
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Resolve scenario data
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const data = useMemo<ScenarioData | null>(() => {
    const meta = scenarios.find((s) => s.id === selectedId)
    if (!meta) return null
    return getScenarioData({
      scenarioType: meta.subCategory,
      position: meta.position,
      villainPosition: meta.villainPosition,
      boardTexture: meta.boardTexture,
    })
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [selectedId, scenarios])

  const strategy = useMemo<Record<string, StrategyEntry>>(() => {
    if (!data || !isPreflop(data)) return {}
    return data.hands as Record<string, StrategyEntry>
  }, [data])

  // Overlay scenario data
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const overlayData = useMemo<ScenarioData | null>(() => {
    if (!overlayMode || !overlayScenarioId) return null
    const meta = scenarios.find((s) => s.id === overlayScenarioId)
    if (!meta) return null
    return getScenarioData({
      scenarioType: meta.subCategory,
      position: meta.position,
      villainPosition: meta.villainPosition,
      boardTexture: meta.boardTexture,
    })
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [overlayMode, overlayScenarioId, scenarios])

  const overlayStrategy = useMemo<Record<string, StrategyEntry>>(() => {
    if (!overlayData || !isPreflop(overlayData)) return {}
    return overlayData.hands as Record<string, StrategyEntry>
  }, [overlayData])

  const postflopData = useMemo<PostflopScenarioData | null>(() => {
    if (!data || !isPostflop(data)) return null
    return data
  }, [data])

  const postflopStrategy = useMemo<Record<string, PostflopStrategyEntry>>(() => {
    if (!postflopData) return {}
    return postflopData.strategy
  }, [postflopData])

  const isPreflopView = data ? isPreflop(data) : false

  const selectedEntry = selectedHand ? strategy[selectedHand] ?? null : null
  const hoveredEntry = hoveredHand ? strategy[hoveredHand] ?? null : null

  // Range size and combo stats
  const rangeStats = useMemo(() => {
    let totalHands = 0
    let totalCombos = 0
    const actionCombos: Record<string, number> = {}

    for (const [hand, entry] of Object.entries(strategy)) {
      if (!isFoldOnly(entry)) {
        totalHands++
        const combos = getComboCount(hand)
        totalCombos += combos

        // Count combos per action
        for (const [action, freq] of Object.entries(entry)) {
          if (typeof freq === 'number' && freq > 0.005) {
            actionCombos[action] = (actionCombos[action] ?? 0) + combos * freq
          }
        }
      }
    }

    // Total possible combos (1326 = 52*51/2)
    const coverage = totalCombos / 1326

    return { totalHands, totalCombos, actionCombos, coverage }
  }, [strategy])

  const rangeSize = rangeStats.totalHands

  // Close overlay helper
  const closeMobileOverlay = useCallback(() => {
    setShowMobileOverlay(false)
    setMobileOverlayHand(null)
  }, [])

  // Cell click handler
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const handleCellClick = useCallback(
    (hand: string) => {
      if (isMobile) {
        // On mobile: tap shows overlay
        setMobileOverlayHand(hand)
        setShowMobileOverlay(true)
      } else {
        // On desktop: click selects detail card
        setSelectedHand((prev) => (hand === prev ? null : hand))
      }
    },
    [isMobile],
  )
  /* eslint-enable react-hooks/preserve-manual-memoization */

  // Desktop hover handlers
  const handleMouseEnter = useCallback(
    (hand: string, e: React.MouseEvent) => {
      if (isMobile) return
      setHoveredHand(hand)
      setTooltipPos({ x: e.clientX + 12, y: e.clientY + 12 })
    },
    [isMobile],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isMobile) return
      setTooltipPos({ x: e.clientX + 12, y: e.clientY + 12 })
    },
    [isMobile],
  )

  const handleMouseLeave = useCallback(() => {
    if (isMobile) return
    setHoveredHand(null)
  }, [isMobile])

  // Select scenario
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const selectScenario = useCallback((id: string) => {
    setSelectedId(id)
    setSelectedHand(null)
    setShowMobileOverlay(false)
    setMobileOverlayHand(null)
    setOverlayMode(false)
    setOverlayScenarioId('')
  }, [])

  // Mobile overlay entry
  const overlayEntry = mobileOverlayHand ? strategy[mobileOverlayHand] ?? null : null

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col md:flex-row mx-auto max-w-[1920px]">
      {/* ---------------------------------------------------------------- */}
      {/* Sidebar / Mobile Tab Bar                                          */}
      {/* ---------------------------------------------------------------- */}
      {isMobile ? (
        <nav className="flex-shrink-0 bg-gray-950 border-b border-gray-800 overflow-x-auto">
          <div className="flex gap-1 p-2">
            {[...preflopScenarios, ...postflopScenarios].map((s) => (
              <button
                key={s.id}
                onClick={() => selectScenario(s.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedId === s.id
                    ? 'bg-red-600 text-white'
                    : 'text-gray-400 bg-gray-900 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {s.position && (
                  <span className="text-gray-500 mr-1">{s.position}</span>
                )}
                {s.name}
              </button>
            ))}
          </div>
        </nav>
      ) : (
        <aside className="w-[20%] min-w-[200px] max-w-[280px] flex-shrink-0 bg-gray-950 border-r border-gray-800 p-4 overflow-y-auto hidden md:block">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
            {t('range.preflop')}
          </h2>
          <div className="space-y-1 mb-6">
            {preflopScenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => selectScenario(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedId === s.id
                    ? 'bg-red-600 text-white font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {s.position && (
                  <span className="text-gray-500 mr-1">{s.position}</span>
                )}
                {s.name}
              </button>
            ))}
          </div>

          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
            {t('range.postflop')}
          </h2>
          <div className="space-y-1">
            {postflopScenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => selectScenario(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedId === s.id
                    ? 'bg-red-600 text-white font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Right Content Area (80%)                                          */}
      {/* ---------------------------------------------------------------- */}
      <main className="flex-1 p-4 md:p-6 overflow-auto relative flex flex-col items-center">
        {/* Header with stats + legend */}
        <div className="mb-4 w-full max-w-4xl">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {scenarios.find((s) => s.id === selectedId)?.name ?? t('range.title')}
                {overlayMode && overlayScenarioId && (
                  <span className="text-sm md:text-base font-normal text-gray-400 ml-2">
                    {t('range.vs')} {scenarios.find((s) => s.id === overlayScenarioId)?.name}
                  </span>
                )}
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                {scenarios.find((s) => s.id === selectedId)?.description ?? ''}
                {isPreflopView
                  ? ` · ${t('range.range')}: ${rangeSize}/169 ${t('range.hands')} (${((rangeSize / 169) * 100).toFixed(1)}%)`
                  : ` · ${Object.keys(postflopStrategy).length} ${t('range.handCategories')}`
                }
              </p>
            </div>

            {/* Compare mode controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {overlayMode && isPreflopView && (
                <select
                  value={overlayScenarioId}
                  onChange={(e) => setOverlayScenarioId(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 max-w-[180px]"
                >
                  <option value="">{t('range.selectOverlay')}</option>
                  {preflopScenarios
                    .filter((s) => s.id !== selectedId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.position ? `${s.position} ` : ''}{s.name}
                      </option>
                    ))}
                </select>
              )}
              {isPreflopView && (
                <button
                  onClick={() => {
                    if (overlayMode) {
                      setOverlayMode(false)
                      setOverlayScenarioId('')
                    } else {
                      setOverlayMode(true)
                      if (!overlayScenarioId) {
                        const otherScenario = preflopScenarios.find((s) => s.id !== selectedId)
                        if (otherScenario) setOverlayScenarioId(otherScenario.id)
                      }
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    overlayMode
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="1" width="6" height="6" rx="1" />
                    <rect x="9" y="1" width="6" height="6" rx="1" />
                    <rect x="1" y="9" width="6" height="6" rx="1" />
                    <rect x="9" y="9" width="6" height="6" rx="1" />
                  </svg>
                  {overlayMode ? t('range.compareModeOff') : t('range.compareMode')}
                </button>
              )}
            </div>
          </div>

          {/* Legend - compact with percentages */}
          <div className="mt-3">
            {overlayMode ? (
              <div className="flex flex-col gap-2">
                {/* Range 1 legend */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold text-gray-400 min-w-[36px]">
                    {t('range.range1')}:
                  </span>
                  {LEGEND_ACTIONS.map((action) => {
                    const count = rangeStats.actionCombos[action] ?? 0
                    if (count < 0.5) return null
                    return (
                      <div key={action} className="flex items-center gap-1">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: getActionColor(action) }}
                        />
                        <span className="text-[10px] text-gray-500">
                          {getActionLabel(action, t)}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">
                          {Math.round(count)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* Range 2 legend */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold text-gray-400 min-w-[36px]">
                    {t('range.range2')}:
                  </span>
                  {LEGEND_ACTIONS.map((action) => (
                    <div key={action} className="flex items-center gap-1">
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: getOverlayActionColor(action) }}
                      />
                      <span className="text-[10px] text-gray-500">
                        {getActionLabel(action, t)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex gap-2 md:gap-3 flex-wrap">
                {LEGEND_ACTIONS.map((action) => {
                  const count = rangeStats.actionCombos[action] ?? 0
                  if (count < 0.5) return null
                  return (
                    <div key={action} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: getActionColor(action) }}
                      />
                      <span className="text-[10px] md:text-xs text-gray-500">
                        {getActionLabel(action, t)}
                      </span>
                      <span className="text-[10px] md:text-xs text-gray-600 font-mono">
                        {Math.round(count)} {t('range.legendCombos')}
                      </span>
                    </div>
                  )
                })}
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[10px] md:text-xs text-gray-600 font-mono">
                    {t('range.rangeCoverage')}: {(rangeStats.coverage * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {isPreflopView ? (
          <>
            {/* Matrix container - horizontally scrollable on mobile with snap */}
            <div className="overflow-x-auto pb-2 mx-auto snap-x snap-mandatory md:snap-none" ref={matrixRef}>
              <div className="inline-block min-w-[640px]">
                {/* Column headers */}
                <div className="flex ml-14 mb-0.5">
                  {RANKS.map((r) => (
                    <div
                      key={r}
                      className="w-12 min-w-[48px] text-center text-xs text-gray-600 font-mono select-none"
                    >
                      {r}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {RANKS.map((rowRank, rowIdx) => (
                  <div key={rowRank} className="flex items-center">
                    <div className="w-14 text-xs text-gray-600 font-mono text-right pr-2 select-none">
                      {rowRank}
                    </div>
                    {RANKS.map((_, colIdx) => {
                      const hand = getHandNotation(rowIdx, colIdx)

                      return (
                        <MatrixCell
                          key={hand}
                          hand={hand}
                          entry={strategy[hand]}
                          overlayEntry={overlayMode ? overlayStrategy[hand] : undefined}
                          isSelected={selectedHand === hand}
                          overlayMode={overlayMode}
                          onClick={() => handleCellClick(hand)}
                          onMouseEnter={(e) => handleMouseEnter(hand, e)}
                          onMouseMove={handleMouseMove}
                          onMouseLeave={handleMouseLeave}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Floating Tooltip (desktop hover)                                 */}
            {/* -------------------------------------------------------------- */}
            {hoveredHand && hoveredEntry && !isMobile && (
              <Tooltip
                hand={hoveredHand}
                entry={hoveredEntry}
                pos={tooltipPos}
                containerRef={matrixRef}
              />
            )}

            {/* -------------------------------------------------------------- */}
            {/* Detail Panel (below matrix)                                      */}
            {/* -------------------------------------------------------------- */}
            {selectedHand && (
              <DetailCard
                hand={selectedHand}
                entry={selectedEntry}
                onClose={() => setSelectedHand(null)}
                overlayMode={overlayMode}
                overlayEntry={overlayMode ? (overlayStrategy[selectedHand] ?? null) : undefined}
                overlayScenarioName={overlayScenarioId ? scenarios.find((s) => s.id === overlayScenarioId)?.name : undefined}
                primaryScenarioName={scenarios.find((s) => s.id === selectedId)?.name}
              />
            )}
          </>
        ) : (
          <>
            {/* -------------------------------------------------------------- */}
            {/* Postflop Category Grid                                           */}
            {/* -------------------------------------------------------------- */}
            {postflopData?.exampleBoard && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-gray-500">{t('range.exampleBoard')}</span>
                {postflopData.exampleBoard.map((card: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-gray-800 rounded text-sm font-mono text-white"
                  >
                    {card}
                  </span>
                ))}
              </div>
            )}

            <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(postflopStrategy).map(([category, actions]) => {
                const isSelected = selectedHand === category
                // Build sorted action entries (exclude trivially-zero)
                const sortedActions = Object.entries(actions)
                  .filter(([, freq]) => freq > 0.005)
                  .sort(([, a], [, b]) => b - a)

                return (
                  <button
                    key={category}
                    onClick={() =>
                      setSelectedHand(isSelected ? null : category)
                    }
                    className={`text-left bg-gray-900 rounded-xl border transition-all p-4 ${
                      isSelected
                        ? 'border-white ring-1 ring-white'
                        : 'border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    {/* Category name */}
                    <p className="text-white font-semibold text-sm mb-2.5 truncate">
                      {formatCategoryName(category)}
                    </p>

                    {/* Stacked frequency bar */}
                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-800 mb-2.5">
                      {sortedActions.map(([action, freq]) => (
                        <div
                          key={action}
                          className="h-full"
                          style={{
                            width: `${freq * 100}%`,
                            backgroundColor: getActionColor(action),
                          }}
                        />
                      ))}
                    </div>

                    {/* Action breakdown */}
                    <div className="space-y-1">
                      {sortedActions.map(([action, freq]) => (
                        <div key={action} className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: getActionColor(action) }}
                          />
                          <span className="text-[11px] text-gray-400 truncate">
                            {getActionLabel(action, t)}
                          </span>
                          <span className="text-[11px] text-white font-mono ml-auto">
                            {(freq * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Selected Category Detail (postflop)                              */}
            {/* -------------------------------------------------------------- */}
            {selectedHand && postflopStrategy[selectedHand] && (
              <PostflopDetailCard
                category={selectedHand}
                actions={postflopStrategy[selectedHand]}
                onClose={() => setSelectedHand(null)}
              />
            )}
          </>
        )}
      </main>

      {/* ---------------------------------------------------------------- */}
      {/* Mobile Overlay Modal                                              */}
      {/* ---------------------------------------------------------------- */}
      {isMobile && showMobileOverlay && mobileOverlayHand && (
        <MobileOverlay
          hand={mobileOverlayHand}
          entry={overlayEntry}
          onClose={closeMobileOverlay}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Floating Tooltip (desktop)
// ---------------------------------------------------------------------------

interface TooltipProps {
  hand: string
  entry: StrategyEntry
  pos: TooltipPos
  containerRef: React.RefObject<HTMLDivElement | null>
}

function Tooltip({ hand, entry, pos, containerRef }: TooltipProps) {
  const tipRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()
  const [adjustedPos, setAdjustedPos] = useState(pos)

  // Adjust position to stay within the content area
  useLayoutEffect(() => {
    const container = containerRef.current
    const tip = tipRef.current
    if (!container || !tip) {
      setAdjustedPos(pos)
      return
    }

    const rect = container.getBoundingClientRect()
    const tipW = tip.offsetWidth
    const tipH = tip.offsetHeight

    let x = pos.x
    let y = pos.y

    // Keep tooltip inside container horizontally
    if (x + tipW > rect.right) x = rect.right - tipW - 8
    if (x < rect.left) x = rect.left + 8

    // If tooltip would go below container, show above cursor
    if (y + tipH > rect.bottom) y = pos.y - tipH - 16
    if (y < rect.top) y = rect.top + 8

    setAdjustedPos({ x, y })
  }, [pos, containerRef])

  const foldOnly = isFoldOnly(entry)

  return (
    <div
      ref={tipRef}
      className="fixed z-50 pointer-events-none"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl px-4 py-3 min-w-[180px]">
        <p className="text-white font-bold text-sm mb-2">{hand}</p>
        {foldOnly ? (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: getActionColor('fold') }}
            />
            <span className="text-gray-400 text-xs">{t('range.foldFull')}</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {Object.entries(entry)
              .filter(([, f]) => f > 0.005)
              .sort(([, a], [, b]) => b - a)
              .map(([action, freq]) => (
                <div key={action} className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-16 flex-shrink-0">
                    {getActionLabel(action, t)}
                  </span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${freq * 100}%`,
                        backgroundColor: getActionColor(action),
                      }}
                    />
                  </div>
                  <span className="text-white text-xs font-mono w-10 text-right">
                    {(freq * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail Card (below matrix, desktop click)
// ---------------------------------------------------------------------------

interface DetailCardProps {
  hand: string
  entry: StrategyEntry | null
  onClose: () => void
  overlayEntry?: StrategyEntry | null
  overlayMode?: boolean
  overlayScenarioName?: string
  primaryScenarioName?: string
}

function DetailCard({ hand, entry, onClose, overlayEntry, overlayMode, overlayScenarioName, primaryScenarioName }: DetailCardProps) {
  const combos = getComboCount(hand)
  const { t } = useI18n()
  const typeLabel = hand.length === 2 ? t('range.pair') : hand.endsWith('s') ? t('range.suited') : t('range.offsuit')

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 md:p-6 max-w-2xl w-full mt-4 mx-auto">
      <div className="flex items-start gap-6 md:gap-8">
        {/* Left: hand info */}
        <div className="flex-shrink-0">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-1">{hand}</h3>
          <p className="text-xs md:text-sm text-gray-500">
            {typeLabel} = {combos} {t('range.combos')}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {entry ? getHandDescription(hand, entry, t) : t('range.notInRange')}
          </p>
        </div>

        {/* Right: action bars - side by side in overlay mode */}
        {overlayMode ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Range 1 */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 mb-2">{primaryScenarioName ?? t('range.range1')}</p>
              {entry ? (
                <div className="space-y-2">
                  {Object.entries(entry)
                    .filter(([, f]) => f > 0.005)
                    .sort(([, a], [, b]) => b - a)
                    .map(([action, freq]) => (
                      <div key={action} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: getActionColor(action) }}
                        />
                        <span className="text-gray-400 text-[11px] w-14 flex-shrink-0">
                          {getActionLabel(action, t)}
                        </span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${freq * 100}%`,
                              backgroundColor: getActionColor(action),
                            }}
                          />
                        </div>
                        <span className="text-white font-mono text-[11px] w-10 text-right">
                          {(freq * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <span className="text-gray-500 text-sm">{t('range.foldFull')}</span>
              )}
            </div>

            {/* Range 2 */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 mb-2">{overlayScenarioName ?? t('range.range2')}</p>
              {overlayEntry ? (
                <div className="space-y-2">
                  {Object.entries(overlayEntry)
                    .filter(([, f]) => f > 0.005)
                    .sort(([, a], [, b]) => b - a)
                    .map(([action, freq]) => (
                      <div key={action} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: getOverlayActionColor(action) }}
                        />
                        <span className="text-gray-400 text-[11px] w-14 flex-shrink-0">
                          {getActionLabel(action, t)}
                        </span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${freq * 100}%`,
                              backgroundColor: getOverlayActionColor(action),
                            }}
                          />
                        </div>
                        <span className="text-white font-mono text-[11px] w-10 text-right">
                          {(freq * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <span className="text-gray-500 text-sm">{t('range.foldFull')}</span>
              )}
            </div>
          </div>
        ) : entry ? (
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {Object.entries(entry)
              .filter(([, f]) => f > 0.005)
              .sort(([, a], [, b]) => b - a)
              .map(([action, freq]) => (
                <div key={action} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: getActionColor(action) }}
                  />
                  <span className="text-gray-400 text-sm w-16 flex-shrink-0">
                    {getActionLabel(action, t)}
                  </span>
                  <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${freq * 100}%`,
                        backgroundColor: getActionColor(action),
                      }}
                    />
                  </div>
                  <span className="text-white font-mono text-sm w-12 text-right">
                    {(freq * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center">
            <span className="text-gray-500 text-lg">{t('range.foldFull')}</span>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          aria-label="关闭"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4L12 12M12 4L4 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile Overlay (centered modal for touch)
// ---------------------------------------------------------------------------

interface MobileOverlayProps {
  hand: string
  entry: StrategyEntry | null
  onClose: () => void
}

function MobileOverlay({ hand, entry, onClose }: MobileOverlayProps) {
  const combos = getComboCount(hand)
  const { t } = useI18n()
  const typeLabel = hand.length === 2 ? t('range.pair') : hand.endsWith('s') ? t('range.suited') : t('range.offsuit')
  const foldOnly = entry ? isFoldOnly(entry) : true

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 border-b-0 rounded-t-2xl shadow-2xl w-full max-w-lg p-5 pb-8 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white">{hand}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {typeLabel} = {combos} {t('range.combos')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="关闭"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4L12 12M12 4L4 12" />
            </svg>
          </button>
        </div>

        {/* Actions */}
        {entry && !foldOnly ? (
          <div className="space-y-3">
            {Object.entries(entry)
              .filter(([, f]) => f > 0.005)
              .sort(([, a], [, b]) => b - a)
              .map(([action, freq]) => (
                <div key={action} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: getActionColor(action) }}
                  />
                  <span className="text-gray-400 text-sm w-16 flex-shrink-0">
                    {getActionLabel(action, t)}
                  </span>
                  <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${freq * 100}%`,
                        backgroundColor: getActionColor(action),
                      }}
                    />
                  </div>
                  <span className="text-white font-mono text-sm w-12 text-right">
                    {(freq * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">{t('range.foldFull')}</div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Postflop Detail Card (expanded view when a category is clicked)
// ---------------------------------------------------------------------------

interface PostflopDetailCardProps {
  category: string
  actions: PostflopStrategyEntry
  onClose: () => void
}

function PostflopDetailCard({ category, actions, onClose }: PostflopDetailCardProps) {
  const sortedActions = Object.entries(actions)
    .filter(([, freq]) => freq > 0.005)
    .sort(([, a], [, b]) => b - a)
  const { t } = useI18n()

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 md:p-6 max-w-2xl w-full mt-4 mx-auto">
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0">
          <h3 className="text-xl md:text-2xl font-bold text-white mb-1">
            {formatCategoryName(category)}
          </h3>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {sortedActions.map(([action, freq]) => (
            <div key={action} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: getActionColor(action) }}
              />
              <span className="text-gray-400 text-sm w-16 flex-shrink-0">
                {getActionLabel(action, t)}
              </span>
              <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${freq * 100}%`,
                    backgroundColor: getActionColor(action),
                  }}
                />
              </div>
              <span className="text-white font-mono text-sm w-12 text-right">
                {(freq * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          aria-label="关闭"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4L12 12M12 4L4 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
