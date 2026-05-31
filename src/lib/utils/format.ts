import type { HandNotation, Position, PreflopAction, PostflopAction } from '@/types/poker'

export function formatPercent(n: number, decimals: number = 1): string {
  return `${(n * 100).toFixed(decimals)}%`
}

export function formatHandNotation(hand: HandNotation): string {
  return hand
}

export function formatPosition(pos: Position): string {
  const labels: Record<Position, string> = {
    UTG: '枪口位',
    UTG1: '枪口+1',
    MP: '中位',
    MP1: '中位+1',
    CO: '关煞位',
    BTN: '庄家位',
    SB: '小盲位',
    BB: '大盲位',
  }
  return labels[pos] ?? pos
}

export function formatAction(action: PreflopAction | PostflopAction): string {
  const labels: Record<string, string> = {
    fold: '弃牌',
    call: '跟注',
    raise: '加注',
    '3bet': '3-bet',
    '4bet': '4-bet',
    'all-in': '全下',
    check: '过牌',
    bet: '下注',
  }
  return labels[action] ?? action
}
