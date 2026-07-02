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
  volume: number   // 0..1
  muted: boolean
  onTimeUpdate: (t: number) => void
  onPlayStateChange: (playing: boolean) => void
  onLoadedMetadata?: (w: number, h: number, duration: number) => void
}

export default forwardRef<SourceStageHandle, Props>(function SourceStage(
  { src, inPoint, outPoint, showCrop, cropZones, cropLabel, smooth, volume, muted, onTimeUpdate, onPlayStateChange, onLoadedMetadata },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const loopRef = useRef({ inPoint, outPoint })
  loopRef.current = { inPoint, outPoint }

  // Keep the <video> volume/mute in sync (re-applies on [src] once it mounts async).
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted = muted
  }, [volume, muted, src])

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

  // Re-attach when `src` changes: the <video> element only mounts once src is
  // truthy (it loads async), so effects keyed on [] would bail on first mount
  // and never wire up — leaving the play/pause icon stuck.
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
  }, [src])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay = () => onPlayStateChange(true)
    const onPause = () => onPlayStateChange(false)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    // Sync initial state in case the video is already playing/paused when we attach.
    onPlayStateChange(!v.paused)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [src])

  return (
    <div className="relative rounded-[14px] overflow-hidden bg-[#0a0712] border border-border w-full h-full">
      {src ? (
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full block"
          style={{ objectFit: 'fill' }}
          preload="metadata"
          onLoadedMetadata={e => {
            const v = e.currentTarget
            onLoadedMetadata?.(v.videoWidth, v.videoHeight, v.duration)
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-faint text-[12px]">
          Memuat video…
        </div>
      )}

      {/* Crop zone overlays — positions are runtime % values derived from face data */}
      {showCrop && cropZones.map((zone, i) => (
        <div
          key={i}
          className="absolute border-2 border-[rgba(123,97,255,0.9)] rounded-sm pointer-events-none overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          style={{
            left: `${zone.x * 100}%`,
            top: `${zone.y * 100}%`,
            width: `${zone.w * 100}%`,
            height: `${zone.h * 100}%`,
            transition: smooth ? 'left 0.18s linear, top 0.18s linear, width 0.18s linear' : 'none',
          }}
        >
          {i === 0 && cropLabel && (
            <span className="absolute top-2 left-2 font-mono text-[9px] tracking-[0.3px] text-accent-hi bg-[rgba(10,7,18,0.75)] px-1.5 py-0.5 rounded-sm whitespace-nowrap">
              {cropLabel}
            </span>
          )}
        </div>
      ))}
    </div>
  )
})
