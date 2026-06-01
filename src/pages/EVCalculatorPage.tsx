import { useState, useCallback, useEffect } from 'react'
import type { Card } from '@/types/poker'
import CardSelector from '@/components/poker/CardSelector'
import EquityDisplay from '@/components/poker/EquityDisplay'
import { useEquity } from '@/hooks/useEquity'
import { useI18n } from '@/lib/i18n'

export default function EVCalculatorPage() {
  const { t } = useI18n()
  const [heroCards, setHeroCards] = useState<Card[]>([])
  const [villainCards, setVillainCards] = useState<Card[]>([])
  const [boardCards, setBoardCards] = useState<Card[]>([])
  const [selectingFor, setSelectingFor] = useState<'hero' | 'villain' | 'board'>('hero')
  const [potSize, setPotSize] = useState(100)
  const [betToCall, setBetToCall] = useState(50)
  const [evResult, setEvResult] = useState<{ heroEquity: number; ev: number } | null>(null)

  const { calculateEquity, result, calculating, reset: resetEquity } = useEquity()

  const allUsed = [...heroCards, ...villainCards, ...boardCards]

  const handleCardSelect = useCallback((card: Card) => {
    if (selectingFor === 'hero' && heroCards.length < 2) {
      setHeroCards([...heroCards, card])
    } else if (selectingFor === 'villain' && villainCards.length < 2) {
      setVillainCards([...villainCards, card])
    } else if (selectingFor === 'board' && boardCards.length < 5) {
      setBoardCards([...boardCards, card])
    }
    setEvResult(null)
  }, [selectingFor, heroCards, villainCards, boardCards])

  // Compute EV when equity result arrives
  useEffect(() => {
    if (result) {
      const equity = result.heroEquity / 100
      const ev = equity * (potSize + betToCall) - (1 - equity) * betToCall
      setEvResult({ heroEquity: result.heroEquity, ev })
    }
  }, [result, potSize, betToCall])

  const reset = () => {
    setHeroCards([])
    setVillainCards([])
    setBoardCards([])
    setEvResult(null)
    resetEquity()
  }

  const handleCalculate = () => {
    if (heroCards.length < 2 || villainCards.length < 2) return
    setEvResult(null)
    calculateEquity(heroCards, villainCards, boardCards, 10000)
  }

  const potOdds = potSize > 0 ? (betToCall / (potSize + betToCall)) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">{t('calc.title')}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Card selection */}
          <div className="lg:col-span-2">
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

            {/* Selected cards display */}
            <div className="mt-4 flex gap-6 flex-wrap">
              <SelectedCardsDisplay label={t('calc.hero')} color="text-blue-400" cards={heroCards} />
              <SelectedCardsDisplay label={t('calc.villain')} color="text-red-400" cards={villainCards} />
              {boardCards.length > 0 && <SelectedCardsDisplay label={t('calc.board')} color="text-green-400" cards={boardCards} />}
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={calculate}
                disabled={heroCards.length < 2 || villainCards.length < 2 || calculating}
                className="min-h-[44px] px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
              >
                {calculating ? t('calc.calculating') : t('calc.calculate')}
              </button>
              <button
                onClick={reset}
                className="min-h-[44px] px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              >
                {t('calc.reset')}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white">{t('calc.potSettings')}</h3>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('calc.potSize')}</label>
                <input
                  type="number"
                  value={potSize}
                  onChange={(e) => setPotSize(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('calc.betToCall')}</label>
                <input
                  type="number"
                  value={betToCall}
                  onChange={(e) => setBetToCall(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div className="text-sm text-gray-500">
                {t('calc.potOdds')}: {potOdds.toFixed(1)}%
              </div>
            </div>

            {result && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('calc.results')}</h3>
                <EquityDisplay
                  heroWins={result.heroWins}
                  villainWins={result.villainWins}
                  tie={result.tie}
                />
                <div>
                  <div className="text-sm text-gray-400 mb-1">{t('calc.ev')}</div>
                  <div className={`text-3xl font-bold ${result.ev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {result.ev >= 0 ? '+' : ''}{result.ev.toFixed(2)} BB
                  </div>
                </div>
                <div className="text-xs text-gray-600 bg-gray-800 rounded p-2 font-mono">
                  EV = ({result.heroEquity.toFixed(1)}% × {potSize + betToCall}) − ({(100 - result.heroEquity).toFixed(1)}% × {betToCall}) = {result.ev.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>
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
