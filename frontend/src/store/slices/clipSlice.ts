import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import {
  GetClips, UpdateClipTimestamp, ToggleClip,
  AddCustomClip, RemoveClip, GenerateClips,
} from '../../../wailsjs/go/main/App'

export interface Clip {
  id: string
  project_id: string
  clip_index: number
  start_seconds: number
  end_seconds: number
  duration_seconds: number
  speaker: string
  hook: string
  summary: string
  category: string
  energy_level: string
  viral_score: number
  content_score: number
  engagement_score: number
  thumbnail_text: string
  suggested_caption: string
  transcript_excerpt: string
  enabled: boolean
  status: string
  raw_clip_path: string
  final_clip_path: string
  // Editor fields (migration 005)
  aspect_ratio: string
  caption_style: string
  caption_position: string
  caption_size: string
  caption_text: string
  track_template: string
  track_smooth: boolean
  track_lock_main: boolean
  track_sensitivity: number
  track_reserve_bottom: boolean
  waveform_path: string
  favorite: boolean
}

interface ClipState {
  list: Clip[]
  selected: string[]
  loading: boolean
  generateProgress: Record<string, { step: string; percent: number; message: string }>
}

const initialState: ClipState = {
  list: [],
  selected: [],
  loading: false,
  generateProgress: {},
}

export const fetchClips = createAsyncThunk('clip/list', (projectId: string) => GetClips(projectId))
export const updateTimestamp = createAsyncThunk('clip/updateTs',
  ({ id, start, end }: { id: string; start: number; end: number }) =>
    UpdateClipTimestamp(id, start, end).then(() => ({ id, start, end }))
)
export const toggleClip = createAsyncThunk('clip/toggle',
  ({ id, enabled }: { id: string; enabled: boolean }) =>
    ToggleClip(id, enabled).then(() => ({ id, enabled }))
)
export const addCustomClip = createAsyncThunk('clip/addCustom',
  ({ projectId, start, end }: { projectId: string; start: number; end: number }) =>
    AddCustomClip(projectId, start, end)
)
export const removeClip = createAsyncThunk('clip/remove', (id: string) =>
  RemoveClip(id).then(() => id)
)
export const generateClips = createAsyncThunk('clip/generate',
  ({ projectId, clipIds }: { projectId: string; clipIds: string[] }) =>
    GenerateClips(projectId, clipIds)
)

const clipSlice = createSlice({
  name: 'clip',
  initialState,
  reducers: {
    setGenerateProgress(state, action: PayloadAction<{ clipId: string; step: string; percent: number; message: string }>) {
      const { clipId, step, percent, message } = action.payload
      state.generateProgress[clipId] = { step, percent, message }
    },
    setClipDone(state, action: PayloadAction<{ clipId: string; outputPath: string }>) {
      const c = state.list.find(c => c.id === action.payload.clipId)
      if (c) { c.final_clip_path = action.payload.outputPath; c.status = 'done' }
    },
    toggleSelected(state, action: PayloadAction<string>) {
      const id = action.payload
      const idx = state.selected.indexOf(id)
      if (idx === -1) state.selected.push(id)
      else state.selected.splice(idx, 1)
    },
    selectAll(state) {
      state.selected = state.list.map(c => c.id)
    },
    clearSelected(state) {
      state.selected = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchClips.pending, (state) => { state.loading = true })
      .addCase(fetchClips.fulfilled, (state, action) => {
        state.list = (action.payload as Clip[]) ?? []
        state.loading = false
      })
      .addCase(updateTimestamp.fulfilled, (state, action) => {
        const c = state.list.find(c => c.id === action.payload.id)
        if (c) {
          c.start_seconds = action.payload.start
          c.end_seconds = action.payload.end
          c.duration_seconds = action.payload.end - action.payload.start
        }
      })
      .addCase(toggleClip.fulfilled, (state, action) => {
        const c = state.list.find(c => c.id === action.payload.id)
        if (c) c.enabled = action.payload.enabled
      })
      .addCase(addCustomClip.fulfilled, (state, action) => {
        if (action.payload) state.list.push(action.payload as Clip)
      })
      .addCase(removeClip.fulfilled, (state, action) => {
        state.list = state.list.filter(c => c.id !== action.payload)
      })
  },
})

export const { setGenerateProgress, setClipDone, toggleSelected, selectAll, clearSelected } = clipSlice.actions
export default clipSlice.reducer
