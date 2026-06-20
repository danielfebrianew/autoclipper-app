import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import {
  CreateOverlayFromClip,
  CreateOverlayProject,
  GetOverlayProject,
  ListOverlayProjects,
  SaveOverlayProject,
  DeleteOverlayProject,
  AddOverlayImage,
  ListOverlayImages,
  DeleteOverlayImage,
  AddOverlayClip,
  SetOverlayCover,
  DeleteOverlayCover,
  PickOverlayClip,
  PickOverlayImage,
  RenderOverlay,
  CancelOverlayRender,
} from '../../../wailsjs/go/main/App'

// --- Types (mirror Go overlay.Project) ---

export type ImageFit = 'cover' | 'contain'

export interface OverlayLayout {
  image_area_ratio: number
  image_fit: ImageFit
  background_color: string
  aspect_ratio: string
}

export interface OverlayClick {
  enabled: boolean
  volume: number
}

export interface OverlayCover {
  path: string
  duration_sec: number
}

export interface OverlayTrack {
  id: string
  kind: 'image' | 'video'
  asset_path: string
  asset_name: string
  start_sec: number
  end_sec: number
  trim_start_sec: number
  fit_override: string
  click_enabled: boolean | null
  sort_order: number
}

export interface OverlayProject {
  id: string
  name: string
  source_video_path: string
  source_clip_id: string
  video_width: number
  video_height: number
  video_fps: number
  video_duration: number
  layout: OverlayLayout
  click_sound: OverlayClick
  cover: OverlayCover | null
  tracks: OverlayTrack[]
  created_at: string
  updated_at: string
}

export interface OverlayImage {
  id: string
  path: string
  name: string
  width: number
  height: number
  created_at: string
}

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
export type RenderStatus = 'idle' | 'running' | 'done' | 'error'

interface OverlayState {
  projects: OverlayProject[]
  current: OverlayProject | null
  images: OverlayImage[]
  loading: boolean
  saveStatus: SaveStatus
  render: { status: RenderStatus; percent: number; message: string; outputPath: string }
}

const initialState: OverlayState = {
  projects: [],
  current: null,
  images: [],
  loading: false,
  saveStatus: 'idle',
  render: { status: 'idle', percent: 0, message: '', outputPath: '' },
}

// --- Thunks ---

export const fetchOverlayProjects = createAsyncThunk('overlay/fetchProjects', () => ListOverlayProjects())
export const fetchOverlayProject = createAsyncThunk('overlay/fetchProject', (id: string) => GetOverlayProject(id))
export const createOverlayFromClip = createAsyncThunk('overlay/createFromClip', (clipId: string) => CreateOverlayFromClip(clipId))
export const createOverlayProject = createAsyncThunk(
  'overlay/create',
  (args: { sourceVideoPath: string; name: string; sourceClipId?: string }) =>
    CreateOverlayProject(args.sourceVideoPath, args.name, args.sourceClipId ?? ''),
)
export const deleteOverlayProject = createAsyncThunk('overlay/deleteProject', (id: string) => DeleteOverlayProject(id))

export const fetchOverlayImages = createAsyncThunk('overlay/fetchImages', () => ListOverlayImages())
export const addOverlayImage = createAsyncThunk('overlay/addImage', (srcOrBase64: string) => AddOverlayImage(srcOrBase64))
export const deleteOverlayImage = createAsyncThunk('overlay/deleteImage', (id: string) => DeleteOverlayImage(id))
export const addOverlayClip = createAsyncThunk('overlay/addClip', (path: string) => AddOverlayClip(path))
// Native file-dialog pickers (WebView can't expose local file paths).
export const pickOverlayClip = createAsyncThunk('overlay/pickClip', () => PickOverlayClip())
export const pickOverlayImage = createAsyncThunk('overlay/pickImage', () => PickOverlayImage())

export const startOverlayRender = createAsyncThunk('overlay/render', (projectId: string) => RenderOverlay(projectId))
export const cancelOverlayRender = createAsyncThunk('overlay/cancelRender', (projectId: string) => CancelOverlayRender(projectId))

export const setOverlayCover = createAsyncThunk(
  'overlay/setCover',
  (args: { projectId: string; srcOrBase64: string }) => SetOverlayCover(args.projectId, args.srcOrBase64),
)
export const removeOverlayCover = createAsyncThunk('overlay/removeCover', (projectId: string) => DeleteOverlayCover(projectId))

// persistCurrent saves the current project (used by debounced auto-save).
export const persistOverlayProject = createAsyncThunk(
  'overlay/persist',
  async (project: OverlayProject) => {
    await SaveOverlayProject(project as any)
    return project
  },
)

