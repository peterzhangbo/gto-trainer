import { create } from 'zustand'

interface RangeViewerState {
  scenarioType: string
  position: string
  villainPosition: string | null
  selectedHand: string | null
  setScenario: (type: string, params?: { position?: string; villainPosition?: string | null }) => void
  selectHand: (hand: string | null) => void
}

export const useRangeViewerStore = create<RangeViewerState>((set) => ({
  scenarioType: 'rfi',
  position: 'UTG',
  villainPosition: null,
  selectedHand: null,

  setScenario: (type: string, params?: { position?: string; villainPosition?: string | null }) => {
    set((state) => ({
      scenarioType: type,
      position: params?.position ?? state.position,
      villainPosition: params?.villainPosition ?? state.villainPosition,
      selectedHand: null,
    }))
  },

  selectHand: (hand: string | null) => {
    set({ selectedHand: hand })
  },
}))
