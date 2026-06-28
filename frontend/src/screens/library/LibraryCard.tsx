import {
  SparkleIcon, TrashIcon, DownloadSimpleIcon, WarningCircleIcon,
  CheckCircleIcon, StackIcon, CaretRightIcon,
} from '@phosphor-icons/react'
import Spinner from '../../components/primitives/Spinner'
import type { LibraryVideo } from '../../store/slices/librarySlice'
import { cn } from '../../lib/cn'

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
    <div
      onClick={onOpen}
      className="rounded-[14px] border border-border bg-panel overflow-hidden flex flex-col transition-[border-color] duration-150 cursor-pointer hover:border-hair"
    >
      {/* Thumbnail */}
      <div className="w-full aspect-video bg-[rgba(255,255,255,0.04)] relative overflow-hidden flex items-center justify-center">
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : video.file_exists && video.video_path ? (
          <video
            src={`/media${video.video_path}#t=2`}
            preload="metadata"
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <SparkleIcon size={28} color="var(--color-faint)" weight="duotone" />
        )}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Spinner size={22} color="var(--color-accent-hi)" />
          </div>
        )}
        {/* Project count badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/55 backdrop-blur-sm rounded-[7px] px-1.75 py-0.5 text-[10.5px] font-semibold text-white">
          <StackIcon size={11} weight="fill" /> {video.project_count} set
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2 flex-1">
        <div className="text-[13px] font-semibold text-text leading-[1.35] font-ui line-clamp-2">
          {video.title || video.youtube_url || '(tanpa judul)'}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[11.5px] text-muted font-ui">
          <span>{formatDuration(video.duration)}</span>
          <span className="text-border">·</span>
          <span>{formatBytes(video.source_bytes)}</span>
          <span className="text-border">·</span>
          {fileStatus === 'on_disk' ? (
            <span className="flex items-center gap-0.75 text-good">
              <CheckCircleIcon size={11} weight="fill" /> {video.clip_count} klip
            </span>
          ) : (
            <span className="flex items-center gap-0.75 text-faint">
              <WarningCircleIcon size={11} weight="fill" /> file hilang
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
          {isProcessing || busy ? (
            <div className="flex items-center gap-1.75 text-xs text-accent-hi font-ui">
              <Spinner size={13} color="var(--color-accent-hi)" />
              {video.status === 'analyzing' ? 'Mencari klip…' : 'Memproses…'}
            </div>
          ) : (
            <>
              <button
                onClick={onOpen}
                className="btn-primary text-xs px-2.5 py-1.75 rounded-[9px] gap-1.25 justify-center"
              >
                Lihat project <CaretRightIcon size={12} weight="bold" />
              </button>
              {fileStatus === 'on_disk' ? (
                <button
                  onClick={onDelete}
                  className="btn-ghost text-xs px-2.5 py-1.5 rounded-[9px] gap-1.25 text-muted"
                >
                  <TrashIcon size={13} /> Hapus file sumber
                </button>
              ) : (
                <button
                  onClick={onRedownload}
                  className="btn-ghost text-xs px-2.5 py-1.5 rounded-[9px] gap-1.25"
                >
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
