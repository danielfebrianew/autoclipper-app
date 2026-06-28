interface SpinnerProps { size?: number; color?: string }

export default function Spinner({ size = 15, color = '#fff' }: SpinnerProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-[acspin_0.8s_linear_infinite] shrink-0">
      <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
