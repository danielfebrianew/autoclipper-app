import { TrashIcon, XIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { closeOverlay, setActiveProject } from '../store/slices/uiSlice'
import { removeClip, fetchClips } from '../store/slices/clipSlice'
import { deleteProject } from '../store/slices/projectSlice'
import { useState } from 'react'
import Spinner from '../components/primitives/Spinner'

function fmtDur(s: number): string {
  const m = Math.floor(s / 60), sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function DeleteConfirm() {
  const dispatch = useAppDispatch()
  const deleteClipIds = useAppSelector(s => s.ui.deleteClipIds)
  const deleteProjectId = useAppSelector(s => s.ui.deleteProjectId)
  const clips = useAppSelector(s => s.clip.list)
  const projects = useAppSelector(s => s.project.list)
  const activeProjectId = useAppSelector(s => s.ui.activeProjectId)

  const [loading, setLoading] = useState(false)

  // ── Mode hapus proyek ──
  const targetProject = deleteProjectId ? projects.find(p => p.id === deleteProjectId) : null
  const isProjectMode = !!deleteProjectId

  const targets = clips.filter(c => deleteClipIds?.includes(c.id))
  const totalDur = targets.reduce((acc, c) => acc + c.duration_seconds, 0)

  async function handleDeleteProject() {
    if (!deleteProjectId) return
    setLoading(true)
    try {
      await dispatch(deleteProject(deleteProjectId)).unwrap()
      if (activeProjectId === deleteProjectId) dispatch(setActiveProject(null))
      dispatch(closeOverlay())
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (isProjectMode) return handleDeleteProject()
    setLoading(true)
    try {
      await Promise.all(targets.map(c => dispatch(removeClip(c.id)).unwrap()))
      if (activeProjectId) await dispatch(fetchClips(activeProjectId))
      dispatch(closeOverlay())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(8,6,13,0.82)', backdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-ui)',
    }}
    onClick={() => !loading && dispatch(closeOverlay())}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, background: 'var(--color-panel-strong)', borderRadius: 20,
          border: '1px solid var(--color-border)', boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden', animation: 'acfadein 0.18s ease-out',
        }}
      >
        {/* Icon row */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px 20px', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,107,102,0.12)', border: '1px solid rgba(255,107,102,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrashIcon size={24} color="var(--color-bad)" weight="bold" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>
              {isProjectMode ? 'Hapus proyek?' : `Hapus ${targets.length} klip?`}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
              {isProjectMode ? (
                <>"{targetProject?.title || targetProject?.video_id}" beserta semua klipnya akan dihapus permanen.</>
              ) : targets.length === 1 ? (
                <>"{targets[0]?.hook || `Klip ${targets[0]?.clip_index + 1}`}" ({fmtDur(targets[0]?.duration_seconds ?? 0)}) akan dihapus permanen.</>
              ) : (
                <>Total {targets.length} klip ({fmtDur(totalDur)}) akan dihapus permanen.</>
              )}
            </div>
          </div>
        </div>

        {/* Size breakdown for multiple */}
        {!isProjectMode && targets.length > 1 && (
          <div style={{ margin: '0 16px 16px', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            {targets.slice(0, 4).map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-muted)', padding: '3px 0' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{c.hook || `Klip ${c.clip_index + 1}`}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-faint)' }}>{fmtDur(c.duration_seconds)}</span>
              </div>
            ))}
            {targets.length > 4 && (
              <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 4 }}>+{targets.length - 4} lainnya</div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, padding: '0 16px 18px' }}>
          <button
            onClick={() => dispatch(closeOverlay())}
            className="btn-ghost"
            disabled={loading}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14 }}
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            className="btn-danger"
            disabled={loading}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14 }}
          >
            {loading ? <Spinner size={15} /> : <><TrashIcon size={15} weight="bold" /> Hapus</>}
          </button>
        </div>
      </div>
    </div>
  )
}
