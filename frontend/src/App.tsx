import { useEffect } from 'react'
import { Provider } from 'react-redux'
import { store } from './store/store'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { initApp } from './store/slices/appSlice'
import { setScreen } from './store/slices/uiSlice'
import { setDownloadProgress, clearDownloadProgress, fetchProjects } from './store/slices/projectSlice'
import { setGenerateProgress, setClipDone, fetchClips } from './store/slices/clipSlice'
import { appendLog, setStreaming } from './store/slices/logSlice'
import { EventsOn } from '../wailsjs/runtime/runtime'
import { Toaster } from 'react-hot-toast'
import { toastError } from './lib/toast'

// Screens
import BootstrapScreen from './screens/BootstrapScreen'
import ActivationScreen from './screens/ActivationScreen'
import OfflineScreen from './screens/OfflineScreen'
import MainShell from './shell/MainShell'

// Overlays
import LogConsole from './overlays/LogConsole'
import ExportOverlay from './overlays/ExportOverlay'
import DeleteConfirm from './overlays/DeleteConfirm'
import SettingsModal from './overlays/settings/SettingsModal'
import PreviewPlayer from './overlays/PreviewPlayer'
import ClipPlayer from './overlays/ClipPlayer'

function AppInner() {
  const dispatch = useAppDispatch()
  const { licenseValid, setupComplete, loading } = useAppSelector(s => s.app)
  const { screen, overlay } = useAppSelector(s => s.ui)

  // Init + determine start screen
  useEffect(() => {
    dispatch(initApp()).then(action => {
      if (initApp.fulfilled.match(action)) {
        const { licenseValid, setupComplete } = action.payload
        if (!licenseValid) dispatch(setScreen('activation'))
        else if (!setupComplete) dispatch(setScreen('bootstrap'))
        else dispatch(setScreen('workspace'))
      }
    })
  }, [])

  // Wire all Wails events once
  useEffect(() => {
    // Track which projects we've already fetched fresh status for, so each
    // pipeline phase transition refreshes the project list exactly once.
    let lastStep: Record<string, string> = {}

    EventsOn('download:progress', (ev: { project_id: string; step: string; percent: number; message: string }) => {
      dispatch(setDownloadProgress({ projectId: ev.project_id, step: ev.step, percent: ev.percent, message: ev.message }))
      // On every new phase (metadata→download→transcript→…), pull the updated
      // project row so the thread/sidebar reflect title + status immediately.
      if (lastStep[ev.project_id] !== ev.step) {
        lastStep[ev.project_id] = ev.step
        dispatch(fetchProjects())
      }
    })
    EventsOn('download:complete', (ev: { project_id: string }) => {
      dispatch(clearDownloadProgress(ev.project_id))
      delete lastStep[ev.project_id]
      dispatch(fetchProjects())
      dispatch(fetchClips(ev.project_id))   // analysis done → load the new clips
    })
    EventsOn('download:error', (ev: { project_id: string; step: string; error: string }) => {
      dispatch(clearDownloadProgress(ev.project_id))
      delete lastStep[ev.project_id]
      dispatch(fetchProjects())   // refresh so the thread step turns red
      toastError(`Gagal di tahap ${ev.step}: ${ev.error}`)
    })
    EventsOn('clip:progress', (ev: { clip_id: string; step: string; percent: number; message: string }) => {
      dispatch(setGenerateProgress({ clipId: ev.clip_id, step: ev.step, percent: ev.percent, message: ev.message }))
    })
    EventsOn('clip:done', (ev: { clip_id: string; output_path: string }) => {
      dispatch(setClipDone({ clipId: ev.clip_id, outputPath: ev.output_path }))
    })
    EventsOn('clip:error', (ev: { clip_id: string; step: string; error: string }) => {
      if (ev.step !== 'cancelled') toastError(`Klip gagal (${ev.step}): ${ev.error}`)
    })
    EventsOn('worker:log', (ev: { t: string; tool: string; level: 'info'|'ok'|'warn'|'err'; m: string }) => {
      dispatch(appendLog(ev))
      dispatch(setStreaming(true))
    })
    EventsOn('generate:complete', (ev: { project_id: string }) => {
      dispatch(setStreaming(false))
      if (ev?.project_id) dispatch(fetchClips(ev.project_id))
    })
  }, [])

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--color-faint)', fontSize: 13 }}>Loading…</span>
      </div>
    )
  }

  const isMain = screen === 'workspace' || screen === 'gallery'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Screens */}
      {screen === 'bootstrap'  && !licenseValid && <BootstrapScreen />}
      {screen === 'bootstrap'  && licenseValid && !setupComplete && <BootstrapScreen />}
      {screen === 'activation' && <ActivationScreen />}
      {screen === 'offline'    && <OfflineScreen />}
      {isMain && <MainShell />}

      {/* Overlays (stacked) */}
      {overlay === 'preview'  && <PreviewPlayer />}
      {overlay === 'log'      && <LogConsole />}
      {overlay === 'export'   && <ExportOverlay />}
      {overlay === 'delete'   && <DeleteConfirm />}
      {overlay === 'settings' && <SettingsModal />}
      {overlay === 'play'     && <ClipPlayer />}

      {/* Toasts */}
      <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
    </div>
  )
}

export default function App() {
  return (
    <Provider store={store}>
      <AppInner />
    </Provider>
  )
}
