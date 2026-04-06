import { scoreToGrade } from '../types/scoring'

interface ScoreBadgeProps {
  score: number
  size?: 'small' | 'large'
}

const gradeColors: Record<string, string> = {
  S: '#A855F7',
  A: '#22C55E',
  B: '#3B82F6',
  C: '#EAB308',
  D: '#EF4444',
}

export function ScoreBadge({ score, size = 'small' }: ScoreBadgeProps) {
  const grade = scoreToGrade(score)
  const color = gradeColors[grade]
  const isLarge = size === 'large'

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: isLarge ? 80 : 48,
        height: isLarge ? 80 : 48,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        border: `2px solid ${color}`,
        color,
      }}
    >
      <span
        style={{
          fontSize: isLarge ? 28 : 18,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {Math.round(score)}
      </span>
      <span
        style={{
          fontSize: isLarge ? 16 : 11,
          fontWeight: 600,
          opacity: 0.9,
        }}
      >
        {grade}
      </span>
    </div>
  )
}
