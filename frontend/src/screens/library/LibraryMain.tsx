import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { MagnifyingGlassIcon, CaretDownIcon, TrashIcon, HardDrivesIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  fetchLibrary, fetchStorage, deleteSourceVideo,
  redownloadSource, deleteAllSource,
  hideVideo, restoreVideo, openDetail,
  type LibraryVideo,
} from '../../store/slices/librarySlice'
import { toastError, toastSuccess, errText } from '../../lib/toast'
import Spinner from '../../components/primitives/Spinner'
import LibraryCard from './LibraryCard'
import LibraryDetail from './LibraryDetail'
import { cn } from '../../lib/cn'

const UNDO_DURATION = 5000

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
    <div className="flex items-center gap-2.5">
      <span className="text-[12px] text-muted font-ui whitespace-nowrap">
        {fmt(totalBytes)} / {storage.limit_gb} GB
      </span>
      <div className="w-25 h-1.5 rounded-[3px] bg-border overflow-hidden shrink-0">
        <div
          className={cn('h-full rounded-[3px]', pct > 85 ? 'bg-bad' : 'bg-[linear-gradient(90deg,var(--color-accent-lo),var(--color-accent-hi))]')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function LibraryMain() {
  const dispatch = useAppDispatch()
  const { list, loading, busyId, storage, detailVideoId } = useAppSelector(s => s.library)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  const [showSort, setShowSort] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)

  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    dispatch(fetchLibrary())
    dispatch(fetchStorage())
    return () => {
      pendingDeletes.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  if (detailVideoId) return <LibraryDetail />

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
    try {
      await dispatch(deleteSourceVideo(video.video_id)).unwrap()
    } catch (e) {
      toastError(errText(e, 'Gagal menghapus file'))
      return
    }
    dispatch(hideVideo(video.video_id))

    const toastId = `del-${video.video_id}`
    const timer = setTimeout(() => {
      pendingDeletes.current.delete(video.video_id)
      toast.dismiss(toastId)
      dispatch(fetchStorage())
    }, UNDO_DURATION)
    pendingDeletes.current.set(video.video_id, timer)

    const handleUndo = async () => {
      const t = pendingDeletes.current.get(video.video_id)
      if (t) { clearTimeout(t); pendingDeletes.current.delete(video.video_id) }
      toast.dismiss(toastId)
      try { await dispatch(redownloadSource(video.video_id)).unwrap() } catch {}
      dispatch(restoreVideo(video))
    }

    toast.custom(
      (t) => (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/93 border border-border text-[13px] font-ui backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.55)] max-w-95"
          style={{ background: 'rgba(20,16,32,0.95)', opacity: t.visible ? 1 : 0, transition: 'opacity .2s' }}
        >
          <TrashIcon size={15} color="var(--color-muted)" />
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            File sumber dihapus.
          </span>
          <button
            onClick={handleUndo}
            className="border-none bg-transparent cursor-pointer text-accent-hi text-[13px] font-bold font-ui px-1 py-0.5 rounded-sm shrink-0"
          >
            Undo
          </button>
        </div>
      ),
      { id: toastId, duration: UNDO_DURATION, position: 'bottom-right' }
    )
  }

  async function handleRedownload(videoId: string) {
    try {
      await dispatch(redownloadSource(videoId)).unwrap()
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
    <div className="flex-1 flex flex-col min-w-0 font-ui">
      {/* Header */}
      <div className="h-14 shrink-0 flex items-center gap-2.5 px-5 border-b border-border-soft">
        <div className="flex items-center gap-1.75 bg-white/5 border border-border rounded-[10px] px-2.75 py-1.5 flex-1 max-w-80">
          <MagnifyingGlassIcon size={14} color="var(--color-muted)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari judul atau URL…"
            className="border-none bg-transparent outline-none text-[13px] text-text w-full font-ui"
          />
        </div>

        <div className="relative">
          <button onClick={() => setShowSort(s => !s)} className="btn-ghost px-3 py-1.75 rounded-[10px] text-[13px] gap-1.25">
            {SORT_LABELS[sort]} <CaretDownIcon size={12} />
          </button>
          {showSort && (
            <div className="absolute top-full right-0 mt-1.5 z-30 bg-panel-strong border border-border rounded-xl p-1.5 min-w-35 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
              {(Object.keys(SORT_LABELS) as Sort[]).map(s => (
                <button
                  key={s}
                  onClick={() => { setSort(s); setShowSort(false) }}
                  className={cn(
                    'block w-full text-left px-3 py-2 rounded-lg border-none cursor-pointer text-[13px] font-ui',
                    sort === s ? 'bg-accent-soft text-accent-hi' : 'bg-transparent text-text',
                  )}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />
        <StorageBar storage={storage} />
        <button
          onClick={handleClearAll}
          disabled={clearingAll}
          className="btn-ghost px-3 py-1.75 rounded-[10px] text-[12.5px] gap-1.25 text-muted"
        >
          {clearingAll ? <Spinner size={13} /> : <TrashIcon size={13} />}
          Bersihkan semua source
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="flex items-center justify-center h-50 gap-2.5">
            <Spinner size={20} color="var(--color-accent-hi)" />
            <span className="text-[13px] text-muted">Memuat library…</span>
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-75 gap-3 opacity-55">
            <HardDrivesIcon size={36} color="var(--color-faint)" weight="duotone" />
            <span className="text-[13.5px] text-faint text-center leading-normal whitespace-pre-line">
              {search ? 'Tidak ada video yang cocok.' : 'Belum ada video yang didownload.\nMulai dari sebuah link di tab Workspace.'}
            </span>
          </div>
        )}

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {sorted.map(video => (
            <LibraryCard
              key={video.video_id}
              video={video}
              busy={busyId === video.video_id}
              onOpen={() => dispatch(openDetail(video.video_id))}
              onDelete={() => handleDelete(video)}
              onRedownload={() => handleRedownload(video.video_id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
