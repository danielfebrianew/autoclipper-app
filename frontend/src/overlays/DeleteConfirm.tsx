import { TrashIcon } from '@phosphor-icons/react'
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
    <div
      className="absolute inset-0 z-50 bg-[rgba(8,6,13,0.82)] backdrop-blur-[14px] flex items-center justify-center font-ui"
      onClick={() => !loading && dispatch(closeOverlay())}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-95 bg-panel-strong rounded-[20px] border border-border shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden animate-[acfadein_0.18s_ease-out]"
      >
        {/* Icon row */}
        <div className="flex flex-col items-center px-6 pt-7 pb-5 gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-[rgba(255,107,102,0.12)] border border-[rgba(255,107,102,0.3)] flex items-center justify-center">
            <TrashIcon size={24} color="var(--color-bad)" weight="bold" />
          </div>
          <div className="text-center">
            <div className="text-[17px] font-extrabold text-text mb-2">
              {isProjectMode ? 'Hapus proyek?' : `Hapus ${targets.length} klip?`}
            </div>
            <div className="text-[13.5px] text-muted leading-[1.6]">
              {isProjectMode ? (
                <>"{targetProject?.name || 'Project'}" beserta semua klipnya akan dihapus permanen.</>
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
          <div className="mx-4 mb-4 px-3.5 py-2.5 rounded-xl bg-white/3 border border-border">
            {targets.slice(0, 4).map(c => (
              <div key={c.id} className="flex justify-between text-[12px] text-muted py-0.75">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[70%]">{c.hook || `Klip ${c.clip_index + 1}`}</span>
                <span className="font-mono text-faint">{fmtDur(c.duration_seconds)}</span>
              </div>
            ))}
            {targets.length > 4 && (
              <div className="text-[11.5px] text-faint mt-1">+{targets.length - 4} lainnya</div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 px-4 pb-4.5">
          <button
            onClick={() => dispatch(closeOverlay())}
            className="btn-ghost flex-1 py-3 rounded-xl text-[14px]"
            disabled={loading}
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            className="btn-danger flex-1 py-3 rounded-xl text-[14px]"
            disabled={loading}
          >
            {loading ? <Spinner size={15} /> : <><TrashIcon size={15} weight="bold" /> Hapus</>}
          </button>
        </div>
      </div>
    </div>
  )
}
