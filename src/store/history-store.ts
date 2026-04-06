import { create } from 'zustand'
import type { SessionSummary } from '../types/session'
import { getAllSessions } from '../db/database'

interface HistoryStore {
  sessions: SessionSummary[]
  loading: boolean
  error: string | null
  fetchSessions: () => Promise<void>
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  sessions: [],
  loading: false,
  error: null,

  fetchSessions: async () => {
    set({ loading: true, error: null })
    try {
      const sessions = await getAllSessions()
      set({ sessions, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load sessions',
        loading: false,
      })
    }
  },
}))
