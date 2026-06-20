import { ExportIcon, PlayIcon, XIcon, FolderOpenIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { openOverlayEditor, openPlay } from '../../store/slices/uiSlice'
import { startOverlayRender, cancelOverlayRender, resetRender } from '../../store/slices/overlaySlice'
import { OpenFolder } from '../../../wailsjs/go/main/App'
import { toastError, errText } from '../../lib/toast'
import Spinner from '../../components/primitives/Spinner'

export default function RenderPanel() {
  const dispatch = useAppDispatch()
  const current = useAppSelector(s => s.overlay.current)!
  const render = useAppSelector(s => s.overlay.render)

  const running = render.status === 'running'
  const done = render.status === 'done'

  async function handleRender() {
    dispatch(resetRender())
    try {
      await dispatch(startOverlayRender(current.id)).unwrap()
    } catch (e) {
      toastError(errText(e, 'Gagal memulai render'))
    }
  }

  return (
    <div style={{
      height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px', borderBottom: '1px solid var(--color-border-soft)',
    }}>
      <button
        onClick={() => dispatch(openOverlayEditor(null))}
        className="btn-ghost"
        style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8 }}
      >
        ← Semua project
      </button>

      <div style={{ flex: 1 }} />

      {running && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 240 }}>
          <span style={{ fontSize: 11, color: 'var(--color-muted)', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{render.message}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${render.percent}%`, background: 'linear-gradient(90deg, var(--color-accent-lo), var(--color-accent-hi))', borderRadius: 3, transition: 'width .2s' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{Math.round(render.percent)}%</span>
        </div>
      )}

      {done && render.outputPath && (
        <>
          <button onClick={() => dispatch(openPlay({ path: render.outputPath, title: current.name }))} className="btn-ghost" style={{ fontSize: 12, padding: '7px 12px', borderRadius: 9, gap: 5 }}>
            <PlayIcon size={14} weight="fill" /> Putar
          </button>
          <button onClick={() => OpenFolder(render.outputPath)} className="btn-ghost" style={{ fontSize: 12, padding: '7px 12px', borderRadius: 9, gap: 5 }}>
            <FolderOpenIcon size={14} /> Buka folder
          </button>
        </>
      )}

      {running ? (
        <button
          onClick={() => dispatch(cancelOverlayRender(current.id))}
          className="btn-ghost"
          style={{ fontSize: 13, padding: '8px 14px', borderRadius: 10, gap: 6, color: 'var(--color-bad)' }}
        >
          <XIcon size={14} weight="bold" /> Batal
        </button>
      ) : (
        <button
          onClick={handleRender}
          className="btn-primary"
          style={{ fontSize: 13, padding: '8px 16px', borderRadius: 10, gap: 6 }}
        >
          {render.status === 'running' ? <Spinner size={14} /> : <ExportIcon size={15} weight="bold" />}
          {done ? 'Render ulang' : 'Render'}
        </button>
      )}
    </div>
  )
}
