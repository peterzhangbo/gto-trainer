export interface UserProfile {
  id: string
  displayName: string
  createdAt: string
}

export interface UserStats {
  totalDrills: number
  overallAccuracy: number
  preflopAccuracy: number
  postflopAccuracy: number
  bestScenario: string
  worstScenario: string
  currentStreak: number
  longestStreak: number
}
