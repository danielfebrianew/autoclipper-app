import {
  SparkleIcon, TrashIcon, DownloadSimpleIcon, WarningCircleIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react'
import Spinner from '../../components/primitives/Spinner'
import type { LibraryVideo } from '../../store/slices/librarySlice'

interface LibraryCardProps {
  video: LibraryVideo
  busy: boolean
  onFindMore: () => void
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

const PROCESSING = ['metadata', 'downloading', 'transcript', 'analyzing', 'downloading']

export default function LibraryCard({ video, busy, onFindMore, onDelete, onRedownload }: LibraryCardProps) {
  const fileStatus = video.file_exists ? 'on_disk' : 'missing'
  const isProcessing = PROCESSING.includes(video.status)

  const thumbSrc = video.thumb_path ? `/media${video.thumb_path}` : null

  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid var(--color-border)',
      background: 'var(--color-panel)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'border-color .15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
    >
      {/* Thumbnail */}
      <div style={{
        width: '100%', aspectRatio: '16/9',
        background: 'rgba(255,255,255,0.04)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={video.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <SparkleIcon size={28} color="var(--color-faint)" weight="duotone" />
        )}
        {isProcessing && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}>
            <Spinner size={22} color="var(--color-accent-hi)" />
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {/* Title */}
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
          lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui)',
        }}>
          {video.title || video.youtube_url || '(tanpa judul)'}
        </div>

        {/* Meta row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          fontSize: 11.5, color: 'var(--color-muted)', fontFamily: 'var(--font-ui)',
        }}>
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

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {isProcessing || busy ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 12, color: 'var(--color-accent-hi)', fontFamily: 'var(--font-ui)',
            }}>
              <Spinner size={13} color="var(--color-accent-hi)" />
              {video.status === 'analyzing' ? 'Mencari klip…' : 'Memproses…'}
            </div>
          ) : fileStatus === 'on_disk' ? (
            <>
              {video.status === 'ready' && (
                <button
                  onClick={onFindMore}
                  className="btn-primary"
                  style={{ fontSize: 12, padding: '7px 10px', borderRadius: 9, gap: 5 }}
                >
                  <SparkleIcon size={13} weight="bold" /> + Klip lagi
                </button>
              )}
              <button
                  onClick={onDelete}
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 9, gap: 5, color: 'var(--color-muted)' }}
                >
                  <TrashIcon size={13} /> Hapus file
                </button>
            </>
          ) : (
            <>
              <button
                onClick={onRedownload}
                className="btn-ghost"
                style={{ fontSize: 12, padding: '7px 10px', borderRadius: 9, gap: 5 }}
              >
                <DownloadSimpleIcon size={13} /> Download ulang
              </button>
              <button
                onClick={onDelete}
                className="btn-ghost"
                style={{ fontSize: 12, padding: '6px 10px', borderRadius: 9, gap: 5, color: 'var(--color-muted)' }}
              >
                <TrashIcon size={13} /> Hapus dari library
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
