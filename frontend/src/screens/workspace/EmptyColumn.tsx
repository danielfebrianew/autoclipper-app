import { useState } from 'react'
import { LightningIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { useAppDispatch } from '../../store/hooks'
import { startDownload, fetchProjects } from '../../store/slices/projectSlice'
import { fetchLibrary, openDetail } from '../../store/slices/librarySlice'
import { setActiveProject, setScreen } from '../../store/slices/uiSlice'
import Spinner from '../../components/primitives/Spinner'
import { toastError, toastInfo, errText } from '../../lib/toast'

const YT_RE = /youtube\.com\/watch\?|youtu\.be\//

// Left column shown when no project is active: the "Aktivitas" placeholder with
// a paste-to-start input pinned at the bottom. Project list now lives in Library.
export default function EmptyColumn() {
  const dispatch = useAppDispatch()
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    const trimmed = url.trim()
    if (!trimmed) { toastError('Tempel link YouTube terlebih dahulu'); return }
    if (!YT_RE.test(trimmed)) { toastError('Link YouTube tidak valid'); return }
    setAdding(true)
    try {
      const res = await dispatch(startDownload(trimmed)).unwrap() as { project_id: string; video_exists: boolean; video_id: string }
      if (res.video_exists) {
        toastInfo('Video ini sudah pernah didownload. Buka Library untuk membuat klip baru.')
        dispatch(fetchLibrary())
        dispatch(setScreen('library'))
        dispatch(openDetail(res.video_id))
      } else {
        await dispatch(fetchProjects())
        dispatch(setActiveProject(res.project_id))
      }
      setUrl('')
    } catch (e) {
      toastError(errText(e, 'Gagal memulai download'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{
      width: 264, flexShrink: 0, borderRight: '1px solid var(--color-border-soft)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 16px 0' }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LightningIcon size={14} color="var(--color-accent-hi)" weight="fill" />
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Aktivitas</span>
      </div>

      {/* Empty body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <LightningIcon size={28} color="var(--color-faint)" weight="duotone" style={{ opacity: 0.5 }} />
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-muted)' }}>Belum ada aktivitas</div>
        <div style={{ fontSize: 12, color: 'var(--color-faint)', textAlign: 'center', lineHeight: 1.5 }}>
          Perintah & progress akan muncul di sini saat kamu mulai.
        </div>
      </div>

      {/* Paste input pinned at bottom */}
      <div style={{ padding: 12, borderTop: '1px solid var(--color-border-soft)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: 6, borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)',
        }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Paste link untuk mulai…"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13, color: 'var(--color-text)', paddingLeft: 6, fontFamily: 'var(--font-ui)',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !url.trim()}
            className="btn-primary"
            style={{ width: 32, height: 32, borderRadius: 9, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {adding ? <Spinner size={14} /> : <ArrowRightIcon size={15} weight="bold" />}
          </button>
        </div>
      </div>
    </div>
  )
}
