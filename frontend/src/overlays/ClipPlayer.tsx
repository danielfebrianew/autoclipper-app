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
  // Folder induk untuk tombol "Buka folder".
  const folder = target.path.replace(/\/[^/]+$/, '')

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(8,6,13,0.92)', backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-ui)', gap: 16,
      }}
      onClick={() => dispatch(closeOverlay())}
    >
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: 'min(90vw, 420px)' }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center' }}>
        <video
          src={src}
          controls
          autoPlay
          style={{
            maxHeight: '78vh', maxWidth: '90vw', borderRadius: 14,
            background: '#000', border: '1px solid var(--color-border)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          }}
        />
      </div>
    </div>
  )
}
