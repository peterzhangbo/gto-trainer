import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Card, Rank, Suit, BoardTexture } from '@/types/poker'
import { classifyBoardTexture } from '@/lib/poker/board-texture'
import { RANKS, RANK_VALUES, SUIT_SYMBOLS, isRedSuit } from '@/lib/poker/cards'
import { createDeck, removeCards, dealCards, shuffleDeck, cardToString } from '@/lib/poker/cards'
import { Hand } from 'pokersolver'
import type { SolvedHand } from 'pokersolver'
import { useI18n } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextureMetrics {
  wetness: number
  highCards: number
  connectivity: number
  suitDistribution: 'rainbow' | 'two-tone' | 'monotone'
  paired: boolean
}

interface CbetRecommendation {
  frequency: number
  sizing: string
  explanation: string
}

// ---------------------------------------------------------------------------

function randomBoard(): [Card, Card, Card] {
  const deck = shuffleDeck(createDeck())
  return [deck[0], deck[1], deck[2]]
}

function computeMetrics(board: [Card, Card, Card], texture: BoardTexture): TextureMetrics {
  const ranks = board.map((c) => RANK_VALUES[c.rank])
  const sorted = [...ranks].sort((a, b) => a - b)
  const spread = sorted[2] - sorted[0]

  // Wetness: based on connectivity + two-tone + high cards
  let wetness = 0
  if (spread <= 4) wetness += 40
  else if (spread <= 6) wetness += 20
  else wetness += 5

  if (texture.twoTone) wetness += 25
  if (texture.monotone) wetness += 45
  if (texture.paired) wetness += 10
  if (texture.highCard) wetness += 15
  wetness = Math.min(100, wetness)

  const highCards = ranks.filter((r) => r >= 10).length

  // Connectivity: 0-100
  let connectivity: number
  if (spread <= 2) connectivity = 90
  else if (spread <= 4) connectivity = 70
  else if (spread <= 6) connectivity = 45
  else connectivity = 15

  const suitSet = new Set(board.map((c) => c.suit))
  const suitDistribution: TextureMetrics['suitDistribution'] =
    suitSet.size === 1 ? 'monotone' : suitSet.size === 2 ? 'two-tone' : 'rainbow'

  return { wetness, highCards, connectivity, suitDistribution, paired: texture.paired }
}

function getCbetRecommendation(texture: BoardTexture, metrics: TextureMetrics): CbetRecommendation {
  if (texture.monotone) {
    return {
      frequency: 55,
      sizing: '66% pot',
      explanation: '同花牌面：持续下注频率适中（约55%）。使用中等尺度（66%），因为你的范围中包含同花组合。对手有较多听牌需要保护，但你也需要保护过牌范围。',
    }
  }
  if (texture.paired && texture.highCard) {
    return {
      frequency: 75,
      sizing: '33% pot',
      explanation: '配对高牌面：高频小注持续下注（75%频率，33%底池）。对手很难击中这个牌面，你的范围拥有巨大优势。小注施压同时控制底池。',
    }
  }
  if (texture.connected && texture.twoTone) {
    return {
      frequency: 50,
      sizing: '75% pot',
      explanation: '湿润连接面：中等频率大注（50%频率，75%底池）。牌面有大量听牌可能，需要用大注保护你的价值牌。选择性极高地进行下注，保护范围要平衡。',
    }
  }
  if (texture.connected && !texture.twoTone) {
    return {
      frequency: 55,
      sizing: '66% pot',
      explanation: '连接彩虹面：中频中注（55%频率，66%底池）。连接牌面但没有同花听牌降低了威胁程度。你仍需要保护手牌免受顺子听牌。',
    }
  }
  if (metrics.wetness > 40) {
    return {
      frequency: 60,
      sizing: '50% pot',
      explanation: '中等湿面：中频中注（60%频率，50%底池）。牌面有一定听牌可能，适度频率下注。保持范围平衡，混合价值牌和诈唬。',
    }
  }
  // Default dry board
  return {
    frequency: 70,
    sizing: '33% pot',
    explanation: '干燥牌面：高频小注持续下注（70%频率，33%底池）。对手很难击中这个牌面，你的范围优势巨大。小注足以从弱牌获取价值，大注浪费筹码。',
  }
}

