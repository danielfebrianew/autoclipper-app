import { useEffect, useRef, useState } from 'react'
import {
  ClockIcon, LightningIcon, ArrowRightIcon, DotsThreeIcon, ExportIcon,
} from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchProjects, startDownload } from '../../store/slices/projectSlice'
import { fetchClips } from '../../store/slices/clipSlice'
import { fetchLibrary, openDetail, type LibraryVideo } from '../../store/slices/librarySlice'
import { setActiveProject, openOverlay, setScreen } from '../../store/slices/uiSlice'
import type { Project } from '../../store/slices/projectSlice'
import type { Clip } from '../../store/slices/clipSlice'
import Spinner from '../../components/primitives/Spinner'
import { toastError, toastInfo, errText } from '../../lib/toast'
import { useSmoothValue } from '../../lib/useSmoothValue'

/** Timeline of activity events, chat/feed style. */
type EntryKind = 'you' | 'clipper'
type EntryState = 'done' | 'active' | 'pending'

interface FeedEntry {
  id: string
  kind: EntryKind
  state: EntryState
  /** For 'you': shown as a bordered bubble. For 'clipper': rich body. */
  bubble?: string
  /** Rich body node for clipper entries. */
  body?: React.ReactNode
}

/** Format seconds as h:mm:ss / m:ss for the "Video diunduh" chip. */
function fmtClock(sec: number): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Thin progress bar for the active generating entry, smoothly animated. */
function FeedProgressBar({ percent }: { percent: number }) {
  const v = useSmoothValue(percent)
  return (
    <div style={{
      marginTop: 8, height: 4, borderRadius: 3,
      background: 'var(--color-border)', overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', borderRadius: 3,
        background: 'linear-gradient(90deg, var(--color-accent-lo), var(--color-accent-hi))',
        width: `${v}%`,
        boxShadow: '0 0 10px var(--color-accent-line)',
        transition: 'none',
      }} />
    </div>
  )
}

/** Build the activity feed from real project / video / clip state. */
function buildFeed(
  project: Project,
  video: LibraryVideo | undefined,
  clips: Clip[],
  dp: { step: string; percent: number; message: string } | undefined,
  gen: { active: number; total: number; percent: number },
  onOpenLog: () => void,
): FeedEntry[] {
  const s = project.status
  const isErr = s.startsWith('error')
  const feed: FeedEntry[] = []

  // 1. KAMU — the pasted link
  const url = video?.youtube_url
  if (url) {
    feed.push({ id: 'you-url', kind: 'you', state: 'done', bubble: url })
  }

  // 2. AUTO CLIPPER — download
  const downloading = s === 'metadata' || s === 'downloading'
  const downloaded = ['downloaded', 'transcript', 'analyzing', 'analyzed', 'ready'].includes(s)
  if (downloading) {
    feed.push({
      id: 'dl', kind: 'clipper', state: 'active',
      body: (
        <>
          <div style={bodyText}>
            {s === 'metadata' ? 'Mengambil metadata…' : 'Mengunduh video…'}
          </div>
          {s === 'downloading' && dp && <FeedProgressBar percent={dp.percent} />}
        </>
      ),
    })
  } else if (downloaded && video) {
    feed.push({
      id: 'dl', kind: 'clipper', state: 'done',
      body: (
        <>
          <div style={bodyText}>
            Video diunduh — <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>{video.title}</strong>
          </div>
          <div style={chip}>
            <ClockIcon size={12} weight="bold" />
            {fmtClock(video.duration)}
          </div>
        </>
      ),
    })
  }

  // 3. AUTO CLIPPER — transcription / analysis
  const transcribing = s === 'transcript'
  const analyzing = s === 'analyzing'
  if (transcribing || analyzing) {
    feed.push({
      id: 'analyze', kind: 'clipper', state: 'active',
      body: <div style={bodyText}>{transcribing ? 'Mengambil transkrip…' : 'Menganalisis transkrip dengan AI…'}</div>,
    })
  } else if (['analyzed', 'ready'].includes(s) && clips.length > 0) {
    feed.push({
      id: 'analyze', kind: 'clipper', state: 'done',
      body: (
        <div style={bodyText}>
          <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>{clips.length} momen</strong> terdeteksi dari transkrip
        </div>
      ),
    })
  }

  // 4. AUTO CLIPPER — generating clips
  if (gen.active > 0) {
    const idx = Math.min(gen.total, gen.total - gen.active + 1)
    feed.push({
      id: 'gen', kind: 'clipper', state: 'active',
      body: (
        <>
          <div style={bodyText}>
            Generating klip <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>{idx} dari {gen.total}</strong>…
          </div>
          <FeedProgressBar percent={gen.percent} />
          <button onClick={onOpenLog} className="btn-ghost" style={logBtn}>
            <DotsThreeIcon size={16} weight="bold" /> Lihat log proses
          </button>
        </>
      ),
    })
  }

  if (isErr) {
    feed.push({
      id: 'err', kind: 'clipper', state: 'pending',
      body: <div style={{ ...bodyText, color: 'var(--color-bad)' }}>Terjadi kesalahan saat memproses.</div>,
    })
  }

  return feed
}

