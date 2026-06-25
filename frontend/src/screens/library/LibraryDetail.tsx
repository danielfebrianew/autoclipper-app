import { useEffect, useState } from 'react'
import {
  ArrowLeftIcon, SparkleIcon, StackIcon, CaretRightIcon, TrashIcon, FilmReelIcon,
} from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  fetchProjectsByVideo, makeMoreClips, deleteLibraryProject, closeDetail, fetchLibrary,
  type LibraryProject,
} from '../../store/slices/librarySlice'
import { setActiveProject, setScreen } from '../../store/slices/uiSlice'
import { toastError, toastSuccess, errText } from '../../lib/toast'
import Spinner from '../../components/primitives/Spinner'

function statusLabel(s: string): { text: string; color: string } {
  switch (s) {
    case 'ready': return { text: 'Siap', color: 'var(--color-good)' }
    case 'done': return { text: 'Selesai', color: 'var(--color-good)' }
    case 'error': return { text: 'Gagal', color: 'var(--color-bad)' }
    case 'analyzing': return { text: 'Menganalisis…', color: 'var(--color-accent-hi)' }
    case 'pending': return { text: 'Menunggu…', color: 'var(--color-muted)' }
    default: return { text: s, color: 'var(--color-muted)' }
  }
}

function ProjectRow({ p, index, onOpen, onDelete }: { p: LibraryProject; index: number; onOpen: () => void; onDelete: () => void }) {
  const st = statusLabel(p.status)
  const busy = p.status === 'analyzing' || p.status === 'pending'
  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
        border: '1px solid var(--color-border)', background: 'var(--color-panel)', cursor: 'pointer',
        transition: 'border-color .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-accent-soft)', color: 'var(--color-accent-hi)', fontWeight: 700, fontSize: 13,
      }}>
        {busy ? <Spinner size={15} color="var(--color-accent-hi)" /> : index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.name || `Set klip #${index + 1}`}
        </div>
        <div style={{ fontSize: 11.5, marginTop: 2, color: st.color }}>{st.text}</div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="btn-ghost"
        style={{ padding: 6, borderRadius: 8, color: 'var(--color-muted)' }}
        title="Hapus set klip ini"
      >
        <TrashIcon size={14} />
      </button>
      <CaretRightIcon size={15} color="var(--color-faint)" />
    </div>
  )
}

export default function LibraryDetail() {
  const dispatch = useAppDispatch()
  const detailVideoId = useAppSelector(s => s.library.detailVideoId)!
  const video = useAppSelector(s => s.library.list.find(v => v.video_id === detailVideoId))
  const { detailProjects, detailLoading } = useAppSelector(s => s.library)
  const [making, setMaking] = useState(false)

  useEffect(() => {
    dispatch(fetchProjectsByVideo(detailVideoId))
  }, [detailVideoId])

  function openProject(projectId: string) {
    dispatch(setActiveProject(projectId))
    dispatch(setScreen('workspace'))
  }

  async function handleMakeMore() {
    setMaking(true)
    try {
      await dispatch(makeMoreClips(detailVideoId)).unwrap()
      toastSuccess('Mencari klip baru… project baru akan muncul sebentar lagi.')
      // Give the backend a beat to create the project row, then refresh.
      setTimeout(() => dispatch(fetchProjectsByVideo(detailVideoId)), 600)
    } catch (e) {
      toastError(errText(e, 'Gagal membuat set klip baru'))
    } finally {
      setMaking(false)
    }
  }

  async function handleDeleteProject(projectId: string) {
    try {
      await dispatch(deleteLibraryProject(projectId)).unwrap()
      dispatch(fetchLibrary())
    } catch (e) {
      toastError(errText(e, 'Gagal menghapus set klip'))
    }
  }

  const thumbSrc = video?.thumb_path ? `/media${video.thumb_path}` : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, fontFamily: 'var(--font-ui)' }}>
      {/* Header */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: '1px solid var(--color-border-soft)' }}>
        <button onClick={() => dispatch(closeDetail())} className="btn-ghost" style={{ padding: '7px 12px', borderRadius: 10, fontSize: 13, gap: 6 }}>
          <ArrowLeftIcon size={15} /> Library
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleMakeMore}
          disabled={making || !video?.file_exists}
          className="btn-primary"
          style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, gap: 6, opacity: video?.file_exists ? 1 : 0.5 }}
          title={video?.file_exists ? 'Cari klip berbeda dari yang sudah ada' : 'File sumber hilang — download ulang dulu'}
        >
          {making ? <Spinner size={14} /> : <SparkleIcon size={15} weight="bold" />}
          Buat klip baru
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Video summary */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 200, aspectRatio: '16/9', flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {thumbSrc ? (
              <img src={thumbSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : video?.file_exists && video.video_path ? (
              // No rendered-clip thumbnail yet → show a frame of the source video.
              <video
                src={`/media${video.video_path}#t=2`}
                preload="metadata"
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <FilmReelIcon size={30} color="var(--color-faint)" weight="duotone" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {video?.title || video?.youtube_url || 'Video'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <StackIcon size={14} /> {detailProjects.length} set klip · {video?.clip_count ?? 0} klip total
            </div>
            {!video?.file_exists && (
              <div style={{ fontSize: 12, color: 'var(--color-bad)', marginTop: 8 }}>
                File sumber tidak ada di disk — download ulang untuk membuat klip baru.
              </div>
            )}
          </div>
        </div>

        {/* Projects list */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--color-faint)', marginBottom: 10 }}>
          Set klip (project)
        </div>

        {detailLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 10 }}>
            <Spinner size={18} color="var(--color-accent-hi)" />
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Memuat…</span>
          </div>
        ) : detailProjects.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-faint)', padding: '20px 0', textAlign: 'center' }}>
            Belum ada set klip. Klik "Buat klip baru" untuk menganalisis video ini.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
            {detailProjects.map((p, i) => (
              <ProjectRow
                key={p.id}
                p={p}
                index={i}
                onOpen={() => openProject(p.id)}
                onDelete={() => handleDeleteProject(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
