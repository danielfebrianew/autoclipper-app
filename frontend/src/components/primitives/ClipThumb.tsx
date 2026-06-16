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
    <div style={{
      position: 'relative', width: w as any, height: h ?? 'auto', aspectRatio: typeof w === 'string' ? '9/16' : undefined,
      borderRadius: radius, overflow: 'hidden',
      background: 'linear-gradient(165deg, #1b1530, #120d1e 70%)',
      border: '1px solid var(--color-border)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      flexShrink: 0,
    }}>
      {/* real video frame (jika ada) */}
      {showImg && (
        <img
          src={src}
          onError={() => setImgError(true)}
          draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* diagonal stripes (hanya saat placeholder) */}
      {!showImg && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 11px)' }} />
      )}
      {/* vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 0%, transparent 40%, rgba(0,0,0,0.35))' }} />

      {/* center play */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: numW * 0.3, height: numW * 0.3, borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 3,
        }}>
          <PlayIcon size={numW * 0.13} color="rgba(255,255,255,0.85)" weight="fill" />
        </div>
      </div>

      {/* label */}
      {label && (
        <div style={{ position: 'absolute', left: 7, bottom: 7, fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: 0.3, color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase' }}>
          {label}
        </div>
      )}
      {/* duration */}
      {dur && (
        <div style={{ position: 'absolute', right: 7, bottom: 7, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.45)', padding: '1px 5px', borderRadius: 5 }}>
          {dur}
        </div>
      )}
      {/* viral score */}
      {score != null && <ViralChip score={score} float />}
      {/* waveform hint (hanya saat placeholder) */}
      {!showImg && (
        <div style={{ position: 'absolute', left: 7, right: 7, bottom: 24, display: 'flex', gap: 1.5, alignItems: 'flex-end', height: 14, opacity: 0.5 }}>
          {Array.from({ length: barCount }).map((_, i) => (
            <span key={i} style={{ flex: 1, height: `${20 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 80}%`, background: 'rgba(157,134,255,0.55)', borderRadius: 1 }} />
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
