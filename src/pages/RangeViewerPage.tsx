import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
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

function getHandDescription(_hand: string, entry: StrategyEntry): string {
  const actions = Object.entries(entry).sort(([, a], [, b]) => b - a)
  if (actions.length === 0) return '弃牌'
  const [bestAction, bestFreq] = actions[0]
  const label = ACTION_LABEL_FALLBACK[bestAction] ?? bestAction
  if (bestFreq >= 0.9) return `${label} ${(bestFreq * 100).toFixed(0)}%`
  return `混合策略 - 主要 ${label} ${(bestFreq * 100).toFixed(0)}%`
}


function isFoldOnly(entry: Record<string, number>): boolean {
  const keys = Object.keys(entry)
  return keys.length === 1 && keys[0] === 'fold' && entry.fold === 1
}

function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? '#6b7280'
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
// Component
// ---------------------------------------------------------------------------

export default function RangeViewerPage() {
  const scenarios = getAllScenarios()
  const preflopScenarios = scenarios.filter((s) => s.category === 'preflop')
  const postflopScenarios = scenarios.filter((s) => s.category === 'postflop')
  const { t } = useI18n()

  const [selectedId, setSelectedId] = useState(preflopScenarios[0]?.id ?? '')
  const [selectedHand, setSelectedHand] = useState<string | null>(null)
  const [hoveredHand, setHoveredHand] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ x: 0, y: 0 })
  const [showMobileOverlay, setShowMobileOverlay] = useState(false)
  const [mobileOverlayHand, setMobileOverlayHand] = useState<string | null>(null)
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

  // Range size
  const rangeSize = useMemo(() => {
    let count = 0
    for (const entry of Object.values(strategy)) {
      if (!isFoldOnly(entry)) count++
    }
    return count
  }, [strategy])

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
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {scenarios.find((s) => s.id === selectedId)?.name ?? t('range.title')}
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            {scenarios.find((s) => s.id === selectedId)?.description ?? ''}
            {isPreflopView
              ? ` · ${t('range.range')}: ${rangeSize}/169 ${t('range.hands')} (${((rangeSize / 169) * 100).toFixed(1)}%)`
              : ` · ${Object.keys(postflopStrategy).length} ${t('range.handCategories')}`
            }
          </p>
          {/* Legend */}
          <div className="flex gap-2 md:gap-3 flex-wrap mt-3">
            {LEGEND_ACTIONS.map((action) => (
              <div key={action} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: getActionColor(action) }}
                />
                <span className="text-[10px] md:text-xs text-gray-500">
                  {getActionLabel(action, t)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isPreflopView ? (
          <>
            {/* Matrix container - horizontally scrollable on mobile */}
            <div className="overflow-x-auto pb-2 mx-auto" ref={matrixRef}>
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
                      const entry = strategy[hand]
                      const isSelected = selectedHand === hand
                      const foldOnly = entry ? isFoldOnly(entry) : true

                      // Build sorted action segments: largest freq first, fold always last
                      const segments: { action: string; freq: number }[] = []
                      if (entry && !foldOnly) {
                        for (const [action, freq] of Object.entries(entry)) {
                          const f = typeof freq === 'number' ? freq : 0
                          if (f > 0.005 && action !== 'fold') {
                            segments.push({ action, freq: f })
                          }
                        }
                        segments.sort((a, b) => b.freq - a.freq)
                        // Append fold last if present
                        if (entry.fold && entry.fold > 0.005) {
                          segments.push({ action: 'fold', freq: entry.fold })
                        }
                      }

                      return (
                        <button
                          key={hand}
                          onClick={() => handleCellClick(hand)}
                          onMouseEnter={(e) => handleMouseEnter(hand, e)}
                          onMouseMove={handleMouseMove}
                          onMouseLeave={handleMouseLeave}
                          className={`w-12 min-w-[48px] min-h-[48px] h-12 m-px rounded-md flex flex-col items-center justify-center transition-all relative select-none bg-gray-900 ${
                            isSelected
                              ? 'ring-2 ring-white scale-105 z-10'
                              : 'hover:scale-105 hover:z-10'
                          }`}
                        >
                          {/* Stacked bar background */}
                          {segments.length > 0 && (
                            <div className="absolute inset-0 flex overflow-hidden rounded-md">
                              {segments.map((seg) => (
                                <div
                                  key={seg.action}
                                  className="h-full"
                                  style={{
                                    width: `${seg.freq * 100}%`,
                                    backgroundColor: getActionColor(seg.action),
                                  }}
                                />
                              ))}
                            </div>
                          )}
                          {/* Hand notation */}
                          <span
                            className={`relative z-10 text-[11px] font-bold leading-none ${
                              foldOnly ? 'text-gray-600' : 'text-white/90'
                            }`}
                          >
                            {hand}
                          </span>
                        </button>
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
}

function DetailCard({ hand, entry, onClose }: DetailCardProps) {
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
            {entry ? getHandDescription(hand, entry) : t('range.notInRange')}
          </p>
        </div>

        {/* Right: action bars */}
        {entry ? (
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[90%] max-w-sm p-5"
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
