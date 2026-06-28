import { useState } from 'react'
import { PlayIcon } from '@phosphor-icons/react'
import ViralChip from './ViralChip'

interface ClipThumbProps {
  w?: number | string
  label?: string
  dur?: string
  score?: number | null
  radius?: number
  src?: string
  children?: React.ReactNode
}

export default function ClipThumb({ w = 132, label = 'scene', dur = '', score, radius = 12, src, children }: ClipThumbProps) {
  const numW = typeof w === 'number' ? w : 132
  const h = typeof w === 'string' ? undefined : Math.round((numW as number) * 16 / 9)
  const barCount = Math.round((numW as number) / 7)
  const [imgError, setImgError] = useState(false)
  const showImg = !!src && !imgError

  return (
    <div
      className="relative overflow-hidden shrink-0"
      style={{
        width: w as any, height: h ?? 'auto',
        aspectRatio: typeof w === 'string' ? '9/16' : undefined,
        borderRadius: radius,
        background: 'linear-gradient(165deg, #1b1530, #120d1e 70%)',
        border: '1px solid var(--color-border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* real video frame */}
      {showImg && (
        <img
          src={src}
          onError={() => setImgError(true)}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* diagonal stripes (placeholder) */}
      {!showImg && (
        <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 11px)' }} />
      )}
      {/* vignette */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 0%, transparent 40%, rgba(0,0,0,0.35))' }} />

      {/* center play */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: numW * 0.3, height: numW * 0.3, paddingLeft: 3,
            background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.14)',
          }}
        >
          <PlayIcon size={numW * 0.13} color="rgba(255,255,255,0.85)" weight="fill" />
        </div>
      </div>

      {/* label */}
      {label && (
        <div className="absolute left-1.75 bottom-1.75 font-mono text-[8.5px] tracking-[0.3px] text-white/42 uppercase">
          {label}
        </div>
      )}
      {/* duration */}
      {dur && (
        <div className="absolute right-1.75 bottom-1.75 font-mono text-[9px] text-white/80 bg-black/45 px-1.25 py-px rounded-[5px]">
          {dur}
        </div>
      )}
      {/* viral score */}
      {score != null && <ViralChip score={score} float />}
      {/* waveform hint (placeholder) */}
      {!showImg && (
        <div className="absolute left-1.75 right-1.75 bottom-6 flex gap-[1.5px] items-end h-3.5 opacity-50">
          {Array.from({ length: barCount }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-[1px]"
              style={{ height: `${20 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 80}%`, background: 'rgba(157,134,255,0.55)' }}
            />
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
