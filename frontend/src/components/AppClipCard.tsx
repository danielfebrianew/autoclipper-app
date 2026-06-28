import { ScissorsIcon, ClosedCaptioningIcon, ExportIcon, CheckIcon, EyeIcon } from '@phosphor-icons/react'
import { Clip } from '../store/slices/clipSlice'
import ClipThumb from './primitives/ClipThumb'
import ProgressRing from './primitives/ProgressRing'
import { useClipThumb } from '../lib/useClipThumb'
import { cn } from '../lib/cn'

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
  const generating = !!progress
  const pct = progress?.percent ?? 0
  const thumb = useClipThumb(clip)

  return (
    <div
      className="cursor-pointer font-ui w-full group"
      onClick={generating ? undefined : onPreview}
    >
      {/* thumbnail wrapper with selection ring */}
      <div
        className={cn(
          'relative rounded-[14px] p-0.75 transition-all duration-150',
          selected
            ? 'bg-accent-soft shadow-[0_0_0_1.5px_var(--color-accent)]'
            : 'bg-transparent shadow-none',
        )}
      >
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
              className={cn(
                'absolute top-2 right-2 w-5.5 h-5.5 rounded-[7px] flex items-center justify-center cursor-pointer backdrop-blur-xs',
                selected
                  ? 'bg-accent border-[1.5px] border-accent'
                  : 'bg-black/40 border-[1.5px] border-white/45',
              )}
            >
              {selected && <CheckIcon size={13} color="#fff" weight="bold" />}
            </button>
          )}

          {/* generating overlay */}
          {generating && (
            <div
              onClick={e => { e.stopPropagation(); onOpenLog?.() }}
              className="absolute inset-0 rounded-[11px] bg-[rgba(8,6,13,0.66)] backdrop-blur-[2px] flex flex-col items-center justify-center gap-2.5"
            >
              <ProgressRing pct={pct} />
              <span className="font-mono text-[10px] text-accent-hi">
                {progress?.step ?? 'render'} {Math.round(pct)}%
              </span>
              <span className="font-mono text-[9px] text-muted cursor-pointer">
                lihat log
              </span>
            </div>
          )}

          {/* hover toolbar */}
          {!generating && (
            <div className="absolute left-1.5 right-1.5 bottom-1.5 flex gap-1 p-1.25 rounded-[11px] bg-panel backdrop-blur-[42px] border border-border opacity-0 translate-y-2 transition-[opacity,transform] duration-180 group-hover:opacity-100 group-hover:translate-y-0">
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
                  className={cn(
                    'flex-1 h-7 rounded-[7px] border-none flex items-center justify-center bg-white/5',
                    action ? 'cursor-pointer' : 'cursor-default',
                    label === 'Hapus' ? 'text-bad' : 'text-text',
                  )}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          )}
        </ClipThumb>
      </div>

      {/* info below card */}
      <div className="pt-2.25 px-1">
        <div
          className="text-[12px] font-semibold leading-[1.3] text-text overflow-hidden min-h-7.75"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
        >
          {clip.hook || clip.summary || `Klip ${clip.clip_index + 1}`}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="font-mono text-[8.5px] tracking-[0.3px] uppercase text-accent-hi bg-accent-soft px-1.5 py-0.5 rounded-[5px] border border-accent-line">
            {clip.category || clip.energy_level}
          </span>
          <span className="ml-auto font-mono text-[9.5px] text-faint">
            {fmtDur(clip.duration_seconds)}
          </span>
        </div>
      </div>
    </div>
  )
}
