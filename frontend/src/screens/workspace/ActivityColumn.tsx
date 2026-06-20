import { useEffect, useRef, useState } from 'react'
import {
  YoutubeLogoIcon, ScissorsIcon, SparkleIcon, ExportIcon, LightningIcon,
  PlusIcon, ArrowRightIcon, CheckIcon, XIcon, WarningCircleIcon, TrashIcon,
} from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchProjects, startDownload } from '../../store/slices/projectSlice'
import { fetchClips, generateClips } from '../../store/slices/clipSlice'
import { fetchLibrary, openDetail } from '../../store/slices/librarySlice'
import { setActiveProject, openOverlay, setScreen } from '../../store/slices/uiSlice'
import Spinner from '../../components/primitives/Spinner'
import { toastError, toastInfo, errText } from '../../lib/toast'
import { useSmoothValue } from '../../lib/useSmoothValue'

/** Thin progress bar inside an active thread step, smoothly animated. */
function StepProgressBar({ percent }: { percent: number }) {
  const v = useSmoothValue(percent)
  return (
    <>
      <div style={{
        marginTop: 6, height: 3, borderRadius: 2,
        background: 'var(--color-border)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'linear-gradient(90deg, var(--color-accent-lo), var(--color-accent-hi))',
          width: `${v}%`,
        }} />
      </div>
      <div style={{
        fontSize: 10, color: 'var(--color-accent-hi)',
        fontFamily: 'var(--font-mono)', marginTop: 3,
      }}>
        {v.toFixed(0)}%
      </div>
    </>
  )
}

/** Translucent fill behind a project row in the sidebar, smoothly animated. */
function RowProgressFill({ percent }: { percent: number }) {
  const v = useSmoothValue(percent)
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      background: 'rgba(123,97,255,0.08)',
      width: `${v}%`, borderRadius: 10,
    }} />
  )
}

interface ThreadStep {
  icon: React.ElementType
  label: string
  status: 'done' | 'active' | 'pending' | 'error'
  detail?: string
  progress?: number // 0-100
}

function getSteps(
  project: any,
  dp?: { step: string; percent: number; message: string },
): ThreadStep[] {
  const s = project.status as string
  const isDone  = (steps: string[]) => steps.includes(s)
  const isErr   = s.startsWith('error')

  return [
    {
      icon: YoutubeLogoIcon,
      label: 'Download video',
      status: isDone(['downloaded', 'analyzing', 'analyzed', 'ready', 'transcript']) ? 'done'
        : s === 'downloading' || s === 'metadata' ? 'active'
        : isErr ? 'error' : 'pending',
      detail: s === 'downloading'
        ? (dp?.message ?? 'Mengunduh…')
        : s === 'metadata' ? 'Mengambil metadata…' : undefined,
      progress: s === 'downloading' ? dp?.percent : undefined,
    },
    {
      icon: ScissorsIcon,
      label: 'Transkripsi',
      status: isDone(['analyzed', 'ready']) ? 'done'
        : s === 'transcript' || s === 'analyzing' ? 'active'
        : isErr ? 'error' : 'pending',
      detail: s === 'transcript' ? 'Mengambil transkrip…' : undefined,
    },
    {
      icon: SparkleIcon,
      label: 'Analisis Gemini',
      status: isDone(['ready']) ? 'done'
        : s === 'analyzing' ? 'active'
        : isErr ? 'error' : 'pending',
      detail: s === 'analyzing' ? 'Menganalisis dengan AI…' : undefined,
    },
  ]
}

const REVEAL_WIDTH = 56   // lebar tombol Hapus yang ter-reveal
const DRAG_THRESHOLD = 28 // px geseran minimum untuk snap "open"