const overlaySlice = createSlice({
  name: 'overlay',
  initialState,
  reducers: {
    // Local edits — mark dirty so auto-save fires.
    setCurrent(state, action: PayloadAction<OverlayProject | null>) {
      state.current = action.payload
      state.saveStatus = 'idle'
    },
    updateLayout(state, action: PayloadAction<Partial<OverlayLayout>>) {
      if (!state.current) return
      state.current.layout = { ...state.current.layout, ...action.payload }
      state.saveStatus = 'dirty'
    },
    updateClick(state, action: PayloadAction<Partial<OverlayClick>>) {
      if (!state.current) return
      state.current.click_sound = { ...state.current.click_sound, ...action.payload }
      state.saveStatus = 'dirty'
    },
    setName(state, action: PayloadAction<string>) {
      if (!state.current) return
      state.current.name = action.payload
      state.saveStatus = 'dirty'
    },
    addTrack(state, action: PayloadAction<OverlayTrack>) {
      if (!state.current) return
      state.current.tracks.push(action.payload)
      state.saveStatus = 'dirty'
    },
    updateTrack(state, action: PayloadAction<{ id: string; patch: Partial<OverlayTrack> }>) {
      if (!state.current) return
      const t = state.current.tracks.find(t => t.id === action.payload.id)
      if (t) Object.assign(t, action.payload.patch)
      state.saveStatus = 'dirty'
    },
    removeTrack(state, action: PayloadAction<string>) {
      if (!state.current) return
      state.current.tracks = state.current.tracks.filter(t => t.id !== action.payload)
      state.saveStatus = 'dirty'
    },
    setSaveStatus(state, action: PayloadAction<SaveStatus>) {
      state.saveStatus = action.payload
    },
    setRenderProgress(state, action: PayloadAction<{ percent: number; message: string }>) {
      state.render.status = 'running'
      state.render.percent = action.payload.percent
      state.render.message = action.payload.message
    },
    setRenderDone(state, action: PayloadAction<string>) {
      state.render = { status: 'done', percent: 100, message: 'Selesai', outputPath: action.payload }
    },
    setRenderError(state, action: PayloadAction<string>) {
      state.render = { status: 'error', percent: 0, message: action.payload, outputPath: '' }
    },
    resetRender(state) {
      state.render = { status: 'idle', percent: 0, message: '', outputPath: '' }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOverlayProjects.pending, (s) => { s.loading = true })
      .addCase(fetchOverlayProjects.fulfilled, (s, a) => {
        s.projects = (a.payload as OverlayProject[]) ?? []
        s.loading = false
      })
      .addCase(fetchOverlayProjects.rejected, (s) => { s.loading = false })

      .addCase(fetchOverlayProject.fulfilled, (s, a) => {
        s.current = a.payload as OverlayProject
        s.saveStatus = 'idle'
      })
      .addCase(createOverlayFromClip.fulfilled, (s, a) => {
        s.current = a.payload as OverlayProject
        s.saveStatus = 'idle'
        s.render = { status: 'idle', percent: 0, message: '', outputPath: '' }
      })
      .addCase(createOverlayProject.fulfilled, (s, a) => {
        s.current = a.payload as OverlayProject
        s.saveStatus = 'idle'
      })

      .addCase(fetchOverlayImages.fulfilled, (s, a) => { s.images = (a.payload as OverlayImage[]) ?? [] })
      .addCase(addOverlayImage.fulfilled, (s, a) => { s.images.unshift(a.payload as OverlayImage) })
      .addCase(pickOverlayImage.fulfilled, (s, a) => {
        const img = a.payload as OverlayImage
        if (img?.id) s.images.unshift(img)
      })
      .addCase(deleteOverlayImage.fulfilled, (s, a) => {
        s.images = s.images.filter(i => i.id !== a.meta.arg)
      })

      .addCase(setOverlayCover.fulfilled, (s, a) => { s.current = a.payload as OverlayProject })
      .addCase(removeOverlayCover.fulfilled, (s, a) => { s.current = a.payload as OverlayProject })

      .addCase(persistOverlayProject.pending, (s) => { s.saveStatus = 'saving' })
      .addCase(persistOverlayProject.fulfilled, (s) => { s.saveStatus = 'saved' })
      .addCase(persistOverlayProject.rejected, (s) => { s.saveStatus = 'error' })
  },
})

export const {
  setCurrent, updateLayout, updateClick, setName,
  addTrack, updateTrack, removeTrack, setSaveStatus,
  setRenderProgress, setRenderDone, setRenderError, resetRender,
} = overlaySlice.actions
export default overlaySlice.reducer
