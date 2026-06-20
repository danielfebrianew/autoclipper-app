import { useEffect } from 'react'
import { FilmReelIcon, TrashIcon, PlusIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchOverlayProjects, deleteOverlayProject, type OverlayProject } from '../../store/slices/overlaySlice'
import { openOverlayEditor, setScreen } from '../../store/slices/uiSlice'
import Spinner from '../../components/primitives/Spinner'

function ProjectCard({ p, onOpen, onDelete }: { p: OverlayProject; onOpen: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={onOpen}
      style={{
        position: 'relative', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        border: '1px solid var(--color-border)', background: 'var(--color-panel)',
      }}
    >
      <div style={{ aspectRatio: '16 / 9', background: 'rgba(255,255,255,0.04)', position: 'relative' }}>
        {p.source_video_path ? (
          <video src={`/media${p.source_video_path}#t=0.5`} preload="metadata" muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <FilmReelIcon size={26} color="var(--color-faint)" weight="duotone" />
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 3 }}>
          {p.tracks.length} overlay · {p.video_duration.toFixed(0)}s
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 7, border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <TrashIcon size={12} />
      </button>
    </div>
  )
}

export default function OverlayProjectList() {
  const dispatch = useAppDispatch()
  const { projects, loading } = useAppSelector(s => s.overlay)

  useEffect(() => { dispatch(fetchOverlayProjects()) }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, fontFamily: 'var(--font-ui)' }}>
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--color-border-soft)', gap: 10 }}>
        <FilmReelIcon size={18} color="var(--color-accent-hi)" weight="fill" />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Overlay Editor</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => dispatch(setScreen('gallery'))} className="btn-ghost" style={{ fontSize: 12.5, padding: '8px 13px', borderRadius: 10, gap: 6 }}>
          <PlusIcon size={14} weight="bold" /> Buat dari klip (Gallery)
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10 }}>
            <Spinner size={20} color="var(--color-accent-hi)" />
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Memuat…</span>
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, opacity: 0.6 }}>
            <FilmReelIcon size={36} color="var(--color-faint)" weight="duotone" />
            <span style={{ fontSize: 13.5, color: 'var(--color-faint)', textAlign: 'center', lineHeight: 1.5 }}>
              Belum ada project overlay.{'\n'}Buka tab Gallery, lalu klik "Overlay" pada sebuah klip.
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              p={p}
              onOpen={() => dispatch(openOverlayEditor(p.id))}
              onDelete={async () => { await dispatch(deleteOverlayProject(p.id)); dispatch(fetchOverlayProjects()) }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