/** Satu baris proyek yang bisa di-swipe ke kiri untuk reveal tombol Hapus. */
function ProjectRow({
  project, isActive, isRunning, pdp, onSelect, onDelete,
}: {
  project: any
  isActive: boolean
  isRunning: boolean
  pdp?: { percent: number }
  onSelect: () => void
  onDelete: () => void
}) {
  const [dx, setDx]       = useState(0)
  const [dragging, setDragging] = useState(false)
  const open = dx <= -DRAG_THRESHOLD
  const moved = useRef(false)

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    const startX = e.clientX
    moved.current = false
    setDragging(true)

    const move = (ev: MouseEvent) => {
      const next = Math.max(-REVEAL_WIDTH, Math.min(0, ev.clientX - startX))
      if (Math.abs(ev.clientX - startX) > 3) moved.current = true
      setDx(next)
    }
    const up = () => {
      setDragging(false)
      setDx(prev => (prev <= -DRAG_THRESHOLD ? -REVEAL_WIDTH : 0))
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // tutup saat klik di luar baris yang sedang terbuka
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (dx === 0) return
    const onDocDown = (ev: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(ev.target as Node)) setDx(0)
    }
    window.addEventListener('mousedown', onDocDown)
    return () => window.removeEventListener('mousedown', onDocDown)
  }, [dx])

  return (
    <div
      ref={rowRef}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: 10, marginBottom: 2 }}
    >
      {/* layer belakang: tombol Hapus */}
      <button
        onClick={() => { setDx(0); onDelete() }}
        title="Hapus proyek"
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: REVEAL_WIDTH,
          border: 'none', cursor: 'pointer', borderRadius: 10,
          background: 'rgba(255,107,102,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: dx < 0 ? 1 : 0, transition: dragging ? 'none' : 'opacity .18s',
        }}
      >
        <TrashIcon size={16} color="var(--color-bad)" weight="bold" />
      </button>

      {/* layer depan: baris yang bergeser */}
      <button
        onMouseDown={onMouseDown}
        onClick={() => { if (!moved.current && dx === 0) onSelect() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '9px 10px', borderRadius: 10, width: '100%',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          background: isActive ? 'var(--color-accent-soft)' : 'var(--color-bg)',
          position: 'relative', overflow: 'hidden',
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform .18s',
        }}
        onMouseEnter={e => { if (!isActive && dx === 0) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-bg)' }}
      >
        {/* download progress fill behind the row */}
        {isRunning && pdp?.percent != null && (
          <RowProgressFill percent={pdp.percent} />
        )}
        <YoutubeLogoIcon
          size={14} weight="fill" style={{ position: 'relative', zIndex: 1 }}
          color={isActive ? 'var(--color-accent-hi)' : 'var(--color-muted)'}
        />
        <span style={{
          fontSize: 12.5, fontWeight: 500, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: isActive ? 'var(--color-text)' : 'var(--color-muted)',
          position: 'relative', zIndex: 1,
        }}>
          {project.name || 'Project'}
        </span>
        {isRunning && (
          <span style={{ position: 'relative', zIndex: 1 }}>
            <Spinner size={11} color="var(--color-accent-hi)" />
          </span>
        )}
      </button>
    </div>
  )
}

