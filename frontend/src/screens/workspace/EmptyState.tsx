import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CommandIcon, DownloadSimpleIcon, PlayIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { startDownload, fetchProjects } from '../../store/slices/projectSlice'
import { fetchLibrary, openDetail, type LibraryVideo } from '../../store/slices/librarySlice'
import { setActiveProject, setScreen } from '../../store/slices/uiSlice'
import Spinner from '../../components/primitives/Spinner'
import { toastError, errText } from '../../lib/toast'

const YT_RE = /youtube\.com\/watch\?|youtu\.be\//

export default function EmptyState() {
  const dispatch = useAppDispatch()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const recent = useAppSelector(s => s.library.list)

  useEffect(() => { dispatch(fetchLibrary()) }, [])

  // Toast that points the user to the Library to make a new clip set.
  function showExistsToast(videoId: string, title: string) {
    toast.custom((t) => (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
        background: 'rgba(20,16,32,0.96)', color: 'rgba(255,255,255,0.93)',
        border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'var(--font-ui)',
        backdropFilter: 'blur(12px)', boxShadow: '0 18px 50px rgba(0,0,0,0.55)', maxWidth: 420,
        opacity: t.visible ? 1 : 0, transition: 'opacity .2s',
      }}>
        <span style={{ flex: 1 }}>
          Video {title ? `"${title}" ` : ''}sudah pernah didownload.
        </span>
        <button
          onClick={() => { toast.dismiss(t.id); dispatch(setScreen('library')); dispatch(openDetail(videoId)) }}
          style={{
            border: 'none', background: 'var(--color-accent)', cursor: 'pointer', color: '#fff',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-ui)', padding: '6px 12px',
            borderRadius: 8, flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          Buat klip baru
        </button>
      </div>
    ), { duration: 7000, position: 'bottom-center' })
  }

  async function handleStart(link?: string) {
    const trimmed = (link ?? url).trim()
    if (!trimmed) { toastError('Tempel link YouTube terlebih dahulu'); return }
    if (!YT_RE.test(trimmed)) { toastError('Link YouTube tidak valid'); return }
    setLoading(true)
    try {
      const res = await dispatch(startDownload(trimmed)).unwrap() as { project_id: string; video_exists: boolean; video_id: string; video_title: string }
      if (res.video_exists) {
        showExistsToast(res.video_id, res.video_title)
      } else {
        await dispatch(fetchProjects())
        dispatch(setActiveProject(res.project_id))
      }
      setUrl('')
    } catch (e) {
      toastError(errText(e, 'Gagal memulai download'))
    } finally {
      setLoading(false)
    }
  }

  // Recent downloaded videos → quick chips. Clicking opens the Library detail.
  const recentChips = recent.slice(0, 3)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, fontFamily: 'var(--font-ui)' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18, marginBottom: 26,
        background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CommandIcon size={28} color="var(--color-accent-hi)" weight="bold" />
      </div>

      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6, color: 'var(--color-text)', marginBottom: 14, textAlign: 'center' }}>
        Mulai dari sebuah link
      </div>
      <div style={{ fontSize: 15, color: 'var(--color-muted)', lineHeight: 1.6, textAlign: 'center', maxWidth: 520, marginBottom: 34 }}>
        Tempel URL YouTube, Auto Clipper akan mengunduh, menganalisis, dan mengubahnya jadi klip vertikal siap-posting.
      </div>

      {/* Input + Download */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 660,
        padding: 8, borderRadius: 16, background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--color-border)',
      }}>
        <PlayIcon size={18} color="var(--color-faint)" weight="fill" style={{ marginLeft: 10, flexShrink: 0 }} />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          placeholder="https://youtube.com/watch?v=…"
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontSize: 15, color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
          }}
        />
        <button
          onClick={() => handleStart()}
          disabled={loading || !url.trim()}
          className="btn-primary"
          style={{ padding: '12px 22px', borderRadius: 11, fontSize: 14, gap: 7, flexShrink: 0 }}
        >
          {loading ? <Spinner size={16} /> : <DownloadSimpleIcon size={17} weight="bold" />}
          Download
        </button>
      </div>

      {/* Recent chips */}
      {recentChips.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'var(--color-faint)', fontFamily: 'var(--font-mono)' }}>terakhir:</span>
          {recentChips.map((v: LibraryVideo) => (
            <button
              key={v.video_id}
              onClick={() => { dispatch(setScreen('library')); dispatch(openDetail(v.video_id)) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--color-text)', maxWidth: 200,
              }}
            >
              {v.thumb_path
                ? <img src={`/media${v.thumb_path}`} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                : <PlayIcon size={13} color="var(--color-faint)" weight="fill" />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || 'Video'}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--color-faint)', fontFamily: 'var(--font-mono)', marginTop: 28 }}>
        atau tarik file video ke jendela ini
      </div>
    </div>
  )
}
