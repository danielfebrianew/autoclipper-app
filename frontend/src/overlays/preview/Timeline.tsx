import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Full duration of the source video in seconds */
  duration: number
  inPoint: number
  outPoint: number
  currentTime: number
  waveform: number[]       // 0..1 normalised peaks
  thumbnails: string[]     // absolute disk paths
  onInChange: (v: number) => void
  onOutChange: (v: number) => void
  onSeek: (v: number) => void
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function Timeline({
  duration, inPoint, outPoint, currentTime,
  waveform, thumbnails,
  onInChange, onOutChange, onSeek,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'in' | 'out' | 'seek' | null>(null)

  function xToSec(clientX: number) {
    const rect = trackRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }

  function pct(s: number) {
    return (s / Math.max(duration, 0.001)) * 100
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      const sec = xToSec(e.clientX)
      if (dragging === 'in') {
        onInChange(Math.min(sec, outPoint - 0.5))
      } else if (dragging === 'out') {
        onOutChange(Math.max(sec, inPoint + 0.5))
      } else if (dragging === 'seek') {
        onSeek(sec)
      }
    }
    const up = () => setDragging(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, inPoint, outPoint, duration])

  return (
    <div style={{ padding: '0 18px 14px', fontFamily: 'var(--font-ui)', userSelect: 'none' }}>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-faint)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
        <span>{fmt(0)}</span>
        <span>{fmt(duration)}</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        style={{ position: 'relative', height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.07)', overflow: 'visible', cursor: 'pointer' }}
        onPointerDown={e => {
          if ((e.target as HTMLElement).dataset.handle) return
          setDragging('seek')
          onSeek(xToSec(e.clientX))
        }}
      >
        {/* Thumbnail strip */}
        {thumbnails.length > 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', borderRadius: 8, overflow: 'hidden', opacity: 0.3 }}>
            {thumbnails.map((p, i) => (
              <img
                key={i}
                src={`/media${p}`}
                style={{ flex: 1, objectFit: 'cover', minWidth: 0 }}
                draggable={false}
              />
            ))}
          </div>
        )}

        {/* Waveform bars */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 1.5, alignItems: 'flex-end', padding: '6px 0', borderRadius: 8, overflow: 'hidden', opacity: 0.55 }}>
          {(waveform.length > 0 ? waveform : Array.from({ length: 80 }, (_, i) => 0.15 + (Math.sin(i * 1.4) * 0.5 + 0.5) * 0.7)).map((peak, i) => (
            <span
              key={i}
              style={{ flex: 1, height: `${Math.max(6, peak * 100)}%`, background: 'var(--color-accent-lo)', borderRadius: 1 }}
            />
          ))}
        </div>

        {/* Selected region */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${pct(inPoint)}%`, width: `${pct(outPoint - inPoint)}%`,
          background: 'rgba(123,97,255,0.22)', border: '1px solid var(--color-accent-lo)',
          borderRadius: 4, pointerEvents: 'none',
        }} />

        {/* IN handle */}
        <div
          data-handle="in"
          style={{ position: 'absolute', top: -6, bottom: -6, left: `${pct(inPoint)}%`, marginLeft: -3, width: 6, background: 'var(--color-accent-hi)', borderRadius: 3, cursor: 'ew-resize', zIndex: 3 }}
          onPointerDown={e => { e.stopPropagation(); setDragging('in') }}
        />

        {/* OUT handle */}
        <div
          data-handle="out"
          style={{ position: 'absolute', top: -6, bottom: -6, left: `${pct(outPoint)}%`, marginLeft: -3, width: 6, background: 'var(--color-accent-hi)', borderRadius: 3, cursor: 'ew-resize', zIndex: 3 }}
          onPointerDown={e => { e.stopPropagation(); setDragging('out') }}
        />

        {/* Playhead */}
        {currentTime >= 0 && (
          <div style={{
            position: 'absolute', top: -6, bottom: -6,
            left: `${pct(currentTime)}%`, marginLeft: -1, width: 2,
            background: '#fff', borderRadius: 2, pointerEvents: 'none', zIndex: 4,
            boxShadow: '0 0 6px rgba(255,255,255,0.6)',
          }} />
        )}
      </div>

      {/* IN / OUT labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--color-accent-hi)', marginTop: 6 }}>
        <span>IN  {fmt(inPoint)}</span>
        <span style={{ color: 'var(--color-faint)' }}>{fmt(outPoint - inPoint)} durasi</span>
        <span>OUT {fmt(outPoint)}</span>
      </div>
    </div>
  )
}