const bodyText: React.CSSProperties = {
  fontSize: 14, lineHeight: 1.45, color: 'var(--color-muted)',
}
const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
  padding: '4px 10px', borderRadius: 8, fontSize: 12,
  fontFamily: 'var(--font-mono)', color: 'var(--color-muted)',
  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)',
}
const logBtn: React.CSSProperties = {
  marginTop: 12, padding: '9px 14px', borderRadius: 10, fontSize: 13,
  gap: 6, fontFamily: 'var(--font-mono)',
}

export default function ActivityColumn() {
  const dispatch = useAppDispatch()
  const { list: projects } = useAppSelector(s => s.project)
  const { list: clips }    = useAppSelector(s => s.clip)
  const generateProgress   = useAppSelector(s => s.clip.generateProgress)
  const library            = useAppSelector(s => s.library.list)
  const downloadProgress   = useAppSelector(s => s.project.downloadProgress)
  const activeProjectId    = useAppSelector(s => s.ui.activeProjectId)
  const activeProject      = projects.find(p => p.id === activeProjectId) ?? null

  const [showInput, setShowInput] = useState(false)
  const [url, setUrl]             = useState('')
  const [adding, setAdding]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { dispatch(fetchProjects()); dispatch(fetchLibrary()) }, [])
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

  const dp = activeProjectId ? downloadProgress[activeProjectId] : undefined
  const sourceVideo = library.find(v => v.video_id === activeProject?.source_video_id)
  const readyClips = clips.filter(c => c.project_id === activeProjectId)

  // Derive generating stats from per-clip progress entries.
  const genEntries = readyClips
    .map(c => generateProgress[c.id])
    .filter(Boolean) as { step: string; percent: number; message: string }[]
  const gen = {
    active: genEntries.length,
    total: readyClips.length,
    percent: genEntries.length
      ? genEntries.reduce((sum, g) => sum + g.percent, 0) / genEntries.length
      : 0,
  }

  const feed = activeProject
    ? buildFeed(activeProject, sourceVideo, readyClips, dp, gen, () => dispatch(openOverlay('log')))
    : []

  return (
    <div style={{
      width: 300, flexShrink: 0,
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
        {sourceVideo?.video_id && (
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-faint)', flexShrink: 0 }}>
            {sourceVideo.video_id}
          </span>
        )}
      </div>

      {/* ── Activity feed (scrollable) ── */}
      {activeProject && (
        <div style={{ padding: '18px 16px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {feed.map((entry, i) => {
              const last = i === feed.length - 1
              const dotColor =
                entry.state === 'active' ? 'var(--color-accent-hi)'
                : entry.kind === 'clipper' && entry.state === 'done' ? 'var(--color-good)'
                : 'var(--color-accent-hi)'
              const glow = entry.kind === 'clipper' && entry.state === 'done'
                ? '0 0 8px rgba(84,214,160,0.7)'
                : entry.state === 'active' ? '0 0 8px var(--color-accent-line)' : 'none'

              return (
                <div key={entry.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                  {/* rail */}
                  <div style={{ position: 'relative', width: 10, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', marginTop: 3, zIndex: 1,
                      background: dotColor, boxShadow: glow,
                    }} />
                    {!last && (
                      <div style={{
                        position: 'absolute', top: 16, bottom: -4, left: '50%',
                        width: 1.5, marginLeft: -0.75, borderRadius: 1,
                        background: 'var(--color-border)',
                      }} />
                    )}
                  </div>

                  {/* content */}
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 22 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
                      textTransform: 'uppercase', marginBottom: 6,
                      color: entry.kind === 'you' ? 'var(--color-accent-hi)' : 'var(--color-faint)',
                    }}>
                      {entry.kind === 'you' ? 'Kamu' : 'Auto Clipper'}
                    </div>

                    {entry.bubble ? (
                      <div style={{
                        padding: '11px 14px', borderRadius: 12,
                        background: 'var(--color-accent-soft)',
                        border: '1px solid var(--color-accent-line)',
                        fontSize: 13.5, fontFamily: 'var(--font-mono)',
                        color: 'var(--color-text)', wordBreak: 'break-all',
                      }}>
                        {entry.bubble}
                      </div>
                    ) : entry.body}
                  </div>
                </div>
              )
            })}
          </div>

          {/* action after ready */}
          {activeProject.status === 'ready' && readyClips.length > 0 && gen.active === 0 && (
            <button
              onClick={() => dispatch(openOverlay('export'))}
              className="btn-primary"
              style={{ width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 700, marginTop: 22 }}
            >
              <ExportIcon size={16} weight="bold" /> Ekspor semua ({readyClips.length})
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
