import { useRef, useEffect } from 'react'
import { XIcon, ArrowClockwiseIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { closeOverlay } from '../store/slices/uiSlice'
import { clearLog } from '../store/slices/logSlice'

const LEVEL_COLORS = {
  info: 'var(--color-muted)',
  ok:   'var(--color-good)',
  warn: 'var(--color-warn)',
  err:  'var(--color-bad)',
}

// Canonical tool names match the worker/Go emitLog tags. High contrast on dark bg.
const TOOL_COLORS: Record<string, string> = {
  youtube: '#ff4d4f', // yt-dlp — red
  ffmpeg:  '#22d3ee', // cyan
  whisper: '#c084fc', // purple
  gemini:  '#818cf8', // indigo (LLM)
  yolov8:  '#fb923c', // orange (face tracking)
  worker:  '#94a3b8', // slate — generic worker lines
}

function toolColor(tool: string) {
  return TOOL_COLORS[tool] ?? 'var(--color-faint)'
}

export default function LogConsole() {
  const dispatch = useAppDispatch()
  const { lines, streaming, clipId } = useAppSelector(s => s.log)
  const activeProjectId = useAppSelector(s => s.ui.activeProjectId)
  const projects = useAppSelector(s => s.project.list)
  const clips = useAppSelector(s => s.clip.list)
  const bottomRef = useRef<HTMLDivElement>(null)

  const status = streaming ? 'Berjalan' : (lines.length ? 'Selesai' : 'Menunggu')
  const activeClip = clipId ? clips.find(c => c.id === clipId) : undefined
  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : undefined
  const name = activeClip?.hook || activeClip?.summary || activeProject?.name || ''
  const subtitle = name ? `${status} · ${name}` : status

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <div
      className="absolute inset-0 z-50 flex items-stretch justify-end bg-[rgba(8,6,13,0.6)] backdrop-blur-sm font-ui"
      onClick={() => dispatch(closeOverlay())}
    >
      {/* Slide-over panel */}
      <div
        onClick={e => e.stopPropagation()}
        className="w-125 h-full flex flex-col bg-panel-strong border-l border-border animate-[acslide_0.22s_ease-out]"
      >
        {/* Header */}
        <div className="h-13 shrink-0 flex flex-col justify-center gap-0.5 px-4 border-b border-border-soft">
          <div className="flex items-center gap-2.5">
            <span className="flex-1 text-[14px] font-bold text-text">
              Log proses{' '}
              {streaming && (
                <span className="text-[11px] font-mono text-accent-hi ml-2 animate-[acpulse_1s_infinite]">● live</span>
              )}
            </span>
            <button onClick={() => dispatch(clearLog())} className="icon-btn" title="Clear log">
              <ArrowClockwiseIcon size={15} color="var(--color-muted)" />
            </button>
            <button onClick={() => dispatch(closeOverlay())} className="icon-btn">
              <XIcon size={18} color="var(--color-muted)" />
            </button>
          </div>
          <span className="text-[11px] text-muted font-ui truncate">{subtitle}</span>
        </div>

        {/* Log lines */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-px">
          {lines.length === 0 && (
            <div className="text-faint text-[12.5px] mt-5 text-center">
              Belum ada log.
            </div>
          )}
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-baseline leading-[1.6]">
              <span className="font-mono text-[9.5px] text-ghost shrink-0 tracking-[0.2px]">
                {line.t.split('T')[1]?.slice(0, 8) ?? line.t}
              </span>
              <span className="font-mono text-[10px] font-bold tracking-[0.3px] shrink-0 min-w-16" style={{ color: toolColor(line.tool) }}>
                {line.tool}
              </span>
              <span className="font-mono text-[10px] shrink-0 min-w-7.5" style={{ color: LEVEL_COLORS[line.level] }}>
                {line.level.toUpperCase()}
              </span>
              <span className="font-mono text-[11.5px] flex-1 wrap-break-word" style={{ color: LEVEL_COLORS[line.level] }}>
                {line.m}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
