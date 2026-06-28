interface GlowProps {
  x?: string
  y?: string
  size?: number
  color?: string
}

export default function Glow({ x = '50%', y = '50%', size = 360, color = 'rgba(123,97,255,0.22)' }: GlowProps) {
  return (
    <div
      className="absolute rounded-full blur-[80px] pointer-events-none z-0 -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y, width: size, height: size, background: color }}
    />
  )
}
