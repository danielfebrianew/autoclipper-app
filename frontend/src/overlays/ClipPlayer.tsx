import { XIcon, FolderOpenIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { closeOverlay } from '../store/slices/uiSlice'
import { OpenFolder } from '../../wailsjs/go/main/App'

// ClipPlayer memutar klip final yang sudah ter-render (dari galeri).
// Berbeda dari PreviewPlayer (editor) — ini hanya pemutar hasil akhir.
export default function ClipPlayer() {
  const dispatch = useAppDispatch()
  const target = useAppSelector(s => s.ui.playTarget)

  if (!target) return null

  const src = `/media${target.path}`
  const folder = target.path.replace(/\/[^/]+$/, '')

  return (
    <div
      className="absolute inset-0 z-50 bg-[rgba(8,6,13,0.92)] backdrop-blur-lg flex flex-col items-center justify-center font-ui gap-4"
      onClick={() => dispatch(closeOverlay())}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 w-[min(90vw,420px)]"
        onClick={e => e.stopPropagation()}
      >
        <span className="flex-1 text-[14px] font-bold text-text overflow-hidden text-ellipsis whitespace-nowrap">
          {target.title || 'Klip'}
        </span>
        <button
          className="btn-ghost"
          onClick={() => OpenFolder(folder).catch(() => {})}
          style={{ padding: '6px 11px', borderRadius: 9, fontSize: 12, gap: 5 }}
        >
          <FolderOpenIcon size={14} /> Buka folder
        </button>
        <button
          className="btn-ghost"
          onClick={() => dispatch(closeOverlay())}
          style={{ padding: 7, borderRadius: 9 }}
        >
          <XIcon size={16} />
        </button>
      </div>

      {/* Video */}
      <div className="flex justify-center" onClick={e => e.stopPropagation()}>
        <video
          src={src}
          controls
          autoPlay
          className="max-h-[78vh] max-w-[90vw] rounded-[14px] bg-black border border-border shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
        />
      </div>
    </div>
  )
}
