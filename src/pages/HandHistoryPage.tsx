import { useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ParsedAction {
  player: string
  action: 'fold' | 'check' | 'call' | 'raise' | 'bet' | 'uncalled'
  amount?: number
  street: string
}

interface ParsedHand {
  id: string
  date: string
  stakes: string
  players: { seat: number; name: string; stack: number }[]
  blinds: { player: string; amount: number }[]
  heroCards: string[]
  board: string[]
  actions: ParsedAction[]
  pot: number
  winners: { player: string; amount: number; hand?: string }[]
}

interface AnalysisResult {
  hands: ParsedHand[]
  stats: {
    vpip: number
    pfr: number
    af: number
    wsd: number
  }
  gtoScore: number
  totalHands: number
  totalMistakes: number
}

/* ------------------------------------------------------------------ */
/* PokerStars Hand History Parser                                      */
/* ------------------------------------------------------------------ */

function parseHandHistory(text: string): ParsedHand[] {
  const handBlocks = text.split(/(?=PokerStars Hand #)/).filter((b) => b.trim().length > 0)
  const hands: ParsedHand[] = []

  for (const block of handBlocks) {
    try {
      const hand = parseSingleHand(block)
      if (hand) hands.push(hand)
    } catch {
      // skip unparseable hands
    }
  }

  return hands
}

function parseSingleHand(block: string): ParsedHand | null {
  // Header
  const headerMatch = block.match(/PokerStars Hand #(\d+):.*?\((\$[\d.]+\/\$[\d.]+)\).*?(\d{4}\/\d{2}\/\d{2})/s)
  if (!headerMatch) return null

  const id = headerMatch[1]
  const stakes = headerMatch[2]
  const date = headerMatch[3]

  // Players
  const players: ParsedHand['players'] = []
  const seatRe = /Seat (\d+): (.+?) \((\$[\d.]+) in chips\)/g
  let m: RegExpExecArray | null
  while ((m = seatRe.exec(block)) !== null) {
    players.push({ seat: parseInt(m[1]), name: m[2].trim(), stack: parseFloat(m[3].slice(1)) })
  }
  if (players.length === 0) return null

  // Blinds
  const blinds: ParsedHand['blinds'] = []
  const blindRe = /(.+?): posts (small blind|big blind) (\$[\d.]+)/g
  while ((m = blindRe.exec(block)) !== null) {
    blinds.push({ player: m[1].trim(), amount: parseFloat(m[3].slice(1)) })
  }

  // Hero cards
  const heroMatch = block.match(/\*\*\* HOLE CARDS \*\*\*\s*(?:Dealt to (.+?) )?\[([^\]]+)\]/)
  const heroCards = heroMatch ? heroMatch[2].split(' ') : []

  // Board
  const boardMatch = block.match(/\*\*\* FLOP \*\*\* \[([^\]]+)\]/)
  const turnMatch = block.match(/\*\*\* TURN \*\*\* \[[^\]]+\] \[([^\]]+)\]/)
  const riverMatch = block.match(/\*\*\* RIVER \*\*\* \[[^\]]+\] \[([^\]]+)\]/)
  const board: string[] = []
  if (boardMatch) board.push(...boardMatch[1].split(' '))
  if (turnMatch) board.push(turnMatch[1])
  if (riverMatch) board.push(riverMatch[1])

  // Actions
  const actions: ParsedAction[] = []
  const streets = block.split(/\*\*\* (?:HOLE CARDS|FLOP|TURN|RIVER|SHOW DOWN|SUMMARY)/)

  function parseStreetActions(streetText: string, streetName: string) {
    if (!streetText) return
    const lines = streetText.trim().split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      const actionMatch = trimmed.match(/^(.+?): (folds|checks|calls \$([\d.]+)|bets \$([\d.]+)|raises \$([\d.]+) to \$([\d.]+)|doesn't show hand|shows \[)/)
      if (actionMatch) {
        const player = actionMatch[1].trim()
        const actionText = actionMatch[2]
        let action: ParsedAction['action'] = 'fold'
        let amount: number | undefined

        if (actionText === 'folds') { action = 'fold' }
        else if (actionText === 'checks') { action = 'check' }
        else if (actionText.startsWith('calls')) { action = 'call'; amount = parseFloat(actionMatch[3]) }
        else if (actionText.startsWith('bets')) { action = 'bet'; amount = parseFloat(actionMatch[4]) }
        else if (actionText.startsWith('raises')) { action = 'raise'; amount = parseFloat(actionMatch[6]) }

        actions.push({ player, action, amount, street: streetName })
      }
    }
  }

  // Street indices: streets[0] = before hole cards, streets[1] = hole cards section, etc.
  const holeCardsIdx = streets.findIndex((s) => s.includes('Dealt to') || s.trim().length > 0)
  const flopIdx = block.includes('*** FLOP ***') ? Math.min(streets.length - 1, holeCardsIdx + 1) : -1
  const turnIdx = block.includes('*** TURN ***') ? flopIdx + 1 : -1
  const riverIdx = block.includes('*** RIVER ***') ? turnIdx + 1 : -1

  if (holeCardsIdx >= 0 && streets[holeCardsIdx + 1]) parseStreetActions(streets[holeCardsIdx + 1], 'preflop')
  if (flopIdx > 0 && streets[flopIdx + 1]) parseStreetActions(streets[flopIdx + 1], 'flop')
  if (turnIdx > 0 && streets[turnIdx + 1]) parseStreetActions(streets[turnIdx + 1], 'turn')
  if (riverIdx > 0 && streets[riverIdx + 1]) parseStreetActions(streets[riverIdx + 1], 'river')

  // Pot from summary
  const potMatch = block.match(/Total pot \$([\d.]+)/)
  const pot = potMatch ? parseFloat(potMatch[1]) : 0

  // Winners
  const winners: ParsedHand['winners'] = []
  const winnerRe = /(.+?) collected \$([\d.]+)/g
  while ((m = winnerRe.exec(block)) !== null) {
    winners.push({ player: m[1].trim(), amount: parseFloat(m[2]) })
  }

  return { id, date, stakes, players, blinds, heroCards, board, actions, pot, winners }
}

