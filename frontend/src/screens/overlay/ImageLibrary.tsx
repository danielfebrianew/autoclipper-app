import { useEffect, useState } from 'react'
import { UploadSimpleIcon, TrashIcon, FilmSlateIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  addOverlayImage, deleteOverlayImage, addTrack,
  pickOverlayClip, pickOverlayImage,
  type OverlayImage, type OverlayTrack,
} from '../../store/slices/overlaySlice'
import { toastError, toastInfo, errText } from '../../lib/toast'
import { usePlayback } from './playback'

const DEFAULT_TRACK_DUR = 3 // seconds

// Find a start position at/after `from` that doesn't collide with existing tracks.
function resolveStart(from: number, dur: number, tracks: OverlayTrack[], maxDur: number): number {
  let start = Math.min(from, Math.max(0, maxDur - dur))
  const sorted = [...tracks].sort((a, b) => a.start_sec - b.start_sec)
  for (const t of sorted) {
    if (start < t.end_sec && start + dur > t.start_sec) start = t.end_sec
  }
  return Math.min(start, Math.max(0, maxDur - dur))
}

export default function ImageLibrary() {
  const dispatch = useAppDispatch()
  const images = useAppSelector(s => s.overlay.images)
  const current = useAppSelector(s => s.overlay.current)!
  const { currentTime, duration } = usePlayback()
  const [busy, setBusy] = useState(false)

  // Paste image from clipboard → add to library.
  useEffect(() => {
    function onPaste(ev: Event) {
      const e = ev as ClipboardEvent
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => { void dispatch(addOverlayImage(reader.result as string)) }
      reader.readAsDataURL(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  async function handlePickImage() {
    setBusy(true)
    try {
      await dispatch(pickOverlayImage()).unwrap()
    } catch (e) {
      toastError(errText(e, 'Gagal menambah gambar'))
    } finally {
      setBusy(false)
    }
  }

  function addImageTrack(img: OverlayImage) {
    const maxDur = duration || current.video_duration
    const dur = Math.min(DEFAULT_TRACK_DUR, maxDur)
    const start = resolveStart(currentTime, dur, current.tracks, maxDur)
    const track: OverlayTrack = {
      id: crypto.randomUUID(), kind: 'image',
      asset_path: img.path, asset_name: img.name,
      start_sec: start, end_sec: start + dur,
      trim_start_sec: 0, fit_override: '', click_enabled: null,
      sort_order: current.tracks.length,
    }
    dispatch(addTrack(track))
  }

  // Pick an overlay video clip via native dialog (returns OS path), then add it
  // to the timeline at the playhead.
  async function handlePickClip() {
    setBusy(true)
    try {
      const clip: any = await dispatch(pickOverlayClip()).unwrap()
      if (!clip?.id) return // cancelled
      const maxDur = duration || current.video_duration
      const dur = Math.min(DEFAULT_TRACK_DUR, maxDur)
      const start = resolveStart(currentTime, dur, current.tracks, maxDur)
      const track: OverlayTrack = {
        id: crypto.randomUUID(), kind: 'video',
        asset_path: clip.path, asset_name: clip.name,
        start_sec: start, end_sec: start + dur,
        trim_start_sec: 0, fit_override: '', click_enabled: null,
        sort_order: current.tracks.length,
      }
      dispatch(addTrack(track))
      toastInfo('Klip overlay ditambahkan di timeline')
    } catch (e) {
      toastError(errText(e, 'Gagal menambah klip'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={handlePickImage} disabled={busy} className="btn-ghost" style={{ fontSize: 12, padding: '8px', borderRadius: 8, gap: 6, justifyContent: 'center', border: '1px dashed var(--color-border)' }}>
        <UploadSimpleIcon size={14} /> {busy ? 'Menambah…' : 'Unggah / tempel (Ctrl+V) gambar'}
      </button>
      <button onClick={handlePickClip} disabled={busy} className="btn-ghost" style={{ fontSize: 12, padding: '8px', borderRadius: 8, gap: 6, justifyContent: 'center', border: '1px dashed var(--color-border)' }}>
        <FilmSlateIcon size={14} /> Tambah klip video overlay
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {images.map(img => (
          <div key={img.id} className="group" style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)', cursor: 'pointer' }}
            onClick={() => addImageTrack(img)}
            title={`${img.name} — klik untuk tambah di ${currentTime.toFixed(1)}s`}>
            <img src={'/media' + img.path} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              onClick={e => { e.stopPropagation(); dispatch(deleteOverlayImage(img.id)) }}
              style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 5, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <TrashIcon size={10} />
            </button>
          </div>
        ))}
      </div>
      {images.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-faint)', textAlign: 'center', padding: '8px 0' }}>
          Belum ada gambar. Unggah atau tempel dari clipboard.
        </div>
      )}
    </div>
  )
}
