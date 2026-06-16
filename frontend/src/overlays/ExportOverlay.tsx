import { XIcon, ExportIcon, CheckIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { closeOverlay, openOverlay } from '../store/slices/uiSlice'
import { generateClips } from '../store/slices/clipSlice'
import { useState } from 'react'
import Spinner from '../components/primitives/Spinner'
import ProgressRing from '../components/primitives/ProgressRing'

const STAGES = ['reframe', 'subtitle', 'composite'] as const

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
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(8,6,13,0.82)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-ui)',
    }}
    onClick={() => { if (!running) dispatch(closeOverlay()) }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, background: 'var(--color-panel-strong)', borderRadius: 22,
          border: '1px solid var(--color-border)', boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden', animation: 'acfadein 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--color-border-soft)' }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            Ekspor {targetClips.length} klip
          </span>
          <button onClick={() => dispatch(closeOverlay())} className="icon-btn" disabled={running}>
            <XIcon size={18} color="var(--color-muted)" />
          </button>
        </div>

        {/* Clip list */}
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '12px 14px' }}>
          {targetClips.map(clip => {
            const prog = generateProgress[clip.id]
            const clipDone = clip.status === 'done'
            const pct = prog?.percent ?? 0
            const stage = prog?.step ?? ''

            return (
              <div key={clip.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', borderRadius: 11, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {clipDone
                    ? <div style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(84,214,160,0.15)', border: '1px solid rgba(84,214,160,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckIcon size={14} color="var(--color-good)" weight="bold" /></div>
                    : prog ? <ProgressRing pct={pct} size={34} /> : <div style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {clip.hook || `Klip ${clip.clip_index + 1}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {clipDone ? 'selesai' : prog ? (STAGE_LABELS[stage] ?? stage) + ` ${Math.round(pct)}%` : fmtDur(clip.duration_seconds)}
                  </div>
                  {prog && !clipDone && (
                    <div style={{ marginTop: 7, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,var(--color-accent-lo),var(--color-accent-hi))', transition: 'width .2s', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {error && (
          <div style={{ margin: '0 14px', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,107,102,0.1)', border: '1px solid rgba(255,107,102,0.3)', fontSize: 12.5, color: 'var(--color-bad)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <WarningCircleIcon size={15} /> {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderTop: '1px solid var(--color-border-soft)' }}>
          <button className="btn-ghost" onClick={() => dispatch(closeOverlay())} disabled={running} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14 }}>
            {done ? 'Tutup' : 'Batal'}
          </button>
          {!done && (
            <button
              onClick={running ? () => dispatch(openOverlay('log')) : handleExport}
              className="btn-primary"
              disabled={done}
              style={{ flex: 2, padding: '12px 0', borderRadius: 12, fontSize: 14 }}
            >
              {running ? <><Spinner size={15} /> Lihat log</> : <><ExportIcon size={16} weight="bold" /> Mulai ekspor</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
