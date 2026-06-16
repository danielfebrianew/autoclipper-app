interface ProgressRingProps { pct: number; size?: number }

export default function ProgressRing({ pct, size = 40 }: ProgressRingProps) {
  const r = (size / 2) - 3
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3.5" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--color-accent-hi)" strokeWidth="3.5"
        strokeLinecap="round" strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
    </svg>
  )
}
