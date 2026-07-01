import { describe, it, expect } from 'vitest'
import reducer, {
  setGenerateProgress, setClipDone, toggleSelected, selectAll, clearSelected,
  fetchClips, updateTimestamp, toggleClip, addCustomClip, removeClip, Clip,
} from './clipSlice'

const init = () => reducer(undefined, { type: '@@INIT' })
const clip = (over: Partial<Clip>): Clip => ({ id: 'c1', enabled: true, status: 'ready', start_seconds: 0, end_seconds: 10, duration_seconds: 10, ...over } as Clip)
const withList = (list: Clip[]) => ({ ...init(), list })

describe('clipSlice', () => {
  it('setGenerateProgress records progress per clip', () => {
    const s = reducer(init(), setGenerateProgress({ clipId: 'c1', step: 'reframe', percent: 40, message: '...' }))
    expect(s.generateProgress.c1).toEqual({ step: 'reframe', percent: 40, message: '...' })
  })

  it('setClipDone marks a clip done with its output path', () => {
    const s = reducer(withList([clip({ id: 'c1' })]), setClipDone({ clipId: 'c1', outputPath: '/out.mp4' }))
    expect(s.list[0].status).toBe('done')
    expect(s.list[0].final_clip_path).toBe('/out.mp4')
  })

  it('toggleSelected adds then removes', () => {
    let s = reducer(init(), toggleSelected('c1'))
    expect(s.selected).toEqual(['c1'])
    s = reducer(s, toggleSelected('c1'))
    expect(s.selected).toEqual([])
  })

  it('selectAll selects every clip in the list', () => {
    const s = reducer(withList([clip({ id: 'a' }), clip({ id: 'b' })]), selectAll())
    expect(s.selected).toEqual(['a', 'b'])
  })

  it('clearSelected empties the selection', () => {
    const seeded = { ...withList([clip({ id: 'a' })]), selected: ['a'] }
    expect(reducer(seeded, clearSelected()).selected).toEqual([])
  })

  it('fetchClips.fulfilled stores the list', () => {
    const list = [clip({ id: 'x' })]
    const s = reducer({ ...init(), loading: true }, { type: fetchClips.fulfilled.type, payload: list })
    expect(s.list).toEqual(list)
    expect(s.loading).toBe(false)
  })

  it('updateTimestamp.fulfilled recomputes duration', () => {
    const s = reducer(withList([clip({ id: 'c1' })]), {
      type: updateTimestamp.fulfilled.type,
      payload: { id: 'c1', start: 5, end: 20 },
    })
    expect(s.list[0].start_seconds).toBe(5)
    expect(s.list[0].end_seconds).toBe(20)
    expect(s.list[0].duration_seconds).toBe(15)
  })

  it('toggleClip.fulfilled flips enabled', () => {
    const s = reducer(withList([clip({ id: 'c1', enabled: true })]), {
      type: toggleClip.fulfilled.type,
      payload: { id: 'c1', enabled: false },
    })
    expect(s.list[0].enabled).toBe(false)
  })

  it('addCustomClip.fulfilled appends a clip', () => {
    const s = reducer(withList([clip({ id: 'a' })]), {
      type: addCustomClip.fulfilled.type,
      payload: clip({ id: 'b' }),
    })
    expect(s.list.map(c => c.id)).toEqual(['a', 'b'])
  })

  it('removeClip.fulfilled removes by id', () => {
    const s = reducer(withList([clip({ id: 'a' }), clip({ id: 'b' })]), {
      type: removeClip.fulfilled.type,
      payload: 'a',
    })
    expect(s.list.map(c => c.id)).toEqual(['b'])
  })
})