export default function ActivityColumn() {
  const dispatch = useAppDispatch()
  const { list: projects } = useAppSelector(s => s.project)
  const { list: clips }    = useAppSelector(s => s.clip)
  const downloadProgress   = useAppSelector(s => s.project.downloadProgress)
  const activeProjectId    = useAppSelector(s => s.ui.activeProjectId)
  const activeProject      = projects.find(p => p.id === activeProjectId) ?? null

  const [showInput, setShowInput] = useState(false)
  const [url, setUrl]             = useState('')
  const [adding, setAdding]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { dispatch(fetchProjects()) }, [])
  useEffect(() => {
    if (activeProjectId) dispatch(fetchClips(activeProjectId))
  }, [activeProjectId])
  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  async function handleAdd() {
    const trimmed = url.trim()
    if (!trimmed) {
      toastError('Tempel link YouTube terlebih dahulu')
      return
    }
    if (!/youtube\.com\/watch\?|youtu\.be\//.test(trimmed)) {
      toastError('Link YouTube tidak valid')
      return
    }
    setAdding(true)
    try {
      const res = await dispatch(startDownload(trimmed)).unwrap() as { project_id: string; video_exists: boolean; video_id: string; video_title: string }
      if (res.video_exists) {
        toastInfo('Video ini sudah pernah didownload. Membuka Library…')
        dispatch(fetchLibrary())
        dispatch(setScreen('library'))
        dispatch(openDetail(res.video_id))
      } else {
        await dispatch(fetchProjects())
        dispatch(setActiveProject(res.project_id))
      }
      setUrl('')
    } catch (e) {
      toastError(errText(e, 'Gagal memulai download'))
    } finally {
      setAdding(false)
    }
  }

  const dp    = activeProjectId ? downloadProgress[activeProjectId] : undefined
  const steps = activeProject ? getSteps(activeProject, dp) : []
  const readyClips = clips.filter(c => c.project_id === activeProjectId)

  return (
    <div style={{
      width: 264, flexShrink: 0,
      borderRight: '1px solid var(--color-border-soft)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-ui)', minHeight: 0,
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 16px 14px', borderBottom: '1px solid var(--color-border-soft)' }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LightningIcon size={14} color="var(--color-accent-hi)" weight="fill" />
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeProject?.name || 'Aktivitas'}
        </span>
      </div>

      {/* ── Thread (scrollable) ── */}
      {activeProject && (
        <div style={{ padding: '14px 16px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.7,
            textTransform: 'uppercase', color: 'var(--color-faint)', marginBottom: 14,
          }}>
            Thread
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((step, i) => {
              const isDone   = step.status === 'done'
              const isActive = step.status === 'active'
              const isError  = step.status === 'error'
              const Icon     = step.icon
              const showBar  = isActive && step.progress != null

              return (
                <div key={i} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                  {/* vertical connector */}
                  {i < steps.length - 1 && (
                    <div style={{
                      position: 'absolute', left: 15, top: 33, bottom: -6,
                      width: 1.5, borderRadius: 1,
                      background: isDone ? 'var(--color-accent-lo)' : 'var(--color-border)',
                    }} />
                  )}

                  {/* icon badge */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0, zIndex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: i < steps.length - 1 ? 24 : 0,
                    background: isDone  ? 'rgba(84,214,160,0.14)'
                              : isError ? 'rgba(255,107,102,0.14)'
                              : isActive ? 'var(--color-accent-soft)'
                              : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${
                      isDone  ? 'rgba(84,214,160,0.30)'
                    : isError ? 'rgba(255,107,102,0.35)'
                    : isActive ? 'var(--color-accent-line)'
                    : 'var(--color-border)'}`,
                  }}>
                    {isDone  ? <CheckIcon size={14} color="var(--color-good)" weight="bold" />
                   : isError ? <WarningCircleIcon size={14} color="var(--color-bad)" weight="fill" />
                   : isActive ? <Spinner size={14} color="var(--color-accent-hi)" />
                   : <Icon size={14} color="var(--color-faint)" />}
                  </div>

                  {/* label + detail + progress bar */}
                  <div style={{ flex: 1, paddingTop: 5 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: isDone || isActive ? 'var(--color-text)' : 'var(--color-faint)',
                    }}>
                      {step.label}
                    </div>

                    {step.detail && (
                      <div style={{
                        fontSize: 11, color: 'var(--color-faint)',
                        fontFamily: 'var(--font-mono)', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {step.detail}
                      </div>
                    )}

                    {/* smooth progress bar + percentage */}
                    {showBar && <StepProgressBar percent={step.progress!} />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* action after ready */}
          {activeProject.status === 'ready' && readyClips.length > 0 && (
            <button
              onClick={() => dispatch(openOverlay('export'))}
              className="btn-primary"
              style={{ width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 13, marginTop: 20 }}
            >
              <ExportIcon size={15} weight="bold" /> Ekspor semua ({readyClips.length})
            </button>
          )}
        </div>
      )}

      {/* ── Paste input pinned at bottom ── */}
      <div style={{ padding: 12, borderTop: '1px solid var(--color-border-soft)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: 6, borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)',
        }}>
          <input
            ref={inputRef}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Paste link untuk mulai…"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13, color: 'var(--color-text)', paddingLeft: 6, fontFamily: 'var(--font-ui)',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !url.trim()}
            className="btn-primary"
            style={{ width: 32, height: 32, borderRadius: 9, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {adding ? <Spinner size={14} /> : <ArrowRightIcon size={15} weight="bold" />}
          </button>
        </div>
      </div>
    </div>
  )
}
