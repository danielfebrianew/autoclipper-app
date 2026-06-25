import {
  SparkleIcon, TrashIcon, DownloadSimpleIcon, WarningCircleIcon,
  CheckCircleIcon, StackIcon, CaretRightIcon,
} from '@phosphor-icons/react'
import Spinner from '../../components/primitives/Spinner'
import type { LibraryVideo } from '../../store/slices/librarySlice'

interface LibraryCardProps {
  video: LibraryVideo
  busy: boolean
  onOpen: () => void
  onDelete: () => void
  onRedownload: () => void
}

function formatBytes(n: number): string {
  if (n <= 0) return '—'
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDuration(sec: number): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}j ${m}m`
  return `${m}m`
}

const PROCESSING = ['metadata', 'downloading', 'transcript', 'analyzing']

export default function LibraryCard({ video, busy, onOpen, onDelete, onRedownload }: LibraryCardProps) {
  const fileStatus = video.file_exists ? 'on_disk' : 'missing'
  const isProcessing = PROCESSING.includes(video.status)
  const thumbSrc = video.thumb_path ? `/media${video.thumb_path}` : null

  return (
    <div style={{
      borderRadius: 14, border: '1px solid var(--color-border)', background: 'var(--color-panel)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color .15s',
      cursor: 'pointer',
    }}
      onClick={onOpen}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
    >
      {/* Thumbnail */}
      <div style={{
        width: '100%', aspectRatio: '16/9', background: 'rgba(255,255,255,0.04)',
        position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={video.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : video.file_exists && video.video_path ? (
          // No rendered-clip thumbnail yet → show a frame of the source video.
          <video
            src={`/media${video.video_path}#t=2`}
            preload="metadata"
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <SparkleIcon size={28} color="var(--color-faint)" weight="duotone" />
        )}
        {isProcessing && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
            <Spinner size={22} color="var(--color-accent-hi)" />
          </div>
        )}
        {/* Project count badge */}
        <div style={{
          position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', borderRadius: 7, padding: '2px 7px',
          fontSize: 10.5, fontWeight: 600, color: '#fff',
        }}>
          <StackIcon size={11} weight="fill" /> {video.project_count} set
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          fontFamily: 'var(--font-ui)',
        }}>
          {video.title || video.youtube_url || '(tanpa judul)'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--color-muted)', fontFamily: 'var(--font-ui)' }}>
          <span>{formatDuration(video.duration)}</span>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span>{formatBytes(video.source_bytes)}</span>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          {fileStatus === 'on_disk' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--color-good)' }}>
              <CheckCircleIcon size={11} weight="fill" /> {video.clip_count} klip
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--color-faint)' }}>
              <WarningCircleIcon size={11} weight="fill" /> file hilang
            </span>
          )}
        </div>

        {/* Actions — stopPropagation so they don't trigger card open */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }} onClick={e => e.stopPropagation()}>
          {isProcessing || busy ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--color-accent-hi)', fontFamily: 'var(--font-ui)' }}>
              <Spinner size={13} color="var(--color-accent-hi)" />
              {video.status === 'analyzing' ? 'Mencari klip…' : 'Memproses…'}
            </div>
          ) : (
            <>
              <button
                onClick={onOpen}
                className="btn-primary"
                style={{ fontSize: 12, padding: '7px 10px', borderRadius: 9, gap: 5, justifyContent: 'center' }}
              >
                Lihat project <CaretRightIcon size={12} weight="bold" />
              </button>
              {fileStatus === 'on_disk' ? (
                <button onClick={onDelete} className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px', borderRadius: 9, gap: 5, color: 'var(--color-muted)' }}>
                  <TrashIcon size={13} /> Hapus file sumber
                </button>
              ) : (
                <button onClick={onRedownload} className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px', borderRadius: 9, gap: 5 }}>
                  <DownloadSimpleIcon size={13} /> Download ulang
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
