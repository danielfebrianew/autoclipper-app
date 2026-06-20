import { useEffect, useMemo, useRef } from 'react'
import { PlayIcon, PauseIcon } from '@phosphor-icons/react'
import { useAppSelector } from '../../store/hooks'
import { usePlayback } from './playback'
import type { OverlayTrack } from '../../store/slices/overlaySlice'

function ratioToAspect(ratio: string): string {
  if (ratio === '1:1') return '1 / 1'
  if (ratio === '16:9') return '16 / 9'
  return '9 / 16'
}

function mediaURL(absPath: string): string {
  // mediaHandler serves /media/<abs-path>; encode each segment.
  return '/media' + absPath
}

// Overlay video element synced to the global playhead.
function VideoOverlay({ track, areaPct, fit }: { track: OverlayTrack; areaPct: number; fit: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const { currentTime, isPlaying } = usePlayback()

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const overlayTime = track.trim_start_sec + (currentTime - track.start_sec)
    if (Math.abs(v.currentTime - overlayTime) > 0.1) v.currentTime = Math.max(0, overlayTime)
  }, [currentTime, track.start_sec, track.trim_start_sec])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (isPlaying) void v.play().catch(() => {})
    else v.pause()
  }, [isPlaying])

  return (
    <video
      ref={ref}
      src={mediaURL(track.asset_path)}
      muted
      playsInline
      preload="auto"
      style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${areaPct}%`, objectFit: fit as any }}
    />
  )
}

export default function PreviewPane() {
  const current = useAppSelector(s => s.overlay.current)!
  const { currentTime, isPlaying, setCurrentTime, setDuration, setIsPlaying } = usePlayback()
  const videoRef = useRef<HTMLVideoElement>(null)
  const clickRef = useRef<HTMLAudioElement | null>(null)
  const prevTrackId = useRef<string | null>(null)

  useEffect(() => {
    const a = new Audio('/click.mp3')
    a.preload = 'auto'
    clickRef.current = a
  }, [])

  const layout = current.layout
  const click = current.click_sound
  const areaPct = layout.image_area_ratio * 100

  // The active overlay track at the current playhead (last one wins on overlap).
  const activeTrack = useMemo(
    () => current.tracks.filter(t => t.start_sec <= currentTime && currentTime < t.end_sec).at(-1) ?? null,
    [current.tracks, currentTime],
  )

  // Sync source <video> with the playhead.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (Math.abs(v.currentTime - currentTime) > 0.1) v.currentTime = currentTime
  }, [currentTime])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) void v.play().catch(() => setIsPlaying(false))
    else v.pause()
  }, [isPlaying])

  // Play click sound when the playhead enters a new image track.
  useEffect(() => {
    const id = activeTrack?.id ?? null
    const allowed = activeTrack?.kind === 'image' ? activeTrack.click_enabled !== false : false
    if (id && id !== prevTrackId.current && isPlaying && click.enabled && allowed) {
      const a = clickRef.current
      if (a) {
        a.volume = Math.max(0, Math.min(1, click.volume))
        a.currentTime = 0
        void a.play().catch(() => {})
      }
    }
    prevTrackId.current = id
  }, [activeTrack, isPlaying, click.enabled, click.volume])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, background: '#0d0a14', padding: 20, minWidth: 0,
    }}>
      <div style={{
        position: 'relative', height: '100%', maxHeight: '62vh', aspectRatio: ratioToAspect(layout.aspect_ratio),
        borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)',
        background: layout.background_color, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <video
          ref={videoRef}
          src={mediaURL(current.source_video_path)}
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
          onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => setIsPlaying(false)}
        />

        {activeTrack?.kind === 'image' && (
          <img
            src={mediaURL(activeTrack.asset_path)}
            alt=""
            style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${areaPct}%`, objectFit: (activeTrack.fit_override || layout.image_fit) as any }}
          />
        )}
        {activeTrack?.kind === 'video' && (
          <VideoOverlay track={activeTrack} areaPct={areaPct} fit={activeTrack.fit_override || layout.image_fit} />
        )}

        {/* Area guide line */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${areaPct}%`, borderTop: '1px dashed rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 6, bottom: `calc(${areaPct}% + 4px)`, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '1px 5px', borderRadius: 4, pointerEvents: 'none' }}>
          {Math.round(areaPct)}%
        </div>
      </div>

      {/* Transport */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="btn-primary"
          style={{ width: 40, height: 40, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {isPlaying ? <PauseIcon size={18} weight="fill" /> : <PlayIcon size={18} weight="fill" />}
        </button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)' }}>
          {currentTime.toFixed(1)}s / {current.video_duration.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}
