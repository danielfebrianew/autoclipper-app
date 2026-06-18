import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { MagnifyingGlassIcon, CaretDownIcon, TrashIcon, HardDrivesIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  fetchLibrary, fetchStorage, deleteSourceVideo, deleteProject,
  findMoreClips, redownloadSource, deleteAllSource,
  hideVideo, restoreVideo,
  type LibraryVideo,
} from '../../store/slices/librarySlice'
import { toastError, toastSuccess, errText } from '../../lib/toast'
import Spinner from '../../components/primitives/Spinner'
import LibraryCard from './LibraryCard'

const UNDO_DURATION = 5000 // ms

type Sort = 'newest' | 'largest' | 'longest' | 'name'
const SORT_LABELS: Record<Sort, string> = {
  newest: 'Terbaru', largest: 'Terbesar', longest: 'Terlama', name: 'Nama A–Z',
}

function StorageBar({ storage }: { storage: { limit_gb: number; categories: { size_bytes: number; color: string; key: string }[] } | null }) {
  if (!storage) return null
  const totalBytes = storage.categories.reduce((s, c) => s + c.size_bytes, 0)
  const limitBytes = (storage.limit_gb || 50) * 1024 * 1024 * 1024
  const pct = Math.min(100, (totalBytes / limitBytes) * 100)

  function fmt(n: number) {
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`
    return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>
        {fmt(totalBytes)} / {storage.limit_gb} GB
      </span>
      <div style={{ width: 100, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: pct > 85 ? 'var(--color-bad)' : 'linear-gradient(90deg, var(--color-accent-lo), var(--color-accent-hi))',
          width: `${pct}%`,
        }} />
      </div>
    </div>
  )
}

export default function LibraryMain() {
  const dispatch = useAppDispatch()
  const { list, loading, busyId, storage } = useAppSelector(s => s.library)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  const [showSort, setShowSort] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)

  // Track pending delete timers so we can cancel on undo
  // key = project_id, value = setTimeout handle
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    dispatch(fetchLibrary())
    dispatch(fetchStorage())
    // Cleanup pending timers on unmount
    return () => {
      pendingDeletes.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  const filtered = list.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase()) ||
    v.youtube_url.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'largest') return b.source_bytes - a.source_bytes
    if (sort === 'longest') return b.duration - a.duration
    return a.title.localeCompare(b.title)
  })

  async function handleDelete(video: LibraryVideo) {
    // 1. Delete the source file from disk immediately
    try {
      await dispatch(deleteSourceVideo(video.project_id)).unwrap()
    } catch (e) {
      toastError(errText(e, 'Gagal menghapus file'))
      return
    }

    // 2. Hide from UI immediately (optimistic)
    dispatch(hideVideo(video.project_id))

    // 3. Show undo toast — capture toastId so we can dismiss it on undo
    const toastId = `del-${video.project_id}`

    const scheduleCommit = () => {
      const timer = setTimeout(async () => {
        pendingDeletes.current.delete(video.project_id)
        toast.dismiss(toastId)
        // 4a. Toast expired → actually delete from DB
        try {
          await dispatch(deleteProject(video.project_id)).unwrap()
          dispatch(fetchStorage())
        } catch {
          // DB delete failed silently — video already not visible in UI
        }
      }, UNDO_DURATION)
      pendingDeletes.current.set(video.project_id, timer)
    }

    const handleUndo = () => {
      // Cancel the pending DB delete
      const timer = pendingDeletes.current.get(video.project_id)
      if (timer) {
        clearTimeout(timer)
        pendingDeletes.current.delete(video.project_id)
      }
      toast.dismiss(toastId)
      // Restore to UI
      dispatch(restoreVideo(video))
    }

    toast.custom(
      (t) => (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          borderRadius: 12,
          background: 'rgba(20,16,32,0.95)',
          color: 'rgba(255,255,255,0.93)',
          border: '1px solid var(--color-border)',
          fontSize: 13,
          fontFamily: 'var(--font-ui)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
          maxWidth: 380,
          opacity: t.visible ? 1 : 0,
          transition: 'opacity .2s',
        }}>
          <TrashIcon size={15} color="var(--color-muted)" />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Video dihapus.
          </span>
          <button
            onClick={handleUndo}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--color-accent-hi)', fontSize: 13, fontWeight: 700,
              fontFamily: 'var(--font-ui)', padding: '2px 4px', borderRadius: 4,
              flexShrink: 0,
            }}
          >
            Undo
          </button>
        </div>
      ),
      { id: toastId, duration: UNDO_DURATION, position: 'bottom-right' }
    )

    scheduleCommit()
  }

  async function handleFindMore(id: string) {
    try {
      await dispatch(findMoreClips(id)).unwrap()
    } catch (e) {
      toastError(errText(e, 'Gagal memulai pencarian klip'))
    }
  }

  async function handleRedownload(id: string) {
    try {
      await dispatch(redownloadSource(id)).unwrap()
    } catch (e) {
      toastError(errText(e, 'Gagal memulai download ulang'))
    }
  }

  async function handleClearAll() {
    setClearingAll(true)
    try {
      const freed = await dispatch(deleteAllSource()).unwrap() as number
      const gb = (freed / 1024 / 1024 / 1024).toFixed(1)
      toastSuccess(`Semua file source dihapus (${gb} GB dibebaskan). Klip yang sudah dirender tetap aman.`)
      dispatch(fetchStorage())
    } catch (e) {
      toastError(errText(e, 'Gagal menghapus file source'))
    } finally {
      setClearingAll(false)
    }
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Header */}
      <div style={{
        height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 20px', borderBottom: '1px solid var(--color-border-soft)',
      }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)',
          borderRadius: 10, padding: '6px 11px', flex: 1, maxWidth: 320,
        }}>
          <MagnifyingGlassIcon size={14} color="var(--color-muted)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari judul atau URL…"
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13, color: 'var(--color-text)', width: '100%',
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>

        {/* Sort */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSort(s => !s)}
            className="btn-ghost"
            style={{ padding: '7px 12px', borderRadius: 10, fontSize: 13, gap: 5 }}
          >
            {SORT_LABELS[sort]} <CaretDownIcon size={12} />
          </button>
          {showSort && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 30,
              background: 'var(--color-panel-strong)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 6, minWidth: 140,
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            }}>
              {(Object.keys(SORT_LABELS) as Sort[]).map(s => (
                <button
                  key={s}
                  onClick={() => { setSort(s); setShowSort(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontFamily: 'var(--font-ui)',
                    background: sort === s ? 'var(--color-accent-soft)' : 'transparent',
                    color: sort === s ? 'var(--color-accent-hi)' : 'var(--color-text)',
                  }}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Storage bar */}
        <StorageBar storage={storage} />

        {/* Clear all source */}
        <button
          onClick={handleClearAll}
          disabled={clearingAll}
          className="btn-ghost"
          style={{ padding: '7px 12px', borderRadius: 10, fontSize: 12.5, gap: 5, color: 'var(--color-muted)' }}
        >
          {clearingAll ? <Spinner size={13} /> : <TrashIcon size={13} />}
          Bersihkan semua source
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10 }}>
            <Spinner size={20} color="var(--color-accent-hi)" />
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Memuat library…</span>
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, opacity: 0.55 }}>
            <HardDrivesIcon size={36} color="var(--color-faint)" weight="duotone" />
            <span style={{ fontSize: 13.5, color: 'var(--color-faint)', textAlign: 'center', lineHeight: 1.5 }}>
              {search ? 'Tidak ada video yang cocok.' : 'Belum ada video yang didownload.\nTambah project di tab Workspace.'}
            </span>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {sorted.map(video => (
            <LibraryCard
              key={video.project_id}
              video={video}
              busy={busyId === video.project_id}
              onFindMore={() => handleFindMore(video.project_id)}
              onDelete={() => handleDelete(video)}
              onRedownload={() => handleRedownload(video.project_id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
