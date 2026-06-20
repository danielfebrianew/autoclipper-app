import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  fetchOverlayProject, fetchOverlayImages, persistOverlayProject,
  type OverlayProject,
} from '../../store/slices/overlaySlice'
import OverlayProjectList from './OverlayProjectList'
import PreviewPane from './PreviewPane'
import Sidebar from './Sidebar'
import Timeline from './Timeline/Timeline'
import RenderPanel from './RenderPanel'
import { PlaybackProvider } from './playback'

const AUTOSAVE_DELAY = 800 // ms

export default function OverlayEditorMain() {
  const dispatch = useAppDispatch()
  const overlayProjectId = useAppSelector(s => s.ui.overlayProjectId)
  const current = useAppSelector(s => s.overlay.current)
  const saveStatus = useAppSelector(s => s.overlay.saveStatus)

  // Load project + image library when a project id is selected.
  useEffect(() => {
    if (overlayProjectId) {
      dispatch(fetchOverlayProject(overlayProjectId))
      dispatch(fetchOverlayImages())
    }
  }, [overlayProjectId])

  // Debounced auto-save whenever the project becomes dirty.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentRef = useRef<OverlayProject | null>(null)
  currentRef.current = current

  useEffect(() => {
    if (saveStatus !== 'dirty' || !current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (currentRef.current) dispatch(persistOverlayProject(currentRef.current))
    }, AUTOSAVE_DELAY)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [saveStatus, current])

  // No project selected → show the project list.
  if (!overlayProjectId || !current) {
    return <OverlayProjectList />
  }

  const sourceMissing = !current.source_video_path

  return (
    <PlaybackProvider key={current.id}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, fontFamily: 'var(--font-ui)', position: 'relative' }}>
        {/* Top: preview + sidebar */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <PreviewPane />
          <Sidebar />
        </div>
        {/* Bottom: render panel + timeline */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border-soft)' }}>
          <RenderPanel />
          <Timeline />
        </div>
        {sourceMissing && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', zIndex: 50, fontSize: 14, color: 'var(--color-faint)',
          }}>
            Video sumber hilang — render ulang klipnya dulu.
          </div>
        )}
      </div>
    </PlaybackProvider>
  )
}
