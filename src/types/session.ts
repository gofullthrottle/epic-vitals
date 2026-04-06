import type { CombinedRepReport, SetScore } from './scoring'

/** A tracked exercise within a session */
export interface ExerciseRecord {
  exerciseId: string
  variant: string
  sets: SetRecord[]
}

/** A single set record */
export interface SetRecord {
  setNumber: number
  targetReps: number
  weight: number
  weightUnit: 'kg' | 'lb'
  score: SetScore
  startedAt: number
  completedAt: number
}

/** A complete training session */
export interface Session {
  id: string
  startedAt: number
  completedAt: number | null
  exercises: ExerciseRecord[]
  totalVolume: number
  averageFormScore: number
}

/** Lightweight session summary for history lists */
export interface SessionSummary {
  id: string
  date: number
  exerciseCount: number
  totalSets: number
  totalReps: number
  averageScore: number
}

/** Active session state used by the UI during a workout */
export interface ActiveSessionState {
  session: Session | null
  currentExerciseIndex: number
  currentSetIndex: number
  currentRepNumber: number
  lastRepReport: CombinedRepReport | null
  isRecording: boolean
}
