import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import { showToast } from '@/components/ui/Toast'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

const ACTION_COLORS: Record<string, string> = {
  raise: '#ef4444',
  '3bet': '#f97316',
  call: '#3b82f6',
  fold: '#0a0a0a',
}

const ACTIONS = ['fold', 'raise', 'call', '3bet'] as const
type Action = typeof ACTIONS[number]

const ACTION_I18N_KEYS: Record<Action, string> = {
  fold: 'action.fold',
  raise: 'action.raise',
  call: 'action.call',
  '3bet': 'action.threeBet',
}

const LS_KEY = 'gto-custom-ranges'
const TOTAL_COMBOS = 1326

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHandNotation(row: number, col: number): string {
  if (row === col) return RANKS[row] + RANKS[col]
  if (row < col) return RANKS[row] + RANKS[col] + 's'
  return RANKS[col] + RANKS[row] + 'o'
}

function getComboCount(hand: string): number {
  if (hand.length === 2) return 6
  if (hand.endsWith('s')) return 4
  return 12
}

interface SavedRange {
  name: string
  range: Record<string, string>
  createdAt: number
}

function loadSavedRanges(): SavedRange[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRanges(ranges: SavedRange[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(ranges))
}

function encodeRangeToHash(range: Record<string, string>): string {
  const filtered: Record<string, string> = {}
  for (const [hand, action] of Object.entries(range)) {
    if (action !== 'fold') filtered[hand] = action
  }
  try {
    return btoa(JSON.stringify(filtered))
  } catch {
    return ''
  }
}

function decodeRangeFromHash(hash: string): Record<string, string> | null {
  try {
    const decoded = JSON.parse(atob(hash))
    if (typeof decoded !== 'object' || decoded === null) return null
    const range: Record<string, string> = {}
    for (const [hand, action] of Object.entries(decoded)) {
      if (typeof action === 'string') range[hand] = action
    }
    return range
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RangeEditorPage() {
  const { t } = useI18n()
  const matrixRef = useRef<HTMLDivElement>(null)

  const [rangeMap, setRangeMap] = useState<Record<string, string>>({})
  const [selectedAction, setSelectedAction] = useState<Action>('raise')
  const [rangeName, setRangeName] = useState('')
  const [savedRanges, setSavedRanges] = useState<SavedRange[]>(loadSavedRanges)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ row: number; col: number } | null>(null)

  // Load range from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      const decoded = decodeRangeFromHash(hash)
      if (decoded) {
        setRangeMap(decoded)
      }
    }
  }, [])

  // Calculate range stats
  const rangeStats = useMemo(() => {
    let totalCombos = 0
    const actionCombos: Record<string, number> = {}

    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 13; col++) {
        const hand = getHandNotation(row, col)
        const action = rangeMap[hand] ?? 'fold'
        const combos = getComboCount(hand)
        if (action !== 'fold') {
          totalCombos += combos
          actionCombos[action] = (actionCombos[action] ?? 0) + combos
        }
      }
    }

    return { totalCombos, actionCombos, percentage: (totalCombos / TOTAL_COMBOS) * 100 }
  }, [rangeMap])

  // Determine if a cell is in the drag selection rectangle
  const isInDragRect = useCallback(
    (row: number, col: number) => {
      if (!dragStart || !dragEnd) return false
      const minRow = Math.min(dragStart.row, dragEnd.row)
      const maxRow = Math.max(dragStart.row, dragEnd.row)
      const minCol = Math.min(dragStart.col, dragEnd.col)
      const maxCol = Math.max(dragStart.col, dragEnd.col)
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
    },
    [dragStart, dragEnd],
  )

  // Apply action to a hand
  const applyAction = useCallback(
    (hand: string) => {
      setRangeMap((prev) => {
        const current = prev[hand] ?? 'fold'
        const next: Record<string, string> = { ...prev }
        if (selectedAction === current) {
          // Toggle off
          delete next[hand]
        } else {
          next[hand] = selectedAction
        }
        return next
      })
    },
    [selectedAction],
  )

  // Apply action to a rectangle of cells
  const applyToDragRect = useCallback(() => {
    if (!dragStart || !dragEnd) return
    const minRow = Math.min(dragStart.row, dragEnd.row)
    const maxRow = Math.max(dragStart.row, dragEnd.row)
    const minCol = Math.min(dragStart.col, dragEnd.col)
    const maxCol = Math.max(dragStart.col, dragEnd.col)

    setRangeMap((prev) => {
      const next = { ...prev }
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const hand = getHandNotation(row, col)
          next[hand] = selectedAction
        }
      }
      return next
    })
  }, [dragStart, dragEnd, selectedAction])

  // Mouse event handlers for drag
  const handleMouseDown = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      setDragStart({ row, col })
      setDragEnd({ row, col })
    },
    [],
  )

  const handleMouseMove = useCallback(
    (row: number, col: number) => {
      if (!isDragging) return
      setDragEnd({ row, col })
    },
    [isDragging],
  )

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragStart && dragEnd) {
      // If single cell, toggle action; if rectangle, apply to all
      if (dragStart.row === dragEnd.row && dragStart.col === dragEnd.col) {
        const hand = getHandNotation(dragStart.row, dragStart.col)
        applyAction(hand)
      } else {
        applyToDragRect()
      }
    }
    setDragStart(null)
    setDragEnd(null)
    setIsDragging(false)
  }, [isDragging, dragStart, dragEnd, applyAction, applyToDragRect])

  useEffect(() => {
    if (!isDragging) return
    const up = () => handleMouseUp()
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [isDragging, handleMouseUp])

  // Reset range
  const handleReset = () => {
    setRangeMap({})
  }

  // Save range
  const handleSave = () => {
    if (!rangeName.trim()) {
      showToast('请输入范围名称', 'error')
      return
    }
    const ranges = [...savedRanges]
    const existing = ranges.findIndex((r) => r.name === rangeName.trim())
    const newRange: SavedRange = {
      name: rangeName.trim(),
      range: { ...rangeMap },
      createdAt: Date.now(),
    }
    if (existing >= 0) {
      ranges[existing] = newRange
    } else {
      ranges.push(newRange)
    }
    saveRanges(ranges)
    setSavedRanges(ranges)
    setShowSaveModal(false)
    setRangeName('')
    showToast('范围已保存', 'success')
  }

  // Load range
  const handleLoad = (saved: SavedRange) => {
    setRangeMap({ ...saved.range })
    setShowLoadModal(false)
  }

  // Delete saved range
  const handleDeleteSaved = (index: number) => {
    const ranges = [...savedRanges]
    ranges.splice(index, 1)
    saveRanges(ranges)
    setSavedRanges(ranges)
  }

  // Export as JSON
  const handleExport = () => {
    const data = JSON.stringify(rangeMap, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'range.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Share URL
  const handleShare = () => {
    const hash = encodeRangeToHash(rangeMap)
    if (!hash) {
      showToast('无法编码范围', 'error')
      return
    }
    const url = `${window.location.origin}${window.location.pathname}#${hash}`
    navigator.clipboard.writeText(url).then(
      () => showToast('链接已复制到剪贴板', 'success'),
      () => {
        window.location.hash = hash
        showToast('URL已更新，请手动复制', 'success')
      },
    )
  }

  // Clear range from URL on range change (keep URL clean)
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    // We only want to do this once on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      {/* Sidebar / controls */}
      <aside className="lg:w-72 flex-shrink-0 bg-gray-950 border-b lg:border-b-0 lg:border-r border-gray-800 p-4 lg:p-6 lg:overflow-y-auto">
        <h1 className="text-xl font-bold text-white mb-4">{t('rangeEditor.title')}</h1>

        {/* Action selector */}
        <div className="mb-6">
          <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">
            {t('rangeEditor.action')}
          </h3>
          <div className="grid grid-cols-4 lg:grid-cols-2 gap-2">
            {ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => setSelectedAction(action)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedAction === action
                    ? 'ring-2 ring-white text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                style={{
                  backgroundColor:
                    selectedAction === action
                      ? ACTION_COLORS[action] + 'cc'
                      : ACTION_COLORS[action] + '44',
                }}
              >
                {t(ACTION_I18N_KEYS[action])}
              </button>
            ))}
          </div>
        </div>

        {/* Range stats */}
        <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
            {t('rangeEditor.rangeStats')}
          </h3>
          <div className="text-2xl font-bold text-white mb-1">
            {rangeStats.percentage.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-400">
            {t('rangeEditor.combos')}: {rangeStats.totalCombos}/{TOTAL_COMBOS}
          </div>

          {/* Action breakdown */}
          <div className="mt-3 space-y-1.5">
            {ACTIONS.filter((a) => a !== 'fold').map((action) => {
              const count = rangeStats.actionCombos[action] ?? 0
              if (count === 0) return null
              return (
                <div key={action} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: ACTION_COLORS[action] }}
                  />
                  <span className="text-xs text-gray-400">
                    {t(ACTION_I18N_KEYS[action])}
                  </span>
                  <span className="text-xs text-white font-mono ml-auto">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              {t('rangeEditor.save')}
            </button>
            <button
              onClick={() => setShowLoadModal(true)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >
              {t('rangeEditor.load')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShare}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
            >
              {t('rangeEditor.share')}
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >
              {t('rangeEditor.export')}
            </button>
          </div>
          <button
            onClick={handleReset}
            className="w-full px-3 py-2 bg-gray-900 hover:bg-gray-800 text-red-400 text-sm rounded-lg transition-colors border border-gray-800"
          >
            {t('rangeEditor.reset')}
          </button>
        </div>
      </aside>

      {/* Main matrix area */}
      <main className="flex-1 p-4 md:p-6 overflow-auto flex flex-col items-center">
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
                  const action = rangeMap[hand] ?? 'fold'
                  const inDrag = isInDragRect(rowIdx, colIdx)
                  const color = ACTION_COLORS[action] ?? ACTION_COLORS.fold

                  return (
                    <div
                      key={hand}
                      onMouseDown={(e) => handleMouseDown(rowIdx, colIdx, e)}
                      onMouseMove={() => handleMouseMove(rowIdx, colIdx)}
                      className={`w-12 min-w-[48px] min-h-[48px] h-12 m-px rounded-md flex items-center justify-center transition-all relative select-none cursor-pointer border ${
                        inDrag
                          ? 'border-white/60 ring-1 ring-white/40'
                          : 'border-gray-800/50 hover:border-gray-600'
                      }`}
                      style={{
                        backgroundColor: action === 'fold' ? '#0a0a0a' : color + 'cc',
                      }}
                    >
                      <span
                        className={`text-[10px] font-bold leading-none ${
                          action === 'fold' ? 'text-gray-600' : 'text-white/90'
                        }`}
                      >
                        {hand}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Save Modal */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              {t('rangeEditor.saveRange')}
            </h3>
            <input
              type="text"
              value={rangeName}
              onChange={(e) => setRangeName(e.target.value)}
              placeholder={t('rangeEditor.rangeNamePlaceholder')}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg mb-4 focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm"
              >
                {t('rangeEditor.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                {t('rangeEditor.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowLoadModal(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              {t('rangeEditor.loadRange')}
            </h3>
            {savedRanges.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('rangeEditor.noSavedRanges')}</p>
            ) : (
              <div className="space-y-2">
                {savedRanges.map((saved, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3"
                  >
                    <div>
                      <div className="text-white text-sm font-medium">{saved.name}</div>
                      <div className="text-gray-500 text-xs">
                        {new Date(saved.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoad(saved)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg"
                      >
                        {t('rangeEditor.loadRange')}
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(i)}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-red-700 text-gray-300 text-xs rounded-lg"
                      >
                        {t('rangeEditor.delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowLoadModal(false)}
              className="w-full mt-4 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm"
            >
              {t('rangeEditor.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
