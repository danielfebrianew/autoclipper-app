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
    <div className="px-4.5 pb-3.5 font-ui select-none">
      {/* Labels */}
      <div className="flex justify-between text-[10px] text-faint font-mono mb-1.5">
        <span>{fmt(0)}</span>
        <span>{fmt(duration)}</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-12 rounded-lg bg-white/7 overflow-visible cursor-pointer"
        onPointerDown={e => {
          if ((e.target as HTMLElement).dataset.handle) return
          setDragging('seek')
          onSeek(xToSec(e.clientX))
        }}
      >
        {/* Thumbnail strip */}
        {thumbnails.length > 0 && (
          <div className="absolute inset-0 flex rounded-lg overflow-hidden opacity-30">
            {thumbnails.map((p, i) => (
              <img
                key={i}
                src={`/media${p}`}
                className="flex-1 object-cover min-w-0"
                draggable={false}
              />
            ))}
          </div>
        )}

        {/* Waveform bars */}
        <div className="absolute inset-0 flex gap-[1.5px] items-end py-1.5 rounded-lg overflow-hidden opacity-55">
          {(waveform.length > 0 ? waveform : Array.from({ length: 80 }, (_, i) => 0.15 + (Math.sin(i * 1.4) * 0.5 + 0.5) * 0.7)).map((peak, i) => (
            <span
              key={i}
              className="flex-1 bg-accent-lo rounded-xs"
              style={{ height: `${Math.max(6, peak * 100)}%` }}
            />
          ))}
        </div>

        {/* Selected region — left/width are runtime % from inPoint/outPoint */}
        <div
          className="absolute top-0 bottom-0 bg-[rgba(123,97,255,0.22)] border border-accent-lo rounded-sm pointer-events-none"
          style={{ left: `${pct(inPoint)}%`, width: `${pct(outPoint - inPoint)}%` }}
        />

        {/* IN handle */}
        <div
          data-handle="in"
          className="absolute -top-1.5 -bottom-1.5 w-1.5 bg-accent-hi rounded-[3px] cursor-ew-resize z-3"
          style={{ left: `${pct(inPoint)}%`, marginLeft: -3 }}
          onPointerDown={e => { e.stopPropagation(); setDragging('in') }}
        />

        {/* OUT handle */}
        <div
          data-handle="out"
          className="absolute -top-1.5 -bottom-1.5 w-1.5 bg-accent-hi rounded-[3px] cursor-ew-resize z-3"
          style={{ left: `${pct(outPoint)}%`, marginLeft: -3 }}
          onPointerDown={e => { e.stopPropagation(); setDragging('out') }}
        />

        {/* Playhead */}
        {currentTime >= 0 && (
          <div
            className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-white rounded-0.5 pointer-events-none z-4 shadow-[0_0_6px_rgba(255,255,255,0.6)]"
            style={{ left: `${pct(currentTime)}%`, marginLeft: -1 }}
          />
        )}
      </div>

      {/* IN / OUT labels */}
      <div className="flex justify-between text-[10.5px] font-mono text-accent-hi mt-1.5">
        <span>IN  {fmt(inPoint)}</span>
        <span className="text-faint">{fmt(outPoint - inPoint)} durasi</span>
        <span>OUT {fmt(outPoint)}</span>
      </div>
    </div>
  )
}
