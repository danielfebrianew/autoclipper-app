import { describe, it, expect } from 'vitest'
import reducer, {
  setScreen, openOverlay, closeOverlay, openPreview, setPreviewTab,
  openExport, openDelete, openDeleteProject, openPlay, setActiveProject,
  openOverlayEditor,
} from './uiSlice'

const init = () => reducer(undefined, { type: '@@INIT' })

describe('uiSlice', () => {
  it('has sensible initial state', () => {
    const s = init()
    expect(s.screen).toBe('bootstrap')
    expect(s.overlay).toBeNull()
    expect(s.previewTab).toBe('edit')
  })

  it('setScreen switches screen and clears any open overlay', () => {
    const prev = { ...init(), overlay: 'settings' as const }
    const s = reducer(prev, setScreen('gallery'))
    expect(s.screen).toBe('gallery')
    expect(s.overlay).toBeNull()
  })

  it('openOverlay sets the overlay', () => {
    expect(reducer(init(), openOverlay('log')).overlay).toBe('log')
  })

  it('openPreview sets clip id, preview overlay, and resets tab to edit', () => {
    const seeded = { ...init(), previewTab: 'track' as const }
    const s = reducer(seeded, openPreview('clip-1'))
    expect(s.previewClipId).toBe('clip-1')
    expect(s.overlay).toBe('preview')
    expect(s.previewTab).toBe('edit')
  })

  it('setPreviewTab changes the active tab', () => {
    expect(reducer(init(), setPreviewTab('subtitle')).previewTab).toBe('subtitle')
  })

  it('openExport stores clip ids and opens export overlay', () => {
    const s = reducer(init(), openExport(['a', 'b']))
    expect(s.exportClipIds).toEqual(['a', 'b'])
    expect(s.overlay).toBe('export')
  })

  it('openDelete stores clip ids and opens delete overlay', () => {
    const s = reducer(init(), openDelete(['x']))
    expect(s.deleteClipIds).toEqual(['x'])
    expect(s.overlay).toBe('delete')
  })

  it('openDeleteProject stores project id and opens delete overlay', () => {
    const s = reducer(init(), openDeleteProject('p1'))
    expect(s.deleteProjectId).toBe('p1')
    expect(s.overlay).toBe('delete')
  })

  it('openPlay sets the play target and play overlay', () => {
    const s = reducer(init(), openPlay({ path: '/a.mp4', title: 'A' }))
    expect(s.playTarget).toEqual({ path: '/a.mp4', title: 'A' })
    expect(s.overlay).toBe('play')
  })

  it('closeOverlay clears overlay and all transient ids', () => {
    const seeded = {
      ...init(),
      overlay: 'preview' as const,
      previewClipId: 'c1',
      exportClipIds: ['c1'],
      deleteClipIds: ['c1'],
      deleteProjectId: 'p1',
      playTarget: { path: '/a', title: 'A' },
    }
    const s = reducer(seeded, closeOverlay())
    expect(s.overlay).toBeNull()
    expect(s.previewClipId).toBeNull()
    expect(s.exportClipIds).toBeNull()
    expect(s.deleteClipIds).toBeNull()
    expect(s.deleteProjectId).toBeNull()
    expect(s.playTarget).toBeNull()
  })

  it('setActiveProject sets the active project id', () => {
    expect(reducer(init(), setActiveProject('p9')).activeProjectId).toBe('p9')
  })

  it('openOverlayEditor switches to editor screen with the project id', () => {
    const s = reducer(init(), openOverlayEditor('ovl-1'))
    expect(s.screen).toBe('overlay-editor')
    expect(s.overlayProjectId).toBe('ovl-1')
    expect(s.overlay).toBeNull()
  })
})
