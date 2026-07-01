import { describe, it, expect } from 'vitest'
import reducer, {
  setActiveVid, toggleGalleryItem, selectAllGallery, clearGallerySelected, fetchGallery,
} from './gallerySlice'

const init = () => reducer(undefined, { type: '@@INIT' })

describe('gallerySlice', () => {
  it('defaults to "all" with nothing selected', () => {
    const s = init()
    expect(s.activeVid).toBe('all')
    expect(s.selected).toEqual([])
  })

  it('setActiveVid changes the active video filter', () => {
    expect(reducer(init(), setActiveVid('proj-1')).activeVid).toBe('proj-1')
  })

  it('toggleGalleryItem adds then removes an id', () => {
    let s = reducer(init(), toggleGalleryItem('a'))
    expect(s.selected).toEqual(['a'])
    s = reducer(s, toggleGalleryItem('a'))
    expect(s.selected).toEqual([])
  })

  it('selectAllGallery replaces the selection', () => {
    const s = reducer(init(), selectAllGallery(['a', 'b', 'c']))
    expect(s.selected).toEqual(['a', 'b', 'c'])
  })

  it('clearGallerySelected empties the selection', () => {
    const seeded = { ...init(), selected: ['a', 'b'] }
    expect(reducer(seeded, clearGallerySelected()).selected).toEqual([])
  })

  it('fetchGallery.pending sets loading', () => {
    expect(reducer(init(), { type: fetchGallery.pending.type }).loading).toBe(true)
  })

  it('fetchGallery.fulfilled stores items and clears loading', () => {
    const items = [{ id: 'g1' }, { id: 'g2' }]
    const s = reducer({ ...init(), loading: true }, { type: fetchGallery.fulfilled.type, payload: items })
    expect(s.items).toEqual(items)
    expect(s.loading).toBe(false)
  })

  it('fetchGallery.fulfilled tolerates a null payload', () => {
    const s = reducer(init(), { type: fetchGallery.fulfilled.type, payload: null })
    expect(s.items).toEqual([])
  })

  it('fetchGallery.rejected clears loading', () => {
    const s = reducer({ ...init(), loading: true }, { type: fetchGallery.rejected.type })
    expect(s.loading).toBe(false)
  })
})
