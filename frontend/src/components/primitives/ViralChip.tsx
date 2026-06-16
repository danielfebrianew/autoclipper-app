import { TrendUpIcon } from '@phosphor-icons/react'

interface ViralChipProps {
  score: number
  float?: boolean
  big?: boolean
}

export default function ViralChip({ score, float, big }: ViralChipProps) {
  const hot = score >= 85
  const fs = big ? 12 : 9.5
  const body = (
    <span className={`viral-chip ${hot ? 'hot' : 'cool'}`} style={{ fontSize: fs, padding: big ? '4px 8px' : '2px 6px' }}>
      <TrendUpIcon size={big ? 13 : 11} weight="bold" />
      {score}
    </span>
  )
  if (!float) return body
  return <div style={{ position: 'absolute', top: 7, left: 7 }}>{body}</div>
}
