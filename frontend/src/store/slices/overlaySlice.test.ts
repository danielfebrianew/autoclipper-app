import { describe, it, expect } from 'vitest'
import reducer, {
  setCurrent, updateLayout, updateClick, setName, addTrack, updateTrack, removeTrack,
  setSaveStatus, setRenderProgress, setRenderDone, setRenderError, resetRender,
  fetchOverlayProjects, fetchOverlayProject, addOverlayImage, deleteOverlayImage,
  persistOverlayProject, OverlayProject, OverlayTrack,
} from './overlaySlice'

const init = () => reducer(undefined, { type: '@@INIT' })

const track = (over: Partial<OverlayTrack>): OverlayTrack => ({
  id: 't1', kind: 'image', asset_path: '/a.png', asset_name: 'a', start_sec: 0, end_sec: 2,
  trim_start_sec: 0, fit_override: '', click_enabled: null, sort_order: 0, ...over,
})

const project = (over: Partial<OverlayProject> = {}): OverlayProject => ({
  id: 'p1', name: 'P', source_video_path: '', source_clip_id: '', video_width: 1080,
  video_height: 1920, video_fps: 30, video_duration: 10,
  layout: {} as any, click_sound: { enabled: false, volume: 1 }, cover: null,
  tracks: [], created_at: '', updated_at: '', ...over,
})

const withCurrent = (p: OverlayProject) => ({ ...init(), current: p })

describe('overlaySlice — local edits', () => {
  it('setCurrent sets project and resets save status to idle', () => {
    const s = reducer({ ...init(), saveStatus: 'dirty' as const }, setCurrent(project()))
    expect(s.current?.id).toBe('p1')
    expect(s.saveStatus).toBe('idle')
  })

  it('edits are no-ops without a current project', () => {
    expect(reducer(init(), setName('x')).current).toBeNull()
    expect(reducer(init(), addTrack(track({}))).current).toBeNull()
  })

  it('setName marks dirty', () => {
    const s = reducer(withCurrent(project()), setName('New'))
    expect(s.current?.name).toBe('New')
    expect(s.saveStatus).toBe('dirty')
  })

  it('updateLayout / updateClick merge partials and mark dirty', () => {
    const seeded = withCurrent(project({ layout: { fit: 'cover' } as any }))
    const s1 = reducer(seeded, updateLayout({ fit: 'contain' } as any))
    expect((s1.current?.layout as any).fit).toBe('contain')
    expect(s1.saveStatus).toBe('dirty')

    const s2 = reducer(withCurrent(project()), updateClick({ volume: 0.5 }))
    expect(s2.current?.click_sound.volume).toBe(0.5)
  })

  it('addTrack / updateTrack / removeTrack manage the track list', () => {
    let s = reducer(withCurrent(project()), addTrack(track({ id: 't1' })))
    expect(s.current?.tracks).toHaveLength(1)

    s = reducer(s, updateTrack({ id: 't1', patch: { end_sec: 9 } }))
    expect(s.current?.tracks[0].end_sec).toBe(9)

    s = reducer(s, removeTrack('t1'))
    expect(s.current?.tracks).toHaveLength(0)
  })
})

describe('overlaySlice — render + save status', () => {
  it('setSaveStatus sets status directly', () => {
    expect(reducer(init(), setSaveStatus('saved')).saveStatus).toBe('saved')
  })

  it('render progress → done → error → reset transitions', () => {
    let s = reducer(init(), setRenderProgress({ percent: 40, message: 'enc' }))
    expect(s.render).toMatchObject({ status: 'running', percent: 40, message: 'enc' })

    s = reducer(s, setRenderDone('/out.mp4'))
    expect(s.render).toMatchObject({ status: 'done', percent: 100, outputPath: '/out.mp4' })

    s = reducer(s, setRenderError('boom'))
    expect(s.render).toMatchObject({ status: 'error', percent: 0, message: 'boom' })

    s = reducer(s, resetRender())
    expect(s.render).toMatchObject({ status: 'idle', percent: 0, outputPath: '' })
  })
})

describe('overlaySlice — thunks', () => {
  it('fetchOverlayProjects lifecycle', () => {
    let s = reducer(init(), { type: fetchOverlayProjects.pending.type })
    expect(s.loading).toBe(true)
    s = reducer(s, { type: fetchOverlayProjects.fulfilled.type, payload: [project({ id: 'a' })] })
    expect(s.projects).toHaveLength(1)
    expect(s.loading).toBe(false)
  })

  it('fetchOverlayProject.fulfilled sets current and idle save status', () => {
    const s = reducer({ ...init(), saveStatus: 'dirty' as const }, {
      type: fetchOverlayProject.fulfilled.type, payload: project({ id: 'z' }),
    })
    expect(s.current?.id).toBe('z')
    expect(s.saveStatus).toBe('idle')
  })

  it('addOverlayImage prepends; deleteOverlayImage removes by arg', () => {
    let s = reducer(init(), { type: addOverlayImage.fulfilled.type, payload: { id: 'i1' } })
    s = reducer(s, { type: addOverlayImage.fulfilled.type, payload: { id: 'i2' } })
    expect(s.images.map((i: any) => i.id)).toEqual(['i2', 'i1'])

    s = reducer(s, { type: deleteOverlayImage.fulfilled.type, meta: { arg: 'i1' } })
    expect(s.images.map((i: any) => i.id)).toEqual(['i2'])
  })

  it('persistOverlayProject lifecycle: saving → saved → error', () => {
    let s = reducer(init(), { type: persistOverlayProject.pending.type })
    expect(s.saveStatus).toBe('saving')
    s = reducer(s, { type: persistOverlayProject.fulfilled.type })
    expect(s.saveStatus).toBe('saved')
    s = reducer(s, { type: persistOverlayProject.rejected.type })
    expect(s.saveStatus).toBe('error')
  })
})
