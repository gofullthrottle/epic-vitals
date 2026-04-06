import { create } from 'zustand'
import type { CombinedRepReport } from '../types/scoring'
import type { Session, ActiveSessionState } from '../types/session'

interface SessionStore extends ActiveSessionState {
  startSession: (exerciseId: string, variant: string) => void
  endSession: () => Session | null
  recordRep: (report: CombinedRepReport) => void
  nextSet: () => void
  setRecording: (recording: boolean) => void
  reset: () => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  currentRepNumber: 0,
  lastRepReport: null,
  isRecording: false,

  startSession: (exerciseId, variant) => {
    set({
      session: {
        id: generateId(),
        startedAt: Date.now(),
        completedAt: null,
        exercises: [
          {
            exerciseId,
            variant,
            sets: [],
          },
        ],
        totalVolume: 0,
        averageFormScore: 0,
      },
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      currentRepNumber: 0,
      lastRepReport: null,
      isRecording: false,
    })
  },

  endSession: () => {
    const { session } = get()
    if (!session) return null

    const completed: Session = {
      ...session,
      completedAt: Date.now(),
    }
    set({ session: completed, isRecording: false })
    return completed
  },

  recordRep: (report) => {
    set((state) => ({
      currentRepNumber: state.currentRepNumber + 1,
      lastRepReport: report,
    }))
  },

  nextSet: () => {
    set((state) => ({
      currentSetIndex: state.currentSetIndex + 1,
      currentRepNumber: 0,
      lastRepReport: null,
    }))
  },

  setRecording: (recording) => set({ isRecording: recording }),

  reset: () =>
    set({
      session: null,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      currentRepNumber: 0,
      lastRepReport: null,
      isRecording: false,
    }),
}))
