import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { ListProjects, GetProject, DeleteProject, StartDownload } from '../../../wailsjs/go/main/App'

// Lean project shape (post video/project split). Source fields live on the video.
export interface Project {
  id: string
  source_video_id: string
  name: string
  status: string
  gemini_json: string
  created_at: string
  updated_at: string
}

interface ProjectState {
  list: Project[]
  current: Project | null
  loading: boolean
  error: string | null
  downloadProgress: Record<string, { step: string; percent: number; message: string }>
}

const initialState: ProjectState = {
  list: [],
  current: null,
  loading: false,
  error: null,
  downloadProgress: {},
}

export const fetchProjects = createAsyncThunk('project/list', () => ListProjects())
export const fetchProject = createAsyncThunk('project/get', (id: string) => GetProject(id))
export const deleteProject = createAsyncThunk('project/delete', (id: string) => DeleteProject(id))
export const startDownload = createAsyncThunk('project/download', (url: string) => StartDownload(url))

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setDownloadProgress(state, action: PayloadAction<{ projectId: string; step: string; percent: number; message: string }>) {
      const { projectId, step, percent, message } = action.payload
      state.downloadProgress[projectId] = { step, percent, message }
    },
    clearDownloadProgress(state, action: PayloadAction<string>) {
      delete state.downloadProgress[action.payload]
    },
    setCurrent(state, action: PayloadAction<Project | null>) {
      state.current = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => { state.loading = true })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.list = (action.payload as unknown as Project[]) ?? []
        state.loading = false
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.error = action.error.message ?? 'Failed to load projects'
        state.loading = false
      })
      .addCase(fetchProject.fulfilled, (state, action) => {
        state.current = action.payload as unknown as Project
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.list = state.list.filter(p => p.id !== action.meta.arg)
      })
  },
})

export const { setDownloadProgress, clearDownloadProgress, setCurrent } = projectSlice.actions
export default projectSlice.reducer
