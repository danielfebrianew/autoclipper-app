import { useEffect } from 'react'
import { ImageIcon, HardDrivesIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchGallery, setActiveVid, GalleryItem } from '../../store/slices/gallerySlice'
import { cn } from '../../lib/cn'

function groupByProject(items: GalleryItem[]): Map<string, { title: string; items: GalleryItem[] }> {
  const map = new Map<string, { title: string; items: GalleryItem[] }>()
  for (const item of items) {
    if (!map.has(item.project_id)) {
      map.set(item.project_id, { title: item.source_title, items: [] })
    }
    map.get(item.project_id)!.items.push(item)
  }
  return map
}

export function GalleryColumn() {
  const dispatch = useAppDispatch()
  const { items, activeVid, loading } = useAppSelector(s => s.gallery)

  useEffect(() => { dispatch(fetchGallery()) }, [])

  const groups = groupByProject(items)
  const totalDur = items.reduce((a, c) => a + c.duration_seconds, 0)
  const durMin = Math.round(totalDur / 60)

  return (
    <div className="w-66 shrink-0 border-r border-border-soft flex flex-col font-ui">
      {/* Header */}
      <div className="px-3.5 pt-4 pb-2.5 border-b border-border-soft">
        <div className="flex items-center gap-2 mb-3.5">
          <ImageIcon size={14} color="var(--color-faint)" />
          <span className="text-[10.5px] font-bold tracking-[0.7px] uppercase text-faint">
            Galeri
          </span>
        </div>

        {/* Storage mini-bar */}
        <div className="bg-white/4 rounded-xl px-3.25 py-2.75">
          <div className="flex items-center gap-2 mb-2">
            <HardDrivesIcon size={13} color="var(--color-muted)" />
            <span className="text-[12px] font-semibold text-muted flex-1">Penyimpanan</span>
            <span className="font-mono text-[10.5px] text-faint">{durMin} mnt</span>
          </div>
          <div className="h-1 rounded-[3px] bg-white/8 overflow-hidden">
            <div className="h-full w-[32%] bg-[linear-gradient(90deg,var(--color-accent-lo),var(--color-accent-hi))] rounded-[3px]" />
          </div>
          <div className="mt-1.25 text-[10px] text-ghost font-mono">
            {items.length} klip tersimpan
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {/* All */}
        <button
          onClick={() => dispatch(setActiveVid('all'))}
          className={cn(
            'flex items-center gap-2.5 w-full px-2.5 py-2.5 rounded-[11px] border-none cursor-pointer mb-1 text-left',
            activeVid === 'all' ? 'bg-accent-soft' : 'bg-transparent hover:bg-white/4',
          )}
        >
          <VideoCameraIcon size={15} color={activeVid === 'all' ? 'var(--color-accent-hi)' : 'var(--color-muted)'} weight="fill" />
          <span className={cn('text-[13px] font-semibold flex-1', activeVid === 'all' ? 'text-text' : 'text-muted')}>Semua klip</span>
          <span className="font-mono text-[10.5px] text-faint">{items.length}</span>
        </button>

        {/* Per project */}
        {loading && <div className="text-[12.5px] text-faint pl-2">Memuat…</div>}
        {Array.from(groups.entries()).map(([pid, g]) => (
          <button
            key={pid}
            onClick={() => dispatch(setActiveVid(pid))}
            className={cn(
              'flex flex-col gap-0.75 w-full px-2.5 py-2.5 rounded-[11px] border-none cursor-pointer mb-0.75 text-left',
              activeVid === pid ? 'bg-accent-soft' : 'bg-transparent hover:bg-white/4',
            )}
          >
            <div className="flex items-center gap-1.75">
              <span className={cn('text-[12.5px] font-semibold flex-1 overflow-hidden text-ellipsis whitespace-nowrap', activeVid === pid ? 'text-text' : 'text-muted')}>
                {g.title || pid.slice(0, 8)}
              </span>
              <span className="font-mono text-[10px] text-faint shrink-0">{g.items.length}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