function quickEquity(heroCards: Card[], board: Card[], numSims: number = 400): number {
  let wins = 0
  let ties = 0
  const known = [...heroCards, ...board]
  for (let i = 0; i < numSims; i++) {
    let deck = shuffleDeck(createDeck())
    deck = removeCards(deck, known)
    const { cards: villainCards } = dealCards(deck, 2)
    deck = removeCards(deck, villainCards)
    const cardsNeeded = 5 - board.length
    const { cards: extraBoard } = dealCards(deck, cardsNeeded)
    const fullBoard = [...board, ...extraBoard]
    const heroStr = [...heroCards, ...fullBoard].map(cardToString)
    const villainStr = [...villainCards, ...fullBoard].map(cardToString)
    const heroHand: SolvedHand = Hand.solve(heroStr)
    const villainHand: SolvedHand = Hand.solve(villainStr)
    const winners = Hand.winners([heroHand, villainHand])
    if (winners.length === 2) ties++
    else if (winners[0] === heroHand) wins++
  }
  return (wins + ties / 2) / numSims
}

function notationToCards(hand: string): [Card, Card] {
  const rank1 = hand[0] as Rank
  const rank2 = hand[1] as Rank
  if (hand.length === 2) {
    // pair
    return [
      { rank: rank1, suit: 's' as Suit },
      { rank: rank2, suit: 'h' as Suit },
    ]
  }
  if (hand[2] === 's') {
    return [
      { rank: rank1, suit: 's' as Suit },
      { rank: rank2, suit: 's' as Suit },
    ]
  }
  return [
    { rank: rank1, suit: 's' as Suit },
    { rank: rank2, suit: 'h' as Suit },
  ]
}

function equityColor(equity: number): string {
  if (equity >= 0.65) return 'bg-emerald-600'
  if (equity >= 0.55) return 'bg-emerald-700'
  if (equity >= 0.48) return 'bg-gray-600'
  if (equity >= 0.40) return 'bg-red-800'
  return 'bg-red-900'
}

function equityTextColor(equity: number): string {
  if (equity >= 0.48) return 'text-white'
  return 'text-gray-400'
}

