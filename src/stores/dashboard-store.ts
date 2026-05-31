import { create } from 'zustand'
import type { UserStats } from '@/types'

interface DashboardState {
  stats: UserStats | null
  sessions: Array<{
    id: string
    date: string
    scenarioType: string
    drillCount: number
    averageScore: number
  }>
  loading: boolean
  fetchStats: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  sessions: [],
  loading: false,

  fetchStats: async () => {
    set({ loading: true })
    try {
      const stored = localStorage.getItem('gto-trainer-sessions')
      const sessions = stored ? JSON.parse(stored) : []

      const totalDrills = sessions.reduce(
        (sum: number, s: { drillCount: number }) => sum + s.drillCount,
        0
      )
      const totalSessions = sessions.length
      const scores = sessions.map((s: { averageScore: number }) => s.averageScore)
      const averageScore =
        scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0
      const bestStreak = parseInt(
        localStorage.getItem('gto-trainer-best-streak') || '0',
        10
      )

      const accuracyByAction: Record<string, { correct: number; total: number }> = {}
      const storedResults = localStorage.getItem('gto-trainer-accuracy')
      if (storedResults) {
        const parsed = JSON.parse(storedResults) as Record<string, { correct: number; total: number }>
        Object.assign(accuracyByAction, parsed)
      }

      set({
        stats: {
          totalDrills,
          totalSessions,
          averageScore: Math.round(averageScore),
          bestStreak,
          accuracyByAction,
          recentSessions: sessions.slice(0, 10),
        },
        sessions,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },
}))
