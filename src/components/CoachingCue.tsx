interface CoachingCueProps {
  cue: string | null
  severity?: 'minor' | 'warning' | 'critical'
}

const severityColors = {
  minor: '#22C55E',
  warning: '#EAB308',
  critical: '#EF4444',
}

export function CoachingCue({ cue, severity = 'warning' }: CoachingCueProps) {
  if (!cue) return null

  return (
    <div
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderLeft: `4px solid ${severityColors[severity]}`,
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 600,
        maxWidth: 280,
      }}
    >
      {cue}
    </div>
  )
}
