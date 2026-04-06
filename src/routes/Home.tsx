import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/session-store'

const exercises = [
  { id: 'barbell_back_squat', variant: 'high_bar', label: 'Back Squat (High Bar)' },
  { id: 'barbell_back_squat', variant: 'low_bar', label: 'Back Squat (Low Bar)', disabled: true },
  { id: 'conventional_deadlift', variant: 'conventional', label: 'Deadlift', disabled: true },
  { id: 'barbell_bench_press', variant: 'flat', label: 'Bench Press', disabled: true },
]

export function Home() {
  const navigate = useNavigate()
  const startSession = useSessionStore((s) => s.startSession)

  const handleStart = (exerciseId: string, variant: string) => {
    startSession(exerciseId, variant)
    navigate('/session/camera')
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        FormCoach
      </h1>
      <p style={{ color: '#888', marginBottom: 32 }}>
        AI-powered real-time lifting form analysis
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Select Exercise
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exercises.map((ex) => (
          <button
            key={`${ex.id}-${ex.variant}`}
            onClick={() => handleStart(ex.id, ex.variant)}
            disabled={ex.disabled}
            style={{
              padding: '16px 20px',
              borderRadius: 12,
              border: '1px solid #333',
              backgroundColor: ex.disabled ? '#1A1A1A' : '#2A2A2A',
              color: ex.disabled ? '#555' : '#FFF',
              fontSize: 16,
              fontWeight: 500,
              textAlign: 'left',
              cursor: ex.disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {ex.label}
            {ex.disabled && (
              <span style={{ float: 'right', fontSize: 12, color: '#555' }}>
                Coming Soon
              </span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => navigate('/session/summary')}
        style={{
          marginTop: 32,
          padding: '12px 20px',
          borderRadius: 8,
          border: '1px solid #333',
          backgroundColor: 'transparent',
          color: '#888',
          fontSize: 14,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        View Session History
      </button>
    </div>
  )
}