/* ------------------------------------------------------------------ */
/* GTO Analysis (simplified heuristic)                                 */
/* ------------------------------------------------------------------ */

function analyzeHands(hands: ParsedHand[]): AnalysisResult {
  let vpipCount = 0
  let pfrCount = 0
  let aggrActions = 0
  let passiveActions = 0
  let showdownsWon = 0
  let showdownsTotal = 0
  let totalMistakes = 0
  let totalScore = 0

  for (const hand of hands) {
    const heroActions = hand.actions.filter((a) => a.player === 'Hero')
    const preflopActions = heroActions.filter((a) => a.street === 'preflop')

    // VPIP: voluntarily put money in pot (not blinds)
    const isBlind = hand.blinds.some((b) => b.player === 'Hero')
    const voluntaryPreflop = preflopActions.some((a) => a.action === 'call' || a.action === 'raise' || a.action === 'bet')
    if (voluntaryPreflop || (!isBlind && preflopActions.some((a) => a.action === 'call'))) {
      vpipCount++
    }

    // PFR: preflop raise
    if (preflopActions.some((a) => a.action === 'raise' || a.action === 'bet')) {
      pfrCount++
    }

    // Aggression factor
    for (const a of heroActions) {
      if (a.action === 'raise' || a.action === 'bet') aggrActions++
      if (a.action === 'call' || a.action === 'check') passiveActions++
    }

    // W$SD
    const heroWon = hand.winners.some((w) => w.player === 'Hero')
    if (hand.board.length >= 3) {
      showdownsTotal++
      if (heroWon) showdownsWon++
    }

    // Simple GTO deviation scoring
    for (const a of heroActions) {
      let isDeviation = false
      if (a.street === 'preflop' && a.action === 'call') {
        // Calling preflop raises with weak holdings is generally a deviation
        isDeviation = true
        totalMistakes++
      }
      if (a.street !== 'preflop' && a.action === 'check' && aggrActions > 0) {
        // Some checks are fine, don't count all
      }
      if (!isDeviation) {
        totalScore += 10
      } else {
        totalScore += 3
      }
    }
  }

  const totalHands = hands.length
  const heroTotalActions = hands.reduce((sum, h) => sum + h.actions.filter((a) => a.player === 'Hero').length, 0)
  const maxScore = Math.max(heroTotalActions * 10, 1)
  const gtoScore = Math.round((totalScore / maxScore) * 100)

  return {
    hands,
    stats: {
      vpip: totalHands > 0 ? Math.round((vpipCount / totalHands) * 100) : 0,
      pfr: totalHands > 0 ? Math.round((pfrCount / totalHands) * 100) : 0,
      af: passiveActions > 0 ? parseFloat((aggrActions / passiveActions).toFixed(2)) : aggrActions > 0 ? 99 : 0,
      wsd: showdownsTotal > 0 ? Math.round((showdownsWon / showdownsTotal) * 100) : 0,
    },
    gtoScore,
    totalHands,
    totalMistakes,
  }
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'gto-hand-history'

function saveAnalysis(result: AnalysisResult) {
  const existing = loadSavedAnalyses()
  const entry = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    stats: result.stats,
    gtoScore: result.gtoScore,
    totalHands: result.totalHands,
    totalMistakes: result.totalMistakes,
    hands: result.hands.slice(0, 50), // limit stored hands
  }
  existing.unshift(entry)
  if (existing.length > 20) existing.length = 20
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
}

