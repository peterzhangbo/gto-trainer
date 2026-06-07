import { useState, useCallback, useMemo } from 'react'
import type { Card } from '@/types/poker'
import CardSelector from '@/components/poker/CardSelector'
import EquityDisplay from '@/components/poker/EquityDisplay'
import { useEquity } from '@/hooks/useEquity'
import { useRangeEquity } from '@/hooks/useRangeEquity'
import { useI18n } from '@/lib/i18n'
import {
  DATA_REGISTRY,
} from '@/data/index'
import {
  extractRangeFromScenario,
} from '@/hooks/useRangeEquity'
import {
  type RangeMap,
  inRangeSet,
  getComboCount,
} from '@/lib/poker/range-equity'

// ---------------------------------------------------------------------------
// Scenario preset data
// ---------------------------------------------------------------------------

const PREFLOP_SCENARIO_IDS = Object.keys(DATA_REGISTRY).filter(
  id => !['cbet', 'turn', 'river'].some(prefix => id.startsWith(prefix)),
)

function scenarioLabel(id: string, t: (key: string) => string): string {
  const parts = id.split('_')
  const type = parts[0]
  if (type === 'rfi') {
    return `${parts[1]?.toUpperCase()} ${t('action.raise')}`
  }
  if (type === 'threebet') {
    return `${parts[1]?.toUpperCase()} ${t('action.threeBet')} vs ${parts[3]?.toUpperCase()}`
  }
  if (type === 'defend') {
    return `${t('scenario.defend')} ${parts[2]?.toUpperCase()} vs ${parts[4]?.toUpperCase()}`
  }
  return id
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MiniRangeMatrix({ range, label }: { range: RangeMap; label: string }) {
  const { t } = useI18n()
  const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
  const inRange = inRangeSet(range)
  const comboTotal = [...inRange].reduce((sum, n) => sum + getComboCount(n), 0)

  return (
    <div className="min-w-0">
      <div className="text-xs text-gray-400 mb-1 truncate">{label}</div>
      <div
        className="grid gap-[1px] mx-auto"
        style={{
          gridTemplateColumns: 'repeat(13, minmax(0, 1fr))',
          maxWidth: '280px',
        }}
      >
        {RANKS.flatMap((r1, i) =>
          RANKS.map((r2, j) => {
            const isPair = i === j
            const isSuited = i < j
            let notation: string
            if (isPair) notation = `${r1}${r2}`
            else if (isSuited) notation = `${r1}${r2}s`
            else notation = `${r2}${r1}o`

            const inR = inRange.has(notation)

            let bg = 'bg-gray-900'
            if (inR && isPair) bg = 'bg-emerald-600'
            else if (inR && isSuited) bg = 'bg-emerald-500'
            else if (inR) bg = 'bg-emerald-400'

            return (
              <div
                key={`${i}-${j}`}
                className={`${bg} text-white text-[6px] leading-[8px] flex items-center justify-center h-[12px] w-full select-none`}
                title={notation}
              >
                {r1}{r2}
              </div>
            )
          }),
        )}
      </div>
      <div className="text-[10px] text-gray-500 mt-1 text-center">
        {inRange.size} {t('range.hands')} / {comboTotal} {t('range.combos')}
      </div>
    </div>
  )
}

function RangeScenarioSelector({
  value,
  onChange,
  label,
  exclude,
  placeholder,
  t,
}: {
  value: string
  onChange: (val: string) => void
  label: string
  exclude?: string
  placeholder?: string
  t: (key: string) => string
}) {
  const heroIds = PREFLOP_SCENARIO_IDS.filter(id => !id.startsWith('defend_'))
  const villainDefendIds = PREFLOP_SCENARIO_IDS.filter(id => id.startsWith('defend_'))

  const [heroGroup, villainGroup] = useMemo(() => {
    const classify = (ids: string[], prefix: string) =>
      ids.filter(id => id.startsWith(prefix))
    return [
      { rfi: classify(heroIds, 'rfi_'), threebet: classify(heroIds, 'threebet_') },
      { defend: classify(villainDefendIds, 'defend_'), rfi: classify(villainDefendIds, 'rfi_'), threebet: classify(villainDefendIds, 'threebet_') },
    ]
  }, [heroIds, villainDefendIds])

  const renderOptGroup = (ids: string[], groupLabel: string) => {
    if (ids.length === 0) return null
    return (
      <optgroup key={groupLabel} label={groupLabel}>
        {ids.map(id => (
          <option key={id} value={id}>{scenarioLabel(id, t)}</option>
        ))}
      </optgroup>
    )
  }

  const heroOpts = (
    <>
      {renderOptGroup(heroGroup.rfi, t('scenario.rfi'))}
      {renderOptGroup(heroGroup.threebet, t('scenario.threebet'))}
    </>
  )

  const villainOpts = (
    <>
      {renderOptGroup(villainGroup.defend, t('scenario.defend'))}
      {renderOptGroup(villainGroup.rfi, t('scenario.rfi'))}
      {renderOptGroup(villainGroup.threebet, t('scenario.threebet'))}
    </>
  )

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full min-h-[44px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
      >
        <option value="">{placeholder ?? t('calc.selectRange')}</option>
        {exclude === 'hero' ? heroOpts : villainOpts}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EVCalculatorPage() {
  const { t } = useI18n()

  // Mode
  const [calcMode, setCalcMode] = useState<'hand' | 'range'>('hand')

  // Hand mode state
  const [heroCards, setHeroCards] = useState<Card[]>([])
  const [villainCards, setVillainCards] = useState<Card[]>([])
  const [boardCards, setBoardCards] = useState<Card[]>([])
  const [selectingFor, setSelectingFor] = useState<'hero' | 'villain' | 'board'>('hero')
  const [potSize, setPotSize] = useState(100)
  const [betToCall, setBetToCall] = useState(50)

  // Range mode state
  const [heroRangeId, setHeroRangeId] = useState('')
  const [villainRangeId, setVillainRangeId] = useState('')

  const { calculateEquity: calcHandEquity, result: handResult, calculating: handCalculating, reset: resetHand } = useEquity()
  const { calculateRangeEquity: calcRangeEq, result: rangeResult, calculating: rangeCalculating, progress: rangeProgress, reset: resetRange } = useRangeEquity()

  const heroRangeData = heroRangeId ? DATA_REGISTRY[heroRangeId] : null
  const villainRangeData = villainRangeId ? DATA_REGISTRY[villainRangeId] : null

  const allUsed = [...heroCards, ...villainCards, ...boardCards]

  const handleCardSelect = useCallback((card: Card) => {
    if (selectingFor === 'hero' && heroCards.length < 2) {
      setHeroCards([...heroCards, card])
    } else if (selectingFor === 'villain' && villainCards.length < 2) {
      setVillainCards([...villainCards, card])
    } else if (selectingFor === 'board' && boardCards.length < 5) {
      setBoardCards([...boardCards, card])
    }
  }, [selectingFor, heroCards, villainCards, boardCards])

  const evResult = useMemo(() => {
    if (calcMode === 'hand') {
      if (!handResult) return null
      const equity = handResult.heroEquity / 100
      const ev = equity * (potSize + betToCall) - (1 - equity) * betToCall
      return { heroEquity: handResult.heroEquity, ev }
    }
    if (!rangeResult) return null
    const equity = rangeResult.heroEquity / 100
    const ev = equity * (potSize + betToCall) - (1 - equity) * betToCall
    return { heroEquity: rangeResult.heroEquity, ev }
  }, [calcMode, handResult, rangeResult, potSize, betToCall])

  const reset = () => {
    setHeroCards([])
    setVillainCards([])
    setBoardCards([])
    setHeroRangeId('')
    setVillainRangeId('')
    resetHand()
    resetRange()
  }

  const handleCalculate = () => {
    if (calcMode === 'hand') {
      if (heroCards.length < 2 || villainCards.length < 2) return
      calcHandEquity(heroCards, villainCards, boardCards, 10000)
    } else {
      if (!heroRangeData || !villainRangeData) return
      const heroRange = extractRangeFromScenario(heroRangeData)
      const villainRange = extractRangeFromScenario(villainRangeData)
      calcRangeEq(heroRange, villainRange, boardCards, 1000)
    }
  }

  const potOdds = potSize > 0 ? (betToCall / (potSize + betToCall)) * 100 : 0

  const CATEGORY_LABELS: Record<string, string> = {
    overpair: t('calc.overpair'),
    topPair: t('calc.topPair'),
    twoPair: t('calc.twoPair'),
    set: t('calc.set'),
    straight: t('calc.straight'),
    flush: t('calc.flush'),
    fullHouse: t('calc.fullHouse'),
    quads: t('calc.quads'),
    straightFlush: t('calc.straightFlush'),
    other: t('calc.other'),
    middlePair: t('calc.middlePair'),
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header with mode toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t('calc.title')}</h1>
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setCalcMode('hand')}
              className={`min-h-[40px] px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                calcMode === 'hand'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('calc.handMode')}
            </button>
            <button
              onClick={() => setCalcMode('range')}
              className={`min-h-[40px] px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                calcMode === 'range'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('calc.rangeMode')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left column: card selection / range selection */}
          <div className="lg:col-span-2">
            {calcMode === 'hand' ? (
              /* ── Hand mode ─────────────────────────────────────────────── */
              <>
                <div className="flex flex-wrap gap-2 md:gap-3 mb-4">
                  {(['hero', 'villain', 'board'] as const).map((target) => {
                    const count = target === 'hero' ? heroCards.length : target === 'villain' ? villainCards.length : boardCards.length
                    const max = target === 'board' ? 5 : 2
                    const color = target === 'hero' ? 'blue' : target === 'villain' ? 'red' : 'green'
                    const label = target === 'hero' ? t('calc.hero') : target === 'villain' ? t('calc.villain') : t('calc.board')
                    return (
                      <button
                        key={target}
                        onClick={() => setSelectingFor(target)}
                        className={`min-h-[44px] px-3 md:px-4 py-2 rounded-lg font-semibold text-sm md:text-base transition-colors ${
                          selectingFor === target
                            ? `bg-${color}-600 text-white`
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {label} ({count}/{max})
                      </button>
                    )
                  })}
                </div>

                <CardSelector
                  selectedCards={selectingFor === 'hero' ? heroCards : selectingFor === 'villain' ? villainCards : boardCards}
                  onSelect={handleCardSelect}
                  excludeCards={allUsed}
                  maxSelectable={selectingFor === 'board' ? 5 : 2}
                />

                <div className="mt-4 flex gap-6 flex-wrap">
                  <SelectedCardsDisplay label={t('calc.hero')} color="text-blue-400" cards={heroCards} />
                  <SelectedCardsDisplay label={t('calc.villain')} color="text-red-400" cards={villainCards} />
                  {boardCards.length > 0 && <SelectedCardsDisplay label={t('calc.board')} color="text-green-400" cards={boardCards} />}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    onClick={handleCalculate}
                    disabled={heroCards.length < 2 || villainCards.length < 2 || handCalculating}
                    className="min-h-[44px] px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white rounded-lg font-semibold transition-colors w-full sm:w-auto"
                  >
                    {handCalculating ? t('calc.calculating') : t('calc.calculate')}
                  </button>
                  <button
                    onClick={reset}
                    className="min-h-[44px] px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors w-full sm:w-auto"
                  >
                    {t('calc.reset')}
                  </button>
                </div>
              </>
            ) : (
              /* ── Range mode ────────────────────────────────────────────── */
              <>
                {/* Range selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <RangeScenarioSelector
                    value={heroRangeId}
                    onChange={setHeroRangeId}
                    label={t('calc.heroRange')}
                    exclude="hero"
                    t={t}
                  />
                  <RangeScenarioSelector
                    value={villainRangeId}
                    onChange={setVillainRangeId}
                    label={t('calc.villainRange')}
                    exclude="villain"
                    t={t}
                  />
                </div>

                {/* Mini range matrices */}
                <div className="flex flex-wrap justify-center gap-6 mb-4">
                  {heroRangeData && (
                    <MiniRangeMatrix
                      range={extractRangeFromScenario(heroRangeData)}
                      label={t('calc.heroRange') + ': ' + (heroRangeId ? scenarioLabel(heroRangeId, t) : '')}
                    />
                  )}
                  {villainRangeData && (
                    <MiniRangeMatrix
                      range={extractRangeFromScenario(villainRangeData)}
                      label={t('calc.villainRange') + ': ' + (villainRangeId ? scenarioLabel(villainRangeId, t) : '')}
                    />
                  )}
                </div>

                {/* Board card selector for range mode */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2 md:gap-3 mb-3">
                    <button
                      onClick={() => setSelectingFor('board')}
                      className={`min-h-[44px] px-3 md:px-4 py-2 rounded-lg font-semibold text-sm md:text-base transition-colors bg-green-600 text-white`}
                    >
                      {t('calc.board')} ({boardCards.length}/5)
                    </button>
                  </div>
                  <CardSelector
                    selectedCards={boardCards}
                    onSelect={(card) => {
                      if (boardCards.length < 5) setBoardCards([...boardCards, card])
                    }}
                    excludeCards={boardCards}
                    maxSelectable={5}
                  />
                  {boardCards.length > 0 && (
                    <div className="mt-3">
                      <SelectedCardsDisplay label={t('calc.board')} color="text-green-400" cards={boardCards} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    onClick={handleCalculate}
                    disabled={!heroRangeId || !villainRangeId || rangeCalculating}
                    className="min-h-[44px] px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white rounded-lg font-semibold transition-colors w-full sm:w-auto"
                  >
                    {rangeCalculating ? t('calc.calculating') : t('calc.calculate')}
                  </button>
                  <button
                    onClick={reset}
                    className="min-h-[44px] px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors w-full sm:w-auto"
                  >
                    {t('calc.reset')}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right column: pot settings + results */}
          <div className="space-y-6">
            {/* Pot settings (shared by both modes) */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white">{t('calc.potSettings')}</h3>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('calc.potSize')}</label>
                <input
                  type="number"
                  value={potSize}
                  onChange={(e) => setPotSize(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('calc.betToCall')}</label>
                <input
                  type="number"
                  value={betToCall}
                  onChange={(e) => setBetToCall(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div className="text-sm text-gray-500">
                {t('calc.potOdds')}: {potOdds.toFixed(1)}%
              </div>
            </div>

            {/* Hand mode results */}
            {calcMode === 'hand' && handResult && evResult && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('calc.results')}</h3>
                <EquityDisplay
                  heroWins={handResult.heroWins}
                  villainWins={handResult.villainWins}
                  tie={handResult.tie}
                />
                <div>
                  <div className="text-sm text-gray-400 mb-1">{t('calc.ev')}</div>
                  <div className={`text-3xl font-bold ${evResult.ev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {evResult.ev >= 0 ? '+' : ''}{evResult.ev.toFixed(2)} BB
                  </div>
                </div>
                <div className="text-xs text-gray-600 bg-gray-800 rounded p-2 font-mono">
                  EV = ({evResult.heroEquity.toFixed(1)}% × {potSize + betToCall}) − ({(100 - evResult.heroEquity).toFixed(1)}% × {betToCall}) = {evResult.ev.toFixed(2)}
                </div>
              </div>
            )}

            {/* Range mode results */}
            {calcMode === 'range' && rangeResult && evResult && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('calc.results')}</h3>
                <div>
                  <div className="text-sm text-gray-400 mb-1">{t('calc.rangeEquity')}</div>
                  <div className="flex h-6 w-full overflow-hidden rounded">
                    <div
                      className="bg-green-600 transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${rangeResult.heroWins}%` }}
                    >
                      {rangeResult.heroWins > 10 && (
                        <span className="text-[10px] font-bold text-white">{rangeResult.heroWins.toFixed(1)}%</span>
                      )}
                    </div>
                    <div
                      className="bg-gray-500 transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${rangeResult.tie}%` }}
                    >
                      {rangeResult.tie > 8 && (
                        <span className="text-[10px] font-bold text-white">{rangeResult.tie.toFixed(1)}%</span>
                      )}
                    </div>
                    <div
                      className="bg-red-600 transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${rangeResult.villainWins}%` }}
                    >
                      {rangeResult.villainWins > 10 && (
                        <span className="text-[10px] font-bold text-white">{rangeResult.villainWins.toFixed(1)}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between mt-1 text-xs">
                    <span className="text-green-400 font-semibold">{t('equity.hero')} {rangeResult.heroWins.toFixed(1)}%</span>
                    {rangeResult.tie > 0 && <span className="text-gray-400 font-semibold">{t('equity.tie')} {rangeResult.tie.toFixed(1)}%</span>}
                    <span className="text-red-400 font-semibold">{t('equity.villain')} {rangeResult.villainWins.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Hand strength breakdown */}
                {Object.keys(rangeResult.handCategories).length > 0 && (
                  <div>
                    <div className="text-sm text-gray-400 mb-2">{t('calc.handStrength')}</div>
                    <div className="flex flex-wrap gap-1">
                      {['straightFlush', 'quads', 'fullHouse', 'flush', 'straight', 'set', 'twoPair', 'topPair', 'overpair', 'other']
                        .filter(cat => (rangeResult.handCategories[cat] ?? 0) > 0)
                        .map(cat => (
                          <span
                            key={cat}
                            className="inline-flex items-center bg-gray-800 rounded px-2 py-1 text-[11px] text-gray-300"
                          >
                            {CATEGORY_LABELS[cat] ?? cat}{' '}
                            <span className="ml-1 font-semibold text-white">
                              {rangeResult.handCategories[cat]!.toFixed(1)}%
                            </span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-400 mb-1">{t('calc.ev')}</div>
                  <div className={`text-3xl font-bold ${evResult.ev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {evResult.ev >= 0 ? '+' : ''}{evResult.ev.toFixed(2)} BB
                  </div>
                </div>
                <div className="text-xs text-gray-600 bg-gray-800 rounded p-2 font-mono">
                  EV = ({evResult.heroEquity.toFixed(1)}% × {potSize + betToCall}) − ({(100 - evResult.heroEquity).toFixed(1)}% × {betToCall}) = {evResult.ev.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Range mode progress bar */}
        {calcMode === 'range' && rangeCalculating && (
          <div className="mt-6 bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{t('calc.calculating')}</span>
              <span className="text-sm text-gray-500">
                {(rangeProgress * 100).toFixed(0)}% {t('calc.simsComplete')}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-200"
                style={{ width: `${rangeProgress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SelectedCardsDisplay({ label, color, cards }: { label: string; color: string; cards: Card[] }) {
  const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
  const SUIT_COLORS: Record<string, string> = { s: 'text-gray-900', h: 'text-red-600', d: 'text-red-600', c: 'text-gray-900' }
  const { t } = useI18n()

  return (
    <div>
      <span className={`text-sm font-semibold ${color}`}>{label}: </span>
      {cards.length === 0 ? (
        <span className="text-gray-600">{t('calc.unselected')}</span>
      ) : (
        cards.map((c, i) => (
          <span key={i} className="inline-block bg-white rounded px-2 py-1 mx-0.5 text-sm font-bold">
            <span className="text-gray-900">{c.rank}</span>
            <span className={SUIT_COLORS[c.suit]}>{SUIT_SYMBOLS[c.suit]}</span>
          </span>
        ))
      )}
    </div>
  )
}
