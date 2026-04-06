import { openDB, type IDBPDatabase } from 'idb'
import type { Session, SessionSummary } from '../types/session'

const DB_NAME = 'formcoach'
const DB_VERSION = 1

interface FormCoachDB {
  sessions: {
    key: string
    value: Session
    indexes: {
      'by-date': number
    }
  }
}

let dbPromise: Promise<IDBPDatabase<FormCoachDB>> | null = null

function getDB(): Promise<IDBPDatabase<FormCoachDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FormCoachDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const sessionStore = db.createObjectStore('sessions', {
          keyPath: 'id',
        })
        sessionStore.createIndex('by-date', 'startedAt')
      },
    })
  }
  return dbPromise
}

export async function saveSession(session: Session): Promise<void> {
  const db = await getDB()
  await db.put('sessions', session)
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB()
  return db.get('sessions', id)
}

export async function getAllSessions(): Promise<SessionSummary[]> {
  const db = await getDB()
  const sessions = await db.getAllFromIndex('sessions', 'by-date')

  return sessions.reverse().map((s): SessionSummary => {
    let totalSets = 0
    let totalReps = 0
    for (const exercise of s.exercises) {
      totalSets += exercise.sets.length
      for (const set of exercise.sets) {
        totalReps += set.score.reps.length
      }
    }
    return {
      id: s.id,
      date: s.startedAt,
      exerciseCount: s.exercises.length,
      totalSets,
      totalReps,
      averageScore: s.averageFormScore,
    }
  })
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('sessions', id)
}
