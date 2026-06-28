import { useEffect } from 'react'
import { ExportIcon, TrashIcon, CheckIcon, PlayIcon, FilmReelIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchGallery, toggleGalleryItem, selectAllGallery, clearGallerySelected, GalleryItem } from '../../store/slices/gallerySlice'
import { openExport, openDelete, openPlay, setActiveProject, setScreen, openOverlayEditor } from '../../store/slices/uiSlice'
import { createOverlayFromClip } from '../../store/slices/overlaySlice'
import { toastError, errText } from '../../lib/toast'
import ViralChip from '../../components/primitives/ViralChip'
import Spinner from '../../components/primitives/Spinner'
import { cn } from '../../lib/cn'

function fmtDur(s: number): string {
  const m = Math.floor(s / 60), sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function GalleryCard({ item, selected, onToggle, onOpen, onEditOverlay }: { item: GalleryItem; selected: boolean; onToggle: () => void; onOpen: () => void; onEditOverlay: () => void }) {
  return (
    <div className="cursor-pointer font-ui" onClick={onOpen}>
      <div className={cn(
        'relative rounded-[14px] p-0.75 transition-all duration-140',
        selected ? 'bg-accent-soft shadow-[0_0_0_1.5px_var(--color-accent)]' : 'bg-transparent shadow-none',
      )}>
        <div className="rounded-xl overflow-hidden relative bg-[linear-gradient(165deg,#1b1530,#120d1e)] border border-border" style={{ aspectRatio: '9/16' }}>
          {item.final_clip_path ? (
            <video
              src={`/media${item.final_clip_path}#t=0.5`}
              preload="metadata"
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_11px)]" />
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/12">
            <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-[6px] border border-white/25 flex items-center justify-center pl-0.75">
              <PlayIcon size={16} color="rgba(255,255,255,0.95)" weight="fill" />
            </div>
          </div>

          {/* Duration badge */}
          <div className="absolute right-1.75 bottom-1.75 font-mono text-[9px] text-white/80 bg-black/45 px-1.25 py-px rounded-[5px]">
            {fmtDur(item.duration_seconds)}
          </div>

          <ViralChip score={item.viral_score} float />

          {/* Checkbox */}
          <button
            onClick={e => { e.stopPropagation(); onToggle() }}
            className={cn(
              'absolute top-2 right-2 w-5.5 h-5.5 rounded-[7px] flex items-center justify-center cursor-pointer backdrop-blur-xs',
              selected ? 'bg-accent border-[1.5px] border-accent' : 'bg-black/40 border-[1.5px] border-white/45',
            )}
          >
            {selected && <CheckIcon size={13} color="#fff" weight="bold" />}
          </button>

          {/* Edit overlay button */}
          {item.final_clip_path && (
            <button
              onClick={e => { e.stopPropagation(); onEditOverlay() }}
              title="Edit overlay — tempel gambar/video konteks di bawah"
              className="absolute top-2 left-2 h-5.5 px-2 rounded-[7px] flex items-center gap-1 bg-black/45 backdrop-blur-xs border border-white/25 cursor-pointer text-[10px] font-semibold text-white/92 font-ui"
            >
              <FilmReelIcon size={12} weight="fill" /> Overlay
            </button>
          )}
        </div>
      </div>
      <div className="pt-2 px-1">
        <div className="text-[12px] font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap">
          {item.hook || 'Klip'}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-mono text-[8px] tracking-[0.3px] uppercase text-accent-hi bg-accent-soft px-1.25 py-0.5 rounded-[5px] border border-accent-line">
            {item.category}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function GalleryMain() {
  const dispatch = useAppDispatch()
  const { items, activeVid, selected, loading } = useAppSelector(s => s.gallery)

  useEffect(() => { dispatch(fetchGallery()) }, [])

  const filtered = activeVid === 'all' ? items : items.filter(i => i.project_id === activeVid)
  const allSelected = filtered.length > 0 && filtered.every(i => selected.includes(i.id))

  function toggleAll() {
    allSelected ? dispatch(clearGallerySelected()) : dispatch(selectAllGallery(filtered.map(i => i.id)))
  }

  const groups: Map<string, { title: string; items: GalleryItem[] }> = new Map()
  for (const item of filtered) {
    const key = activeVid === 'all' ? item.project_id : '__single'
    if (!groups.has(key)) groups.set(key, { title: item.source_title, items: [] })
    groups.get(key)!.items.push(item)
  }

  function openProjectWorkspace(projectId: string) {
    dispatch(setActiveProject(projectId))
    dispatch(setScreen('workspace'))
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 font-ui">
      {/* Toolbar */}
      <div className="h-12.5 shrink-0 flex items-center gap-2.5 px-5 border-b border-border-soft">
        <button
          onClick={toggleAll}
          className={cn(
            'w-5.5 h-5.5 rounded-[7px] shrink-0 flex items-center justify-center border cursor-pointer',
            allSelected ? 'bg-accent-soft border-accent-line' : 'bg-white/5 border-border',
          )}
        >
          {allSelected && <CheckIcon size={11} color="var(--color-accent-hi)" weight="bold" />}
        </button>
        <span className="text-[13px] text-muted">
          {filtered.length} klip{selected.length > 0 ? ` · ${selected.length} dipilih` : ''}
        </span>
        <div className="flex-1" />
        {selected.length > 0 && (
          <>
            <button className="btn-ghost px-3 py-1.75 rounded-[10px] text-[13px] gap-1.5" onClick={() => dispatch(openDelete(selected))}>
              <TrashIcon size={15} /> Hapus
            </button>
            <button className="btn-primary px-3.5 py-2 rounded-[10px] text-[13px] gap-1.5" onClick={() => dispatch(openExport(selected))}>
              <ExportIcon size={15} weight="bold" /> Ekspor ({selected.length})
            </button>
          </>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="flex items-center justify-center h-50 gap-2.5">
            <Spinner size={20} color="var(--color-accent-hi)" />
            <span className="text-[13px] text-muted">Memuat galeri…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-75 gap-3 opacity-55">
            <PlayIcon size={32} color="var(--color-faint)" />
            <span className="text-[13.5px] text-faint text-center">
              Belum ada klip di galeri.
            </span>
          </div>
        )}

        {Array.from(groups.entries()).map(([key, g]) => (
          <div key={key} className="mb-7">
            {activeVid === 'all' && (
              <div className="flex items-center gap-2.5 mb-3.5">
                <span className="text-[13px] font-bold text-text overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                  {g.title || key.slice(0, 8)}
                </span>
                <span className="font-mono text-[10.5px] text-faint">{g.items.length} klip</span>
                <button
                  onClick={() => openProjectWorkspace(key)}
                  className="btn-ghost px-2.5 py-1.25 rounded-lg text-[11px]"
                >
                  Buka workspace
                </button>
              </div>
            )}
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {g.items.map(item => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  selected={selected.includes(item.id)}
                  onToggle={() => dispatch(toggleGalleryItem(item.id))}
                  onOpen={() => {
                    if (item.final_clip_path) {
                      dispatch(openPlay({ path: item.final_clip_path, title: item.hook || 'Klip' }))
                    }
                  }}
                  onEditOverlay={async () => {
                    try {
                      const proj: any = await dispatch(createOverlayFromClip(item.id)).unwrap()
                      dispatch(openOverlayEditor(proj.id))
                    } catch (e) {
                      toastError(errText(e, 'Gagal membuka editor overlay'))
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
