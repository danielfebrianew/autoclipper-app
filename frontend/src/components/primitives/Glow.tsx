interface GlowProps {
  x?: string
  y?: string
  size?: number
  color?: string
}

export default function Glow({ x = '50%', y = '50%', size = 360, color = 'rgba(123,97,255,0.22)' }: GlowProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x, top: y,
        width: size, height: size,
        borderRadius: '50%',
        background: color,
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0,
        transform: 'translate(-50%, -50%)',
      }}
    />
  )
}
