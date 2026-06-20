import { useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../../store/hooks'
import { removeTrack, updateTrack, type OverlayTrack } from '../../../store/slices/overlaySlice'
import { usePlayback } from '../playback'

const PX_PER_SEC = 60
const LABEL_W = 56
const ROW_H = 40

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function Ruler({ duration }: { duration: number }) {
  const ticks = []
  const step = duration > 120 ? 30 : duration > 30 ? 10 : 5
  for (let t = 0; t <= duration; t += step) {
    ticks.push(
      <div key={t} style={{ position: 'absolute', left: t * PX_PER_SEC, top: 0, height: '100%', borderLeft: '1px solid var(--color-border-soft)', paddingLeft: 4, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-faint)' }}>
        {fmt(t)}
      </div>,
    )
  }
  return <div style={{ position: 'relative', height: 18, width: duration * PX_PER_SEC }}>{ticks}</div>
}

function TrackChip({ track, color }: { track: OverlayTrack; color: string }) {
  const dispatch = useAppDispatch()
  const { selectedTrackId, selectTrack } = usePlayback()
  const selected = selectedTrackId === track.id
  const left = track.start_sec * PX_PER_SEC
  const width = Math.max(8, (track.end_sec - track.start_sec) * PX_PER_SEC)

  return (
    <div
      onClick={() => selectTrack(track.id)}
      title={track.asset_name}
      style={{
        position: 'absolute', left, width, top: 4, height: ROW_H - 8,
        borderRadius: 6, background: color, cursor: 'pointer',
        border: selected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', padding: '0 6px', gap: 4, overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: 10, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
        {track.asset_name || track.kind}
      </span>
      {selected && (
        <button
          onClick={e => { e.stopPropagation(); dispatch(removeTrack(track.id)); selectTrack(null) }}
          style={{ border: 'none', background: 'rgba(0,0,0,0.4)', color: '#fff', borderRadius: 4, fontSize: 10, cursor: 'pointer', padding: '1px 4px' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

export default function Timeline() {
  const current = useAppSelector(s => s.overlay.current)!
  const { currentTime, duration, seek } = usePlayback()
  const scrollRef = useRef<HTMLDivElement>(null)

  const dur = duration || current.video_duration
  const imageTracks = current.tracks.filter(t => t.kind === 'image')
  const videoTracks = current.tracks.filter(t => t.kind === 'video')

  function handleSeek(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const scroll = scrollRef.current?.scrollLeft ?? 0
    const x = e.clientX - rect.left + scroll - LABEL_W
    if (x < 0) return
    seek(Math.max(0, Math.min(dur, x / PX_PER_SEC)))
  }

  const playheadX = LABEL_W + currentTime * PX_PER_SEC

  return (
    <div style={{ height: 170, display: 'flex', flexDirection: 'column', background: '#0b0810' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
        <div style={{ position: 'relative', minWidth: LABEL_W + dur * PX_PER_SEC, paddingLeft: LABEL_W }} onClick={handleSeek}>
          {/* Ruler */}
          <div style={{ position: 'sticky', left: 0, paddingLeft: 4 }}>
            <Ruler duration={dur} />
          </div>

          {/* Image row */}
          <Row label="Gambar" tracks={imageTracks} color="var(--color-accent)" />
          {/* Video row */}
          <Row label="Video" tracks={videoTracks} color="#2563eb" />

          {/* Playhead */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: playheadX, width: 2, background: 'var(--color-accent-hi)', pointerEvents: 'none', zIndex: 5 }} />
        </div>
      </div>
    </div>
  )
}

function Row({ label, tracks, color }: { label: string; tracks: OverlayTrack[]; color: string }) {
  return (
    <div style={{ position: 'relative', height: ROW_H, borderTop: '1px solid var(--color-border-soft)' }}>
      <div style={{ position: 'absolute', left: -LABEL_W, top: 0, width: LABEL_W, height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 10, color: 'var(--color-faint)' }}>
        {label}
      </div>
      {tracks.map(t => <TrackChip key={t.id} track={t} color={color} />)}
      {tracks.length === 0 && (
        <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--color-faint)', opacity: 0.6 }}>
          {label === 'Gambar' ? 'Klik gambar di sidebar untuk menambah di playhead' : 'Belum ada klip overlay'}
        </div>
      )}
    </div>
  )
}
