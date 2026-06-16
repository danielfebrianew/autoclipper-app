import { useState } from 'react'
import { YoutubeLogoIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { useAppDispatch } from '../../store/hooks'
import { startDownload, fetchProjects } from '../../store/slices/projectSlice'
import { setActiveProject } from '../../store/slices/uiSlice'
import Spinner from '../../components/primitives/Spinner'
import { toastError, errText } from '../../lib/toast'

export default function EmptyState() {
  const dispatch = useAppDispatch()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    const trimmed = url.trim()
    if (!trimmed) { toastError('Tempel link YouTube terlebih dahulu'); return }
    if (!/youtube\.com\/watch\?|youtu\.be\//.test(trimmed)) {
      toastError('Link YouTube tidak valid'); return
    }
    setLoading(true)
    try {
      // StartDownload returns the new project ID (string).
      const projectId = await dispatch(startDownload(trimmed)).unwrap() as string
      await dispatch(fetchProjects())
      dispatch(setActiveProject(projectId))
    } catch (e) {
      toastError(errText(e, 'Gagal memulai download'))
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleStart()
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, fontFamily: 'var(--font-ui)' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, marginBottom: 36 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 18, margin: '0 auto 20px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <YoutubeLogoIcon size={28} color="var(--color-muted)" weight="fill" />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3, color: 'var(--color-text)', marginBottom: 8 }}>
          Mulai dari video YouTube
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          Tempel URL YouTube, Auto Clipper akan mengunduh video<br />dan menganalisis klip viral terbaik secara otomatis.
        </div>
      </div>

      <div style={{ display: 'flex', width: '100%', maxWidth: 440, gap: 10 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={handleKey}
          placeholder="https://youtube.com/watch?v=…"
          className="field"
          style={{ flex: 1, padding: '13px 16px', borderRadius: 13, fontSize: 14 }}
        />
        <button
          onClick={handleStart}
          disabled={!url.trim() || loading}
          className="btn-primary"
          style={{ padding: '12px 18px', borderRadius: 13, fontSize: 14, flexShrink: 0 }}
        >
          {loading ? <Spinner size={16} /> : <ArrowRightIcon size={18} weight="bold" />}
        </button>
      </div>
    </div>
  )
}
