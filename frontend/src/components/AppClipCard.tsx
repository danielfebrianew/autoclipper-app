import { useState } from 'react'
import { ScissorsIcon, ClosedCaptioningIcon, SpeakerHighIcon, ExportIcon, CheckIcon, EyeIcon } from '@phosphor-icons/react'
import { Clip } from '../store/slices/clipSlice'
import ClipThumb from './primitives/ClipThumb'
import ProgressRing from './primitives/ProgressRing'
import { useClipThumb } from '../lib/useClipThumb'

interface AppClipCardProps {
  clip: Clip
  selected?: boolean
  progress?: { step: string; percent: number; message: string }
  onToggleSelect?: () => void
  onPreview?: () => void
  onExport?: () => void
  onDelete?: () => void
  onOpenLog?: () => void
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60), sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function AppClipCard({ clip, selected, progress, onToggleSelect, onPreview, onExport, onDelete, onOpenLog }: AppClipCardProps) {
  const [hover, setHover] = useState(false)
  const generating = !!progress
  const pct = progress?.percent ?? 0
  const thumb = useClipThumb(clip)

  return (
    <div
      style={{ cursor: 'pointer', fontFamily: 'var(--font-ui)', width: '100%' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={generating ? undefined : onPreview}
    >
      {/* thumbnail wrapper with selection ring */}
      <div style={{
        position: 'relative', borderRadius: 14, padding: 3,
        background: selected ? 'var(--color-accent-soft)' : 'transparent',
        boxShadow: selected ? '0 0 0 1.5px var(--color-accent)' : 'none',
        transition: 'all .15s',
      }}>
        <ClipThumb
          dur={fmtDur(clip.duration_seconds)}
          score={generating ? null : clip.viral_score}
          radius={11}
          src={generating ? undefined : thumb ?? undefined}
        >
          {/* checkbox */}
          {!generating && (
            <button
              onClick={e => { e.stopPropagation(); onToggleSelect?.() }}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 22, height: 22, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                background: selected ? 'var(--color-accent)' : 'rgba(0,0,0,0.4)',
                border: `1.5px solid ${selected ? 'var(--color-accent)' : 'rgba(255,255,255,0.45)'}`,
                backdropFilter: 'blur(4px)',
              }}
            >
              {selected && <CheckIcon size={13} color="#fff" weight="bold" />}
            </button>
          )}

          {/* generating overlay */}
          {generating && (
            <div
              onClick={e => { e.stopPropagation(); onOpenLog?.() }}
              style={{
                position: 'absolute', inset: 0, borderRadius: 11,
                background: 'rgba(8,6,13,0.66)', backdropFilter: 'blur(2px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <ProgressRing pct={pct} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-accent-hi)' }}>
                {progress?.step ?? 'render'} {Math.round(pct)}%
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-muted)', cursor: 'pointer' }}>
                lihat log
              </span>
            </div>
          )}

          {/* hover toolbar */}
          {!generating && (
            <div style={{
              position: 'absolute', left: 6, right: 6, bottom: 6,
              display: 'flex', gap: 4, padding: 5, borderRadius: 11,
              background: 'var(--color-panel)', backdropFilter: 'blur(42px)',
              border: '1px solid var(--color-border)',
              opacity: hover ? 1 : 0,
              transform: hover ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity .18s, transform .18s',
            }}>
              {([
                [EyeIcon, 'Preview', onPreview],
                [ClosedCaptioningIcon, 'Caption', undefined],
                [ScissorsIcon, 'Hapus', onDelete],
                [ExportIcon, 'Export', onExport],
              ] as [React.ElementType, string, (() => void) | undefined][]).map(([Icon, label, action]) => (
                <button
                  key={label}
                  title={label}
                  onClick={e => { e.stopPropagation(); action?.() }}
                  style={{
                    flex: 1, height: 28, borderRadius: 7,
                    border: 'none', cursor: action ? 'pointer' : 'default',
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: label === 'Hapus' ? 'var(--color-bad)' : 'var(--color-text)',
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          )}
        </ClipThumb>
      </div>

      {/* info below card */}
      <div style={{ padding: '9px 4px 0' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: 'var(--color-text)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 31,
        }}>
          {clip.hook || clip.summary || `Klip ${clip.clip_index + 1}`}
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: 0.3, textTransform: 'uppercase',
            color: 'var(--color-accent-hi)', background: 'var(--color-accent-soft)',
            padding: '2px 6px', borderRadius: 5, border: '1px solid var(--color-accent-line)',
          }}>
            {clip.category || clip.energy_level}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--color-faint)' }}>
            {fmtDur(clip.duration_seconds)}
          </span>
        </div>
      </div>
    </div>
  )
}
