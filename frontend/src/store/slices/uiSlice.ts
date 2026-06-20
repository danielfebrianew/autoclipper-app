import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type Screen = 'bootstrap' | 'activation' | 'offline' | 'workspace' | 'gallery' | 'library' | 'overlay-editor'
export type Overlay = 'preview' | 'log' | 'export' | 'settings' | 'delete' | 'play' | null

export interface PlayTarget {
  path: string   // path disk absolut final_clip_path
  title: string
}

interface UIState {
  screen: Screen
  overlay: Overlay
  previewClipId: string | null
  previewTab: 'edit' | 'subtitle' | 'track'
  exportClipIds: string[] | null
  deleteClipIds: string[] | null
  deleteProjectId: string | null
  activeProjectId: string | null
  playTarget: PlayTarget | null
  overlayProjectId: string | null   // active overlay-editor project
}

const initialState: UIState = {
  screen: 'bootstrap',
  overlay: null,
  previewClipId: null,
  previewTab: 'edit',
  exportClipIds: null,
  deleteClipIds: null,
  deleteProjectId: null,
  activeProjectId: null,
  playTarget: null,
  overlayProjectId: null,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setScreen(state, action: PayloadAction<Screen>) {
      state.screen = action.payload
      state.overlay = null
    },
    openOverlay(state, action: PayloadAction<Overlay>) {
      state.overlay = action.payload
    },
    closeOverlay(state) {
      state.overlay = null
      state.previewClipId = null
      state.exportClipIds = null
      state.deleteClipIds = null
      state.deleteProjectId = null
      state.playTarget = null
    },
    openPlay(state, action: PayloadAction<PlayTarget>) {
      state.playTarget = action.payload
      state.overlay = 'play'
    },
    openPreview(state, action: PayloadAction<string>) {
      state.previewClipId = action.payload
      state.overlay = 'preview'
      state.previewTab = 'edit'
    },
    setPreviewTab(state, action: PayloadAction<UIState['previewTab']>) {
      state.previewTab = action.payload
    },
    openExport(state, action: PayloadAction<string[] | null>) {
      state.exportClipIds = action.payload
      state.overlay = 'export'
    },
    openDelete(state, action: PayloadAction<string[]>) {
      state.deleteClipIds = action.payload
      state.overlay = 'delete'
    },
    openDeleteProject(state, action: PayloadAction<string>) {
      state.deleteProjectId = action.payload
      state.overlay = 'delete'
    },
    setActiveProject(state, action: PayloadAction<string | null>) {
      state.activeProjectId = action.payload
    },
    // Open the overlay editor on a specific project (or null to open the list).
    openOverlayEditor(state, action: PayloadAction<string | null>) {
      state.overlayProjectId = action.payload
      state.screen = 'overlay-editor'
      state.overlay = null
    },
  },
})

export const {
  setScreen, openOverlay, closeOverlay,
  openPreview, setPreviewTab, openExport, openDelete, openDeleteProject,
  openPlay, setActiveProject, openOverlayEditor,
} = uiSlice.actions
export default uiSlice.reducer
