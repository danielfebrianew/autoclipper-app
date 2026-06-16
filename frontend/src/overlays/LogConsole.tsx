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

const TOOL_COLORS: Record<string, string> = {
  yt_dlp:         '#ff4444',
  ffmpeg:         '#00bcd4',
  whisper:        '#9c27b0',
  yolo:           '#ff9800',
  llm:            '#7b61ff',
  compositor:     '#4caf50',
}

function toolColor(tool: string) {
  return TOOL_COLORS[tool] ?? 'var(--color-faint)'
}

export default function LogConsole() {
  const dispatch = useAppDispatch()
  const { lines, streaming } = useAppSelector(s => s.log)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      background: 'rgba(8,6,13,0.6)', backdropFilter: 'blur(8px)',
      fontFamily: 'var(--font-ui)',
    }}
    onClick={() => dispatch(closeOverlay())}
    >
      {/* Slide-over panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 500, height: '100%', display: 'flex', flexDirection: 'column',
          background: 'var(--color-panel-strong)', borderLeft: '1px solid var(--color-border)',
          animation: 'acslide 0.22s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: '1px solid var(--color-border-soft)' }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
            Worker Log {streaming && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-accent-hi)', marginLeft: 8, animation: 'acpulse 1s infinite' }}>● live</span>}
          </span>
          <button
            onClick={() => dispatch(clearLog())}
            className="icon-btn" title="Clear log"
          >
            <ArrowClockwiseIcon size={15} color="var(--color-muted)" />
          </button>
          <button onClick={() => dispatch(closeOverlay())} className="icon-btn">
            <XIcon size={18} color="var(--color-muted)" />
          </button>
        </div>

        {/* Log lines */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {lines.length === 0 && (
            <div style={{ color: 'var(--color-faint)', fontSize: 12.5, marginTop: 20, textAlign: 'center' }}>
              Belum ada log.
            </div>
          )}
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', lineHeight: 1.6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--color-ghost)', flexShrink: 0, letterSpacing: 0.2 }}>
                {line.t.split('T')[1]?.slice(0, 8) ?? line.t}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                color: toolColor(line.tool), flexShrink: 0, minWidth: 64,
              }}>
                {line.tool}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: LEVEL_COLORS[line.level], flexShrink: 0, minWidth: 30 }}>
                {line.level.toUpperCase()}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: LEVEL_COLORS[line.level], flex: 1, wordBreak: 'break-word' }}>
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