function barColor(wetness: number): string {
  if (wetness >= 70) return 'bg-blue-500'
  if (wetness >= 40) return 'bg-blue-700'
  return 'bg-gray-500'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BoardTexturePage() {
  const { t } = useI18n()
  const [board, setBoard] = useState<[Card, Card, Card]>(() => randomBoard())
  const [equityMap, setEquityMap] = useState<Map<string, number>>(new Map())
  const [calculating, setCalculating] = useState(false)
  const [progress, setProgress] = useState(0)
  const cancelRef = useRef(false)

  const texture = useMemo(() => classifyBoardTexture(board), [board])
  const metrics = useMemo(() => computeMetrics(board, texture), [board, texture])
  const cbet = useMemo(() => getCbetRecommendation(texture, metrics), [texture, metrics])

  const regenerateBoard = useCallback(() => {
    cancelRef.current = true
    setBoard(randomBoard())
    setEquityMap(new Map())
    setProgress(0)
  }, [])

  // Calculate equity matrix
  useEffect(() => {
    cancelRef.current = false

    const hands: string[] = []
    for (let i = 0; i < 13; i++) {
      for (let j = 0; j < 13; j++) {
        const r1 = RANKS[i]
        const r2 = RANKS[j]
        if (i === j) hands.push(`${r1}${r2}`)
        else if (i < j) hands.push(`${r1}${r2}s`)
        else hands.push(`${r2}${r1}o`)
      }
    }

    const boardCards = [...board]
    const newMap = new Map<string, number>()
    let idx = 0
    let started = false

    function processBatch() {
      if (cancelRef.current) return
      if (!started) {
        started = true
        setCalculating(true)
        setProgress(0)
      }
      const batchSize = 5
      const end = Math.min(idx + batchSize, hands.length)
      for (; idx < end; idx++) {
        const hand = hands[idx]
        const [c1, c2] = notationToCards(hand)
        const eq = quickEquity([c1, c2], boardCards, 300)
        newMap.set(hand, eq)
      }
      setProgress(Math.round((idx / hands.length) * 100))
      setEquityMap(new Map(newMap))

      if (idx < hands.length) {
        requestAnimationFrame(processBatch)
      } else {
        setCalculating(false)
      }
    }

    requestAnimationFrame(processBatch)

    return () => {
      cancelRef.current = true
    }
  }, [board])

  // Category equity summary
  const categoryEquity = useMemo(() => {
    const categories = [
      { name: '超对 Overpair', hands: ['AA', 'KK', 'QQ', 'JJ', 'TT'] },
      { name: '顶对 Top Pair', hands: ['AKo', 'AQo', 'AJo', 'KQo', 'KJo'] },
      { name: '中对 Middle Pair', hands: ['A9o', 'K9o', 'Q9o', 'T9o', '99'] },
      { name: '同花听牌 Flush Draw', hands: ['AKs', 'AQs', 'AJs', 'KQs', 'KJs'] },
      { name: '顺子听牌 Straight Draw', hands: ['JTs', 'T9s', '98s', '87s', '76s'] },
      { name: '口袋对子 Pocket Pair', hands: ['22', '33', '44', '55', '66'] },
    ]

    return categories.map((cat) => {
      const equities = cat.hands
        .map((h) => equityMap.get(h))
        .filter((e): e is number => e !== undefined)
      const avg = equities.length > 0 ? equities.reduce((a, b) => a + b, 0) / equities.length : 0
      return { name: cat.name, equity: avg, count: equities.length }
    })
  }, [equityMap])

  const textureLabel = useMemo(() => {
    const labels: Record<BoardTexture['label'], string> = {
      monotone: '同花面 Monotone',
      'paired-high': '配对高牌面 Paired High',
      'connected-two-tone': '湿润连接面 Connected Two-Tone',
      wet: '湿润面 Wet',
      dry: '干燥面 Dry',
      'semi-connected': '半连接面 Semi-Connected',
    }
    return labels[texture.label] ?? texture.label
  }, [texture.label])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Board Texture Analysis</h1>
            <p className="text-gray-400 text-sm mt-1">牌面纹理深度分析工具</p>
          </div>
          <button
            onClick={regenerateBoard}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('chain.newHand')}
          </button>
        </div>

        {/* Board Display */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="flex gap-3">
              {board.map((card, i) => (
                <div
                  key={i}
                  className="w-20 h-28 bg-gray-800 border-2 border-gray-600 rounded-xl flex flex-col items-center justify-center shadow-lg"
                >
                  <span className={`text-3xl font-bold ${isRedSuit(card.suit) ? 'text-red-400' : 'text-white'}`}>
                    {card.rank}
                  </span>
                  <span className={`text-2xl ${isRedSuit(card.suit) ? 'text-red-400' : 'text-white'}`}>
                    {SUIT_SYMBOLS[card.suit]}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-gray-400">牌面分类:</span>
                <span className="px-3 py-1 bg-red-600/20 text-red-400 rounded-full text-sm font-medium border border-red-600/30">
                  {textureLabel}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {texture.paired && (
                  <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded text-xs">配对 Paired</span>
                )}
                {texture.monotone && (
                  <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs">同花 Monotone</span>
                )}
                {texture.twoTone && !texture.monotone && (
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">两色 Two-Tone</span>
                )}
                {!texture.twoTone && !texture.monotone && (
                  <span className="px-2 py-1 bg-gray-600/20 text-gray-400 rounded text-xs">彩虹 Rainbow</span>
                )}
                {texture.connected && (
                  <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">连接 Connected</span>
                )}
                {texture.highCard && (
                  <span className="px-2 py-1 bg-orange-600/20 text-orange-400 rounded text-xs">高牌 High Card</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Texture Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">牌面属性 Texture Properties</h2>

            <div className="space-y-4">
              {/* Wetness */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">湿润度 Wetness</span>
                  <span className="text-white font-mono">{metrics.wetness}/100</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor(metrics.wetness)}`}
                    style={{ width: `${metrics.wetness}%` }}
                  />
                </div>
              </div>

              {/* Connectivity */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">连接度 Connectivity</span>
                  <span className="text-white font-mono">{metrics.connectivity}/100</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.connectivity}%` }}
                  />
                </div>
              </div>

              {/* High Cards */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">高牌数 Broadway Cards (T+)</span>
                  <span className="text-white font-mono">{metrics.highCards} / 3</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${(metrics.highCards / 3) * 100}%` }}
                  />
                </div>
              </div>

              {/* Suit Distribution */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">花色分布 Suit Distribution</span>
                  <span className="text-white font-mono">
                    {metrics.suitDistribution === 'monotone'
                      ? '同花 Monotone'
                      : metrics.suitDistribution === 'two-tone'
                        ? '两色 Two-Tone'
                        : '彩虹 Rainbow'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* C-Bet Recommendation */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">C-Bet 策略建议 Strategy</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-400">{cbet.frequency}%</div>
                <div className="text-xs text-gray-400 mt-1">下注频率 C-Bet Freq</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{cbet.sizing}</div>
                <div className="text-xs text-gray-400 mt-1">推荐尺度 Sizing</div>
              </div>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">{cbet.explanation}</p>

            <div className="mt-4 pt-4 border-t border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-2">多人底池调整 Multi-Way Adjustments</h3>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• 降低诈唬频率（需要更强牌继续）</li>
                <li>• 提高价值下注阈值</li>
                <li>• 同花连牌隐含赔率更好</li>
                <li>• 非同花大牌价值降低</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Category Equity Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">各类手牌胜率 Hand Category Equity</h2>
          {calculating && (
            <div className="mb-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{progress}%</span>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {categoryEquity.map((cat) => (
              <div
                key={cat.name}
                className={`bg-gray-800 rounded-lg p-3 text-center border ${
                  cat.equity >= 0.55
                    ? 'border-emerald-600/30'
                    : cat.equity >= 0.45
                      ? 'border-gray-700'
                      : 'border-red-800/30'
                }`}
              >
                <div
                  className={`text-2xl font-bold ${
                    cat.equity >= 0.55
                      ? 'text-emerald-400'
                      : cat.equity >= 0.45
                        ? 'text-gray-300'
                        : 'text-red-400'
                  }`}
                >
                  {cat.count > 0 ? `${(cat.equity * 100).toFixed(1)}%` : '--'}
                </div>
                <div className="text-xs text-gray-400 mt-1 leading-tight">{cat.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 13x13 Equity Matrix */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              13x13 胜率矩阵 Equity Matrix
              {calculating && <span className="text-sm text-gray-400 ml-2">计算中...</span>}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-4 h-4 bg-red-900 rounded" />
              <span>&lt;40%</span>
              <span className="w-4 h-4 bg-gray-600 rounded" />
              <span>~50%</span>
              <span className="w-4 h-4 bg-emerald-600 rounded" />
              <span>&gt;55%</span>
            </div>
          </div>

          <div className="inline-block min-w-[520px]">
            {/* Column headers */}
            <div className="flex">
              <div className="w-10 h-10 flex-shrink-0" />
              {RANKS.map((r) => (
                <div key={r} className="w-10 h-10 flex items-center justify-center text-xs text-gray-500 font-mono">
                  {r}
                </div>
              ))}
            </div>

            {RANKS.map((rowRank, ri) => (
              <div key={rowRank} className="flex">
                <div className="w-10 h-10 flex items-center justify-center text-xs text-gray-500 font-mono flex-shrink-0">
                  {rowRank}
                </div>
                {RANKS.map((colRank, ci) => {
                  let hand: string
                  let type: 'pair' | 'suited' | 'offsuit'
                  if (ri === ci) {
                    hand = `${rowRank}${colRank}`
                    type = 'pair'
                  } else if (ri < ci) {
                    hand = `${rowRank}${colRank}s`
                    type = 'suited'
                  } else {
                    hand = `${colRank}${rowRank}o`
                    type = 'offsuit'
                  }

                  const eq = equityMap.get(hand)
                  const bg = eq !== undefined ? equityColor(eq) : 'bg-gray-800'
                  const textColor = eq !== undefined ? equityTextColor(eq) : 'text-gray-600'

                  return (
                    <div
                      key={`${ri}-${ci}`}
                      className={`w-10 h-10 flex flex-col items-center justify-center ${bg} border border-gray-900/50 text-[9px] font-mono ${textColor} cursor-default`}
                      title={`${hand} (${type}): ${eq !== undefined ? `${(eq * 100).toFixed(1)}%` : 'calculating...'}`}
                    >
                      <span className="font-bold leading-none">{hand.slice(0, 2)}</span>
                      {eq !== undefined && (
                        <span className="leading-none opacity-80">{(eq * 100).toFixed(0)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Educational Notes */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">学习笔记 Educational Notes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-blue-400 mb-2">什么是湿润牌面？ What is a Wet Board?</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                湿润牌面有大量可能的听牌（顺子、同花）。这类牌面要求防守方有更强的手牌才能继续。
                翻前加注者的C-bet频率通常降低，但使用更大的下注尺度来保护强牌。
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-400 mb-2">什么是干燥牌面？ What is a Dry Board?</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                干燥牌面几乎没有听牌。这类牌面允许翻前加注者高频小注C-bet，因为对手范围中很少击中该牌面。
                过牌范围中保留一些强牌以保护过牌范围。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
