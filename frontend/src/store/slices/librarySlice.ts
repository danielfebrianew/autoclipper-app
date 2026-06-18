import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import {
  ListLibraryVideos,
  DeleteSourceVideo,
  FindMoreClips,
  RedownloadSource,
  DeleteAllSource,
  GetStorageBreakdown,
  DeleteProject,
} from '../../../wailsjs/go/main/App'

export interface LibraryVideo {
  project_id: string
  title: string
  youtube_url: string
  duration: number
  source_bytes: number
  video_path: string
  file_exists: boolean
  status: string
  thumb_path: string
  clip_count: number
  created_at: string
}

export interface StorageCat {
  key: string
  label: string
  color: string
  size_bytes: number
}

export interface StorageBreakdown {
  limit_gb: number
  categories: StorageCat[]
}

interface LibraryState {
  list: LibraryVideo[]
  loading: boolean
  busyId: string | null
  storage: StorageBreakdown | null
}

const initialState: LibraryState = {
  list: [],
  loading: false,
  busyId: null,
  storage: null,
}

export const fetchLibrary = createAsyncThunk('library/fetch', () => ListLibraryVideos())
export const fetchStorage = createAsyncThunk('library/storage', () => GetStorageBreakdown())
export const deleteSourceVideo = createAsyncThunk('library/deleteSource', (id: string) => DeleteSourceVideo(id))
export const deleteProject = createAsyncThunk('library/deleteProject', (id: string) => DeleteProject(id))
export const findMoreClips = createAsyncThunk('library/findMore', (id: string) => FindMoreClips(id))
export const redownloadSource = createAsyncThunk('library/redownload', (id: string) => RedownloadSource(id))
export const deleteAllSource = createAsyncThunk('library/deleteAll', () => DeleteAllSource())

const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    markSourceDeleted(state, action: PayloadAction<string>) {
      const vid = state.list.find(v => v.project_id === action.payload)
      if (vid) {
        vid.file_exists = false
        vid.source_bytes = 0
        vid.video_path = ''
      }
    },
    // Optimistically hide a video from the UI (soft-delete pending undo timeout)
    hideVideo(state, action: PayloadAction<string>) {
      state.list = state.list.filter(v => v.project_id !== action.payload)
    },
    // Restore a previously hidden video (undo)
    restoreVideo(state, action: PayloadAction<LibraryVideo>) {
      // Insert back in original position by created_at order
      state.list = [action.payload, ...state.list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    },
    updateVideoStatus(state, action: PayloadAction<{ projectId: string; status: string }>) {
      const vid = state.list.find(v => v.project_id === action.payload.projectId)
      if (vid) vid.status = action.payload.status
    },
    bumpClipCount(state, action: PayloadAction<{ projectId: string; newClips: number }>) {
      const vid = state.list.find(v => v.project_id === action.payload.projectId)
      if (vid) vid.clip_count += action.payload.newClips
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLibrary.pending, (state) => { state.loading = true })
      .addCase(fetchLibrary.fulfilled, (state, action) => {
        state.list = (action.payload as LibraryVideo[]) ?? []
        state.loading = false
      })
      .addCase(fetchLibrary.rejected, (state) => { state.loading = false })
      .addCase(fetchStorage.fulfilled, (state, action) => {
        state.storage = action.payload as StorageBreakdown
      })
      .addCase(deleteSourceVideo.pending, (state, action) => { state.busyId = action.meta.arg })
      .addCase(deleteSourceVideo.fulfilled, (state) => { state.busyId = null })
      .addCase(deleteSourceVideo.rejected, (state) => { state.busyId = null })
      .addCase(findMoreClips.pending, (state, action) => { state.busyId = action.meta.arg })
      .addCase(findMoreClips.fulfilled, (state) => { state.busyId = null })
      .addCase(findMoreClips.rejected, (state) => { state.busyId = null })
      .addCase(redownloadSource.pending, (state, action) => { state.busyId = action.meta.arg })
      .addCase(redownloadSource.fulfilled, (state) => { state.busyId = null })
      .addCase(redownloadSource.rejected, (state) => { state.busyId = null })
      .addCase(deleteAllSource.fulfilled, (state) => {
        state.list = state.list.map(v => ({ ...v, file_exists: false, source_bytes: 0, video_path: '' }))
      })
  },
})

export const { markSourceDeleted, hideVideo, restoreVideo, updateVideoStatus, bumpClipCount } = librarySlice.actions
export default librarySlice.reducer
