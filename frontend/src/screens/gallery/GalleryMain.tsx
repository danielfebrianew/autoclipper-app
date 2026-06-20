import { useEffect } from 'react'
import { ExportIcon, TrashIcon, CheckIcon, PlayIcon, FilmReelIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchGallery, toggleGalleryItem, selectAllGallery, clearGallerySelected, GalleryItem } from '../../store/slices/gallerySlice'
import { openExport, openDelete, openPlay, setActiveProject, setScreen, openOverlayEditor } from '../../store/slices/uiSlice'
import { createOverlayFromClip } from '../../store/slices/overlaySlice'
import { toastError, errText } from '../../lib/toast'
import ViralChip from '../../components/primitives/ViralChip'
import Spinner from '../../components/primitives/Spinner'

function fmtDur(s: number): string {
  const m = Math.floor(s / 60), sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function GalleryCard({ item, selected, onToggle, onOpen, onEditOverlay }: { item: GalleryItem; selected: boolean; onToggle: () => void; onOpen: () => void; onEditOverlay: () => void }) {
  const w = '100%'
  return (
    <div style={{ cursor: 'pointer', fontFamily: 'var(--font-ui)' }} onClick={onOpen}>
      <div style={{
        position: 'relative', borderRadius: 14, padding: 3,
        boxShadow: selected ? '0 0 0 1.5px var(--color-accent)' : 'none',
        background: selected ? 'var(--color-accent-soft)' : 'transparent',
        transition: 'all .14s',
      }}>
        <div style={{
          borderRadius: 12, aspectRatio: '9/16', overflow: 'hidden', position: 'relative',
          background: 'linear-gradient(165deg,#1b1530,#120d1e)',
          border: '1px solid var(--color-border)',
        }}>
          {/* Thumbnail: frame pertama klip final via /media. preload=metadata
              membuat browser menampilkan poster frame tanpa memuat full video. */}
          {item.final_clip_path ? (
            <video
              src={`/media${item.final_clip_path}#t=0.5`}
              preload="metadata"
              muted
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,rgba(255,255,255,0.03) 0 1px,transparent 1px 11px)' }} />
          )}
          {/* Play overlay */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 }}>
              <PlayIcon size={16} color="rgba(255,255,255,0.95)" weight="fill" />
            </div>
          </div>
          {/* Duration badge */}
          <div style={{ position: 'absolute', right: 7, bottom: 7, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.45)', padding: '1px 5px', borderRadius: 5 }}>
            {fmtDur(item.duration_seconds)}
          </div>
          {/* ViralChip */}
          <ViralChip score={item.viral_score} float />
          {/* Checkbox */}
          <button
            onClick={e => { e.stopPropagation(); onToggle() }}
            style={{
              position: 'absolute', top: 8, right: 8,
              width: 22, height: 22, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: selected ? 'var(--color-accent)' : 'rgba(0,0,0,0.4)',
              border: `1.5px solid ${selected ? 'var(--color-accent)' : 'rgba(255,255,255,0.45)'}`,
              backdropFilter: 'blur(4px)',
              cursor: 'pointer',
            }}
          >
            {selected && <CheckIcon size={13} color="#fff" weight="bold" />}
          </button>
          {/* Edit overlay (tempel konteks) */}
          {item.final_clip_path && (
            <button
              onClick={e => { e.stopPropagation(); onEditOverlay() }}
              title="Edit overlay — tempel gambar/video konteks di bawah"
              style={{
                position: 'absolute', top: 8, left: 8,
                height: 22, padding: '0 8px', borderRadius: 7,
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer',
                fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.92)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <FilmReelIcon size={12} weight="fill" /> Overlay
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: '8px 4px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.hook || 'Klip'}
        </div>
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--color-accent-hi)', background: 'var(--color-accent-soft)', padding: '2px 5px', borderRadius: 5, border: '1px solid var(--color-accent-line)' }}>
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

  // Group by project_title for headers
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, fontFamily: 'var(--font-ui)' }}>
      {/* Toolbar */}
      <div style={{ height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderBottom: '1px solid var(--color-border-soft)' }}>
        <button
          onClick={toggleAll}
          style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: allSelected ? 'var(--color-accent-soft)' : 'rgba(255,255,255,0.05)', border: `1px solid ${allSelected ? 'var(--color-accent-line)' : 'var(--color-border)'}`, cursor: 'pointer' }}
        >
          {allSelected && <CheckIcon size={11} color="var(--color-accent-hi)" weight="bold" />}
        </button>
        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          {filtered.length} klip{selected.length > 0 ? ` · ${selected.length} dipilih` : ''}
        </span>
        <div style={{ flex: 1 }} />
        {selected.length > 0 && (
          <>
            <button className="btn-ghost" onClick={() => dispatch(openDelete(selected))} style={{ padding: '7px 12px', borderRadius: 10, fontSize: 13, gap: 6 }}>
              <TrashIcon size={15} /> Hapus
            </button>
            <button className="btn-primary" onClick={() => dispatch(openExport(selected))} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, gap: 6 }}>
              <ExportIcon size={15} weight="bold" /> Ekspor ({selected.length})
            </button>
          </>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10 }}>
            <Spinner size={20} color="var(--color-accent-hi)" />
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Memuat galeri…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, opacity: 0.55 }}>
            <PlayIcon size={32} color="var(--color-faint)" />
            <span style={{ fontSize: 13.5, color: 'var(--color-faint)', textAlign: 'center' }}>
              Belum ada klip di galeri.
            </span>
          </div>
        )}

        {Array.from(groups.entries()).map(([key, g]) => (
          <div key={key} style={{ marginBottom: 28 }}>
            {/* Group header (only shown in "all" mode) */}
            {activeVid === 'all' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {g.title || key.slice(0, 8)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-faint)' }}>{g.items.length} klip</span>
                <button
                  onClick={() => openProjectWorkspace(key)}
                  className="btn-ghost"
                  style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11 }}
                >
                  Buka workspace
                </button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
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
