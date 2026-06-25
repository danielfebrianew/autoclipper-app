import { useEffect, useRef, useState } from 'react'
import {
  YoutubeLogoIcon, ScissorsIcon, SparkleIcon, ExportIcon, LightningIcon,
  ArrowRightIcon, CheckIcon, WarningCircleIcon,
} from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchProjects, startDownload } from '../../store/slices/projectSlice'
import { fetchClips } from '../../store/slices/clipSlice'
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
