import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import {
  ListLibraryVideos,
  DeleteSourceVideo,
  RedownloadSource,
  DeleteAllSource,
  GetStorageBreakdown,
  ListProjectsByVideo,
  MakeMoreClips,
  DeleteProject,
} from '../../../wailsjs/go/main/App'

// A downloaded source video (one video : many projects).
export interface LibraryVideo {
  video_id: string
  title: string
  youtube_url: string
  duration: number
  source_bytes: number
  video_path: string
  file_exists: boolean
  status: string
  thumb_path: string
  clip_count: number
  project_count: number
  created_at: string
}

// A clip-set project derived from a video (lean shape from Go).
export interface LibraryProject {
  id: string
  source_video_id: string
  name: string
  status: string
  created_at: string
  updated_at: string
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
  // Detail view (a video's projects)
  detailVideoId: string | null
  detailProjects: LibraryProject[]
  detailLoading: boolean
}

const initialState: LibraryState = {
  list: [],
  loading: false,
  busyId: null,
  storage: null,
  detailVideoId: null,
  detailProjects: [],
  detailLoading: false,
}

export const fetchLibrary = createAsyncThunk('library/fetch', () => ListLibraryVideos())
export const fetchStorage = createAsyncThunk('library/storage', () => GetStorageBreakdown())
export const deleteSourceVideo = createAsyncThunk('library/deleteSource', (videoId: string) => DeleteSourceVideo(videoId))
export const redownloadSource = createAsyncThunk('library/redownload', (videoId: string) => RedownloadSource(videoId))
export const deleteAllSource = createAsyncThunk('library/deleteAll', () => DeleteAllSource())

// Detail: a video's projects + actions
export const fetchProjectsByVideo = createAsyncThunk('library/projectsByVideo', (videoId: string) => ListProjectsByVideo(videoId))
export const makeMoreClips = createAsyncThunk('library/makeMore', (videoId: string) => MakeMoreClips(videoId))
export const deleteLibraryProject = createAsyncThunk('library/deleteProject', (projectId: string) => DeleteProject(projectId))

const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    markSourceDeleted(state, action: PayloadAction<string>) {
      const vid = state.list.find(v => v.video_id === action.payload)
      if (vid) {
        vid.file_exists = false
        vid.source_bytes = 0
        vid.video_path = ''
      }
    },
    hideVideo(state, action: PayloadAction<string>) {
      state.list = state.list.filter(v => v.video_id !== action.payload)
    },
    restoreVideo(state, action: PayloadAction<LibraryVideo>) {
      state.list = [action.payload, ...state.list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    },
    updateVideoStatus(state, action: PayloadAction<{ videoId: string; status: string }>) {
      const vid = state.list.find(v => v.video_id === action.payload.videoId)
      if (vid) vid.status = action.payload.status
    },
    bumpClipCount(state, action: PayloadAction<{ videoId: string; newClips: number }>) {
      const vid = state.list.find(v => v.video_id === action.payload.videoId)
      if (vid) vid.clip_count += action.payload.newClips
    },
    openDetail(state, action: PayloadAction<string>) {
      state.detailVideoId = action.payload
      state.detailProjects = []
    },
    closeDetail(state) {
      state.detailVideoId = null
      state.detailProjects = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLibrary.pending, (state) => { state.loading = true })
      .addCase(fetchLibrary.fulfilled, (state, action) => {
        state.list = (action.payload as unknown as LibraryVideo[]) ?? []
        state.loading = false
      })
      .addCase(fetchLibrary.rejected, (state) => { state.loading = false })
      .addCase(fetchStorage.fulfilled, (state, action) => {
        state.storage = action.payload as StorageBreakdown
      })
      .addCase(deleteSourceVideo.pending, (state, action) => { state.busyId = action.meta.arg })
      .addCase(deleteSourceVideo.fulfilled, (state) => { state.busyId = null })
      .addCase(deleteSourceVideo.rejected, (state) => { state.busyId = null })
      .addCase(redownloadSource.pending, (state, action) => { state.busyId = action.meta.arg })
      .addCase(redownloadSource.fulfilled, (state) => { state.busyId = null })
      .addCase(redownloadSource.rejected, (state) => { state.busyId = null })
      .addCase(deleteAllSource.fulfilled, (state) => {
        state.list = state.list.map(v => ({ ...v, file_exists: false, source_bytes: 0, video_path: '' }))
      })
      // Detail
      .addCase(fetchProjectsByVideo.pending, (state) => { state.detailLoading = true })
      .addCase(fetchProjectsByVideo.fulfilled, (state, action) => {
        state.detailProjects = (action.payload as unknown as LibraryProject[]) ?? []
        state.detailLoading = false
      })
      .addCase(fetchProjectsByVideo.rejected, (state) => { state.detailLoading = false })
      .addCase(deleteLibraryProject.fulfilled, (state, action) => {
        state.detailProjects = state.detailProjects.filter(p => p.id !== action.meta.arg)
      })
  },
})

export const {
  markSourceDeleted, hideVideo, restoreVideo, updateVideoStatus, bumpClipCount,
  openDetail, closeDetail,
} = librarySlice.actions
export default librarySlice.reducer
