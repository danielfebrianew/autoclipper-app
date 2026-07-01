import { describe, it, expect } from 'vitest'
import reducer, {
  markSourceDeleted, hideVideo, restoreVideo, updateVideoStatus, bumpClipCount,
  openDetail, closeDetail,
  fetchLibrary, fetchStorage, deleteSourceVideo, redownloadSource, deleteAllSource,
  fetchProjectsByVideo, deleteLibraryProject, LibraryVideo,
} from './librarySlice'

const init = () => reducer(undefined, { type: '@@INIT' })
const video = (over: Partial<LibraryVideo>): LibraryVideo => ({
  video_id: 'v1', title: 'V', youtube_url: '', created_at: '2026-01-01', duration: 0,
  source_bytes: 100, file_exists: true, video_path: '/v.mp4', clip_count: 0, status: 'ready', ...over,
} as LibraryVideo)
const withList = (list: LibraryVideo[]) => ({ ...init(), list })

describe('librarySlice — sync reducers', () => {
  it('markSourceDeleted clears file fields but keeps the row', () => {
    const s = reducer(withList([video({ video_id: 'v1' })]), markSourceDeleted('v1'))
    expect(s.list[0].file_exists).toBe(false)
    expect(s.list[0].source_bytes).toBe(0)
    expect(s.list[0].video_path).toBe('')
  })

  it('hideVideo removes a video by id', () => {
    const s = reducer(withList([video({ video_id: 'a' }), video({ video_id: 'b' })]), hideVideo('a'))
    expect(s.list.map(v => v.video_id)).toEqual(['b'])
  })

  it('restoreVideo re-inserts sorted by created_at desc', () => {
    const seeded = withList([video({ video_id: 'old', created_at: '2025-01-01' })])
    const s = reducer(seeded, restoreVideo(video({ video_id: 'new', created_at: '2027-01-01' })))
    expect(s.list.map(v => v.video_id)).toEqual(['new', 'old'])
  })

  it('updateVideoStatus updates the matching video', () => {
    const s = reducer(withList([video({ video_id: 'v1', status: 'ready' })]), updateVideoStatus({ videoId: 'v1', status: 'analyzing' }))
    expect(s.list[0].status).toBe('analyzing')
  })

  it('bumpClipCount increments the clip count', () => {
    const s = reducer(withList([video({ video_id: 'v1', clip_count: 2 })]), bumpClipCount({ videoId: 'v1', newClips: 3 }))
    expect(s.list[0].clip_count).toBe(5)
  })

  it('openDetail / closeDetail manage the detail view id', () => {
    let s = reducer(init(), openDetail('v1'))
    expect(s.detailVideoId).toBe('v1')
    expect(s.detailProjects).toEqual([])
    s = reducer(s, closeDetail())
    expect(s.detailVideoId).toBeNull()
  })
})

describe('librarySlice — thunks', () => {
  it('fetchLibrary lifecycle', () => {
    let s = reducer(init(), { type: fetchLibrary.pending.type })
    expect(s.loading).toBe(true)
    s = reducer(s, { type: fetchLibrary.fulfilled.type, payload: [video({ video_id: 'a' })] })
    expect(s.list).toHaveLength(1)
    expect(s.loading).toBe(false)
  })

  it('fetchStorage.fulfilled stores the breakdown', () => {
    const breakdown = { limit_gb: 50, categories: [] }
    expect(reducer(init(), { type: fetchStorage.fulfilled.type, payload: breakdown }).storage).toEqual(breakdown)
  })

  it('deleteSourceVideo + redownloadSource set/clear busyId', () => {
    let s = reducer(init(), { type: deleteSourceVideo.pending.type, meta: { arg: 'v1' } })
    expect(s.busyId).toBe('v1')
    s = reducer(s, { type: deleteSourceVideo.fulfilled.type })
    expect(s.busyId).toBeNull()

    s = reducer(init(), { type: redownloadSource.pending.type, meta: { arg: 'v2' } })
    expect(s.busyId).toBe('v2')
    s = reducer(s, { type: redownloadSource.rejected.type })
    expect(s.busyId).toBeNull()
  })

  it('deleteAllSource.fulfilled wipes file data across all videos', () => {
    const seeded = withList([video({ video_id: 'a' }), video({ video_id: 'b' })])
    const s = reducer(seeded, { type: deleteAllSource.fulfilled.type })
    expect(s.list.every(v => !v.file_exists && v.source_bytes === 0 && v.video_path === '')).toBe(true)
  })

  it('fetchProjectsByVideo lifecycle', () => {
    let s = reducer(init(), { type: fetchProjectsByVideo.pending.type })
    expect(s.detailLoading).toBe(true)
    s = reducer(s, { type: fetchProjectsByVideo.fulfilled.type, payload: [{ id: 'p1' }] })
    expect(s.detailProjects).toHaveLength(1)
    expect(s.detailLoading).toBe(false)
  })

  it('deleteLibraryProject.fulfilled removes a detail project by arg', () => {
    const seeded = { ...init(), detailProjects: [{ id: 'p1' }, { id: 'p2' }] as any }
    const s = reducer(seeded, { type: deleteLibraryProject.fulfilled.type, meta: { arg: 'p1' } })
    expect(s.detailProjects.map((p: any) => p.id)).toEqual(['p2'])
  })
})
