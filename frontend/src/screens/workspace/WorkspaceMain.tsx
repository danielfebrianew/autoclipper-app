import { useEffect, useState } from 'react'
import { SortAscendingIcon, ExportIcon, ScissorsIcon, CheckIcon, CaretDownIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchClips, toggleSelected, selectAll, clearSelected } from '../../store/slices/clipSlice'
import { openExport, openDelete, openPreview } from '../../store/slices/uiSlice'
import AppClipCard from '../../components/AppClipCard'
import Spinner from '../../components/primitives/Spinner'

type Sort = 'viral' | 'time' | 'duration'

const SORT_LABELS: Record<Sort, string> = {
  viral: 'Skor Viral', time: 'Waktu', duration: 'Durasi',
}

export default function WorkspaceMain() {
  const dispatch = useAppDispatch()
  const activeProjectId = useAppSelector(s => s.ui.activeProjectId)
  const { list: clips, selected, loading, generateProgress } = useAppSelector(s => s.clip)
  const [sort, setSort] = useState<Sort>('viral')
  const [showSortMenu, setShowSortMenu] = useState(false)

  useEffect(() => {
    if (activeProjectId) dispatch(fetchClips(activeProjectId))
  }, [activeProjectId])

  const myClips = clips.filter(c => c.project_id === activeProjectId)

  const sorted = [...myClips].sort((a, b) => {
    if (sort === 'viral') return b.viral_score - a.viral_score
    if (sort === 'time') return a.start_seconds - b.start_seconds
    return a.duration_seconds - b.duration_seconds
  })

  const allSelected = myClips.length > 0 && myClips.every(c => selected.includes(c.id))

  function toggleAll() {
    allSelected ? dispatch(clearSelected()) : dispatch(selectAll())
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, fontFamily: 'var(--font-ui)' }}>
      {/* Toolbar */}
      <div style={{
        height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 20px', borderBottom: '1px solid var(--color-border-soft)',
      }}>
        {/* Select all */}
        <button
          onClick={toggleAll}
          style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: allSelected ? 'var(--color-accent-soft)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${allSelected ? 'var(--color-accent-line)' : 'var(--color-border)'}`,
            cursor: 'pointer',
          }}
        >
          {allSelected && <CheckIcon size={11} color="var(--color-accent-hi)" weight="bold" />}
        </button>

        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          {myClips.length} klip{selected.length > 0 ? ` · ${selected.length} dipilih` : ''}
        </span>

        <div style={{ flex: 1 }} />

        {/* Sort */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSortMenu(s => !s)}
            className="btn-ghost"
            style={{ padding: '7px 12px', borderRadius: 10, fontSize: 13, gap: 6 }}
          >
            <SortAscendingIcon size={15} /> {SORT_LABELS[sort]} <CaretDownIcon size={12} />
          </button>
          {showSortMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 30,
              background: 'var(--color-panel-strong)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 6, minWidth: 140,
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            }}>
              {(Object.keys(SORT_LABELS) as Sort[]).map(s => (
                <button
                  key={s}
                  onClick={() => { setSort(s); setShowSortMenu(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                    background: sort === s ? 'var(--color-accent-soft)' : 'transparent',
                    color: sort === s ? 'var(--color-accent-hi)' : 'var(--color-text)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bulk actions */}
        {selected.length > 0 && (
          <>
            <button className="btn-ghost" onClick={() => dispatch(openDelete(selected))} style={{ padding: '7px 12px', borderRadius: 10, fontSize: 13 }}>
              <ScissorsIcon size={15} /> Hapus
            </button>
            <button className="btn-primary" onClick={() => dispatch(openExport(selected))} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13 }}>
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
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Memuat klip…</span>
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, opacity: 0.55 }}>
            <ScissorsIcon size={32} color="var(--color-faint)" />
            <span style={{ fontSize: 13.5, color: 'var(--color-faint)', textAlign: 'center', lineHeight: 1.5 }}>
              Belum ada klip untuk proyek ini.<br />Tunggu analisis selesai.
            </span>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 14,
        }}>
          {sorted.map(clip => (
            <AppClipCard
              key={clip.id}
              clip={clip}
              selected={selected.includes(clip.id)}
              progress={generateProgress[clip.id]}
              onToggleSelect={() => dispatch(toggleSelected(clip.id))}
              onPreview={() => dispatch(openPreview(clip.id))}
              onExport={() => dispatch(openExport([clip.id]))}
              onDelete={() => dispatch(openDelete([clip.id]))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