function loadSavedAnalyses(): { id: string; date: string; stats: AnalysisResult['stats']; gtoScore: number; totalHands: number; totalMistakes: number; hands: ParsedHand[] }[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* Card Display                                                        */
/* ------------------------------------------------------------------ */

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_COLORS: Record<string, string> = { s: 'text-gray-300', h: 'text-red-400', d: 'text-blue-400', c: 'text-green-400' }

function CardBadge({ card }: { card: string }) {
  if (card.length < 2) return <span className="font-mono text-sm">{card}</span>
  const rank = card[0]
  const suit = card[1].toLowerCase()
  return (
    <span className="inline-flex items-center justify-center w-8 h-10 rounded bg-white/10 border border-white/20 text-xs font-bold">
      <span className="text-white">{rank}</span>
      <span className={SUIT_COLORS[suit] || 'text-gray-300'}>{SUIT_SYMBOLS[suit] || suit}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function HandHistoryPage() {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [expandedHand, setExpandedHand] = useState<string | null>(null)
  const [savedAnalyses, setSavedAnalyses] = useState(loadSavedAnalyses)

  const handleAnalyze = useCallback(() => {
    setError('')
    if (!input.trim()) {
      setError('请粘贴手牌历史文本 / Please paste hand history text')
      return
    }

    const hands = parseHandHistory(input)
    if (hands.length === 0) {
      setError('未能解析出手牌，请检查格式是否为 PokerStars 格式 / No hands parsed. Check format.')
      return
    }

    const analysis = analyzeHands(hands)
    setResult(analysis)
    saveAnalysis(analysis)
    setSavedAnalyses(loadSavedAnalyses())
  }, [input])

  const handleLoadSample = useCallback(() => {
    const sample = `PokerStars Hand #123456789: Hold'em No Limit ($1/$2) - 2024/01/15 20:00:00 ET
Table 'Table 1' 6-max Seat #1 is the button
Seat 1: Hero ($200 in chips)
Seat 2: Villain1 ($185.50 in chips)
Seat 3: Villain2 ($220 in chips)
Hero: posts small blind $1
Villain1: posts big blind $2
*** HOLE CARDS ***
Dealt to Hero [As Kh]
Hero: raises $4 to $6
Villain1: folds
Villain2: calls $4
*** FLOP *** [Ac 7d 2s]
Hero: bets $8
Villain2: calls $8
*** TURN *** [Ac 7d 2s] [Kd]
Hero: bets $18
Villain2: folds
Uncalled bet ($18) returned to Hero
Hero collected $28.70 from pot
*** SUMMARY ***
Total pot $28.70 | Rake $0
Board [Ac 7d 2s Kd]
Seat 1: Hero (small blind) collected ($28.70)
Seat 2: Villain1 (big blind) folded before Flop
Seat 3: Villain2 folded on the Turn

PokerStars Hand #123456790: Hold'em No Limit ($1/$2) - 2024/01/15 20:05:00 ET
Table 'Table 1' 6-max Seat #2 is the button
Seat 1: Hero ($226.70 in chips)
Seat 2: Villain1 ($185.50 in chips)
Seat 3: Villain2 ($202 in chips)
Villain1: posts small blind $1
Villain2: posts big blind $2
*** HOLE CARDS ***
Dealt to Hero [9h 7h]
Hero: calls $2
Villain1: raises $8 to $10
Villain2: folds
Hero: folds
Uncalled bet ($8) returned to Villain1
Villain1 collected $5 from pot
*** SUMMARY ***
Total pot $5 | Rake $0
Seat 1: Hero folded before Flop
Seat 2: Villain1 (small blind) collected ($5)
Seat 3: Villain2 (big blind) folded before Flop

PokerStars Hand #123456791: Hold'em No Limit ($1/$2) - 2024/01/15 20:10:00 ET
Table 'Table 1' 6-max Seat #3 is the button
Seat 1: Hero ($224.70 in chips)
Seat 2: Villain1 ($188.50 in chips)
Seat 3: Villain2 ($200 in chips)
Villain2: posts small blind $1
Hero: posts big blind $2
*** HOLE CARDS ***
Dealt to Hero [Qd Qs]
Villain1: raises $5 to $7
Villain2: folds
Hero: raises $16 to $23
Villain1: calls $16
*** FLOP *** [Jh 8c 3d]
Hero: bets $28
Villain1: calls $28
*** TURN *** [Jh 8c 3d] [Tc]
Hero: bets $60
Villain1: folds
Uncalled bet ($60) returned to Hero
Hero collected $98 from pot
*** SUMMARY ***
Total pot $98 | Rake $0
Board [Jh 8c 3d Tc]
Seat 1: Hero (big blind) collected ($98)
Seat 2: Villain1 folded on the Turn
Seat 3: Villain2 (small blind) folded before Flop`
    setInput(sample)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {t('hh.title')}
        </h1>
        <p className="text-gray-400 mb-6 text-sm">{t('hh.subtitle')}</p>

        {/* Input Section */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-300">{t('hh.inputLabel')}</label>
            <button
              onClick={handleLoadSample}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              {t('hh.loadSample')}
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('hh.placeholder')}
            className="w-full h-48 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 font-mono resize-y focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600"
          />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <button
            onClick={handleAnalyze}
            className="mt-4 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
          >
            {t('hh.analyze')}
          </button>
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <StatCard label={t('hh.gtoScore')} value={`${result.gtoScore}%`} color={result.gtoScore >= 70 ? 'text-green-400' : result.gtoScore >= 50 ? 'text-yellow-400' : 'text-red-400'} />
              <StatCard label={t('hh.hands')} value={String(result.totalHands)} color="text-white" />
              <StatCard label="VPIP" value={`${result.stats.vpip}%`} color={result.stats.vpip >= 20 && result.stats.vpip <= 35 ? 'text-green-400' : 'text-yellow-400'} />
              <StatCard label="PFR" value={`${result.stats.pfr}%`} color={result.stats.pfr >= 15 && result.stats.pfr <= 28 ? 'text-green-400' : 'text-yellow-400'} />
              <StatCard label={t('hh.af')} value={String(result.stats.af)} color="text-blue-400" />
            </div>

            {/* Detailed Stats */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 md:p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">{t('hh.sessionStats')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatBar label="VPIP (自愿投入)" value={result.stats.vpip} ideal={[20, 35]} suffix="%" />
                <StatBar label="PFR (翻前加注率)" value={result.stats.pfr} ideal={[15, 28]} suffix="%" />
                <StatBar label={t('hh.wsd')} value={result.stats.wsd} ideal={[45, 65]} suffix="%" />
                <StatBar label={t('hh.mistakes')} value={result.totalMistakes} ideal={[0, result.totalHands]} />
              </div>
            </div>

            {/* Hand Details */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 md:p-6">
              <h2 className="text-lg font-semibold text-white mb-4">{t('hh.handDetails')}</h2>
              <div className="space-y-3">
                {result.hands.map((hand) => {
                  const isExpanded = expandedHand === hand.id
                  const heroActions = hand.actions.filter((a) => a.player === 'Hero')
                  const heroWon = hand.winners.some((w) => w.player === 'Hero')
                  return (
                    <div key={hand.id} className="border border-gray-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedHand(isExpanded ? null : hand.id)}
                        className="w-full p-3 flex items-center gap-3 text-left hover:bg-gray-800/50 transition-colors"
                      >
                        <span className="text-xs text-gray-500 font-mono">#{hand.id}</span>
                        <div className="flex gap-1">
                          {hand.heroCards.map((c, i) => <CardBadge key={i} card={c} />)}
                        </div>
                        <div className="flex-1" />
                        {hand.board.length > 0 && (
                          <div className="hidden sm:flex gap-1">
                            {hand.board.map((c, i) => <CardBadge key={i} card={c} />)}
                          </div>
                        )}
                        <span className={`text-sm font-medium ${heroWon ? 'text-green-400' : 'text-gray-500'}`}>
                          {heroWon ? `+$${hand.winners.find((w) => w.player === 'Hero')?.amount ?? 0}` : '-'}
                        </span>
                        <span className="text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-gray-800 p-3 space-y-2 text-sm">
                          <div className="text-gray-500 text-xs">{hand.date} | {hand.stakes}</div>
                          {heroActions.map((a, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-gray-500 text-xs w-14 capitalize">{a.street}</span>
                              <span className="text-white capitalize">{a.action}</span>
                              {a.amount !== undefined && <span className="text-gray-400">${a.amount}</span>}
                            </div>
                          ))}
                          {hand.winners.length > 0 && (
                            <div className="pt-2 border-t border-gray-800/50 text-xs text-gray-500">
                              {t('hh.pot')}: ${hand.pot}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Saved Analyses */}
        {savedAnalyses.length > 0 && !result && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">{t('hh.savedAnalyses')}</h2>
            <div className="space-y-2">
              {savedAnalyses.map((a) => (
                <div key={a.id} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-white text-sm">{new Date(a.date).toLocaleDateString()} {new Date(a.date).toLocaleTimeString()}</div>
                    <div className="text-gray-500 text-xs">{a.totalHands} {t('hh.hands')} | {a.totalMistakes} {t('hh.mistakes')}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${a.gtoScore >= 70 ? 'text-green-400' : a.gtoScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {a.gtoScore}%
                    </div>
                    <div className="text-xs text-gray-500">VPIP {a.stats.vpip}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

function StatBar({ label, value, ideal, suffix = '' }: { label: string; value: number; ideal: [number, number]; suffix?: string }) {
  const pct = Math.min(value, 100)
  const inRange = value >= ideal[0] && value <= ideal[1]
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className={inRange ? 'text-green-400' : 'text-yellow-400'}>{value}{suffix}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${inRange ? 'bg-green-500' : 'bg-yellow-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-gray-600 mt-0.5">
        {t_ideal(ideal)}{suffix}
      </div>
    </div>
  )
}

function t_ideal(range: [number, number]) {
  return `Ideal: ${range[0]}-${range[1]}`
}
