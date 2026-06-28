import { XIcon, ExportIcon, CheckIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { closeOverlay, openOverlay } from '../store/slices/uiSlice'
import { generateClips } from '../store/slices/clipSlice'
import { useState } from 'react'
import Spinner from '../components/primitives/Spinner'
import ProgressRing from '../components/primitives/ProgressRing'

const STAGE_LABELS: Record<string, string> = {
  reframe:   'Reframe 9:16',
  subtitle:  'Subtitle rendering',
  composite: 'Final export',
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60), sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function ExportOverlay() {
  const dispatch = useAppDispatch()
  const exportClipIds = useAppSelector(s => s.ui.exportClipIds)
  const { list: clips, generateProgress } = useAppSelector(s => s.clip)
  const activeProjectId = useAppSelector(s => s.ui.activeProjectId)

  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const targetClips = clips.filter(c => exportClipIds?.includes(c.id))

  async function handleExport() {
    if (!activeProjectId || targetClips.length === 0) return
    setRunning(true); setError('')
    try {
      await dispatch(generateClips({ projectId: activeProjectId, clipIds: targetClips.map(c => c.id) })).unwrap()
      setDone(true)
    } catch (e: any) {
      setError(e?.toString() ?? 'Ekspor gagal')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 bg-[rgba(8,6,13,0.82)] backdrop-blur-lg flex items-center justify-center font-ui"
      onClick={() => { if (!running) dispatch(closeOverlay()) }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-120 bg-panel-strong rounded-[22px] border border-border shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden animate-[acfadein_0.2s_ease-out]"
      >
        {/* Header */}
        <div className="flex items-center px-5 py-4.5 border-b border-border-soft">
          <span className="flex-1 text-[15px] font-bold text-text">
            Ekspor {targetClips.length} klip
          </span>
          <button onClick={() => dispatch(closeOverlay())} className="icon-btn" disabled={running}>
            <XIcon size={18} color="var(--color-muted)" />
          </button>
        </div>

        {/* Clip list */}
        <div className="max-h-75 overflow-y-auto px-3.5 py-3">
          {targetClips.map(clip => {
            const prog = generateProgress[clip.id]
            const clipDone = clip.status === 'done'
            const pct = prog?.percent ?? 0
            const stage = prog?.step ?? ''

            return (
              <div key={clip.id} className="flex items-center gap-3 px-2 py-2.75 rounded-[11px] mb-1">
                <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                  {clipDone
                    ? <div className="w-7 h-7 rounded-[10px] bg-[rgba(84,214,160,0.15)] border border-[rgba(84,214,160,0.35)] flex items-center justify-center"><CheckIcon size={14} color="var(--color-good)" weight="bold" /></div>
                    : prog ? <ProgressRing pct={pct} size={34} /> : <div className="w-7 h-7 rounded-[10px] bg-white/5 border border-border" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap">
                    {clip.hook || `Klip ${clip.clip_index + 1}`}
                  </div>
                  <div className="text-[11px] text-faint font-mono mt-0.5">
                    {clipDone ? 'selesai' : prog ? (STAGE_LABELS[stage] ?? stage) + ` ${Math.round(pct)}%` : fmtDur(clip.duration_seconds)}
                  </div>
                  {prog && !clipDone && (
                    <div className="mt-1.75 h-0.75 rounded-xs bg-white/[0.07] overflow-hidden">
                      <div
                        className="h-full rounded-xs bg-[linear-gradient(90deg,var(--color-accent-lo),var(--color-accent-hi))] transition-[width] duration-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mx-3.5 mb-1 px-3.5 py-2.5 rounded-[10px] bg-[rgba(255,107,102,0.1)] border border-[rgba(255,107,102,0.3)] text-[12.5px] text-bad flex items-center gap-2">
            <WarningCircleIcon size={15} /> {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2.5 px-5 py-4 border-t border-border-soft">
          <button className="btn-ghost flex-1 py-3 rounded-xl text-[14px]" onClick={() => dispatch(closeOverlay())} disabled={running}>
            {done ? 'Tutup' : 'Batal'}
          </button>
          {!done && (
            <button
              onClick={running ? () => dispatch(openOverlay('log')) : handleExport}
              className="btn-primary flex-2 py-3 rounded-xl text-[14px]"
              disabled={done}
            >
              {running ? <><Spinner size={15} /> Lihat log</> : <><ExportIcon size={16} weight="bold" /> Mulai ekspor</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
