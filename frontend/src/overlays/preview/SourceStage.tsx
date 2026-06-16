import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { NormBox } from './cropMath'

export interface SourceStageHandle {
  play: () => void
  pause: () => void
  seek: (t: number) => void
  toggle: () => void
}

interface Props {
  src: string
  inPoint: number
  outPoint: number
  showCrop: boolean
  cropZones: NormBox[]
  cropLabel: string
  smooth: boolean
  onTimeUpdate: (t: number) => void
  onPlayStateChange: (playing: boolean) => void
  onLoadedMetadata?: (w: number, h: number) => void
}

export default forwardRef<SourceStageHandle, Props>(function SourceStage(
  { src, inPoint, outPoint, showCrop, cropZones, cropLabel, smooth, onTimeUpdate, onPlayStateChange, onLoadedMetadata },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const loopRef = useRef({ inPoint, outPoint })
  loopRef.current = { inPoint, outPoint }

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seek: (t) => { if (videoRef.current) videoRef.current.currentTime = t },
    toggle: () => {
      const v = videoRef.current
      if (!v) return
      v.paused ? v.play() : v.pause()
    },
  }))

  useEffect(() => {
    const v = videoRef.current
    if (!v || !src) return
    v.currentTime = inPoint
  }, [src])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const handler = () => {
      const { inPoint: ip, outPoint: op } = loopRef.current
      if (v.currentTime >= op) {
        v.currentTime = ip
        v.play()
      }
      onTimeUpdate(v.currentTime)
    }
    v.addEventListener('timeupdate', handler)
    return () => v.removeEventListener('timeupdate', handler)
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay = () => onPlayStateChange(true)
    const onPause = () => onPlayStateChange(false)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [])

  return (
    <div style={{
      position: 'relative', borderRadius: 14, overflow: 'hidden',
      background: '#0a0712', border: '1px solid var(--color-border)',
      width: '100%', height: '100%',
    }}>
      {src ? (
        <video
          ref={videoRef}
          src={src}
          // Kontainer sudah ber-aspect = source, jadi 'fill' mengisi pas tanpa
          // distorsi & tanpa letterbox → crop box overlay sejajar dengan frame.
          style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
          preload="metadata"
          onLoadedMetadata={e => {
            const v = e.currentTarget
            onLoadedMetadata?.(v.videoWidth, v.videoHeight)
          }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-faint)', fontSize: 12 }}>
          Memuat video…
        </div>
      )}

      {/* Crop zone overlays */}
      {showCrop && cropZones.map((zone, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${zone.x * 100}%`,
            top: `${zone.y * 100}%`,
            width: `${zone.w * 100}%`,
            height: `${zone.h * 100}%`,
            border: '2px solid rgba(123,97,255,0.9)',
            borderRadius: 4,
            pointerEvents: 'none',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            transition: smooth ? 'left 0.18s linear, top 0.18s linear, width 0.18s linear' : 'none',
          }}
        >
          {i === 0 && cropLabel && (
            <span style={{
              position: 'absolute', top: 8, left: 8,
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 0.3,
              color: 'var(--color-accent-hi)', background: 'rgba(10,7,18,0.75)',
              padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
            }}>
              {cropLabel}
            </span>
          )}
        </div>
      ))}
    </div>
  )
})
