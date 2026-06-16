import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { GetGallery } from '../../../wailsjs/go/main/App'

export interface GalleryItem {
  id: string
  project_id: string
  source_title: string
  source_url: string
  hook: string
  category: string
  viral_score: number
  duration_seconds: number
  final_clip_path: string
  status: string
}

interface GalleryState {
  items: GalleryItem[]
  activeVid: string      // 'all' | projectId
  selected: string[]
  loading: boolean
}

const initialState: GalleryState = {
  items: [],
  activeVid: 'all',
  selected: [],
  loading: false,
}

export const fetchGallery = createAsyncThunk('gallery/fetch', () => GetGallery())

const gallerySlice = createSlice({
  name: 'gallery',
  initialState,
  reducers: {
    setActiveVid(state, action: PayloadAction<string>) {
      state.activeVid = action.payload
    },
    toggleGalleryItem(state, action: PayloadAction<string>) {
      const id = action.payload
      const idx = state.selected.indexOf(id)
      if (idx === -1) state.selected.push(id)
      else state.selected.splice(idx, 1)
    },
    selectAllGallery(state, action: PayloadAction<string[]>) {
      state.selected = action.payload
    },
    clearGallerySelected(state) {
      state.selected = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGallery.pending, (state) => { state.loading = true })
      .addCase(fetchGallery.fulfilled, (state, action) => {
        state.items = (action.payload as unknown as GalleryItem[]) ?? []
        state.loading = false
      })
      .addCase(fetchGallery.rejected, (state) => { state.loading = false })
  },
})

export const { setActiveVid, toggleGalleryItem, selectAllGallery, clearGallerySelected } = gallerySlice.actions
export default gallerySlice.reducer
