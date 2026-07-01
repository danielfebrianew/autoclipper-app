import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, mockResolved } from '../../test/utils'
import { GalleryColumn } from './GalleryColumn'

const item = (over: any = {}) => ({
  id: 'g1', project_id: 'p1', source_title: 'Video One', hook: 'h', category: 'c',
  viral_score: 70, duration_seconds: 120, final_clip_path: '/a.mp4', status: 'done', ...over,
})

function state(items: any[], activeVid = 'all') {
  return {
    gallery: { items, activeVid, selected: [], loading: false },
  } as any
}

describe('GalleryColumn', () => {
  // Mount effect re-fetches; seed GetGallery so preloaded items stick.
  const render = (items: any[]) => {
    mockResolved('GetGallery', items)
    return renderWithStore(<GalleryColumn />, { preloadedState: state(items) })
  }

  it('shows the "Semua klip" entry', () => {
    render([item(), item({ id: 'g2' })])
    expect(screen.getByText('Semua klip')).toBeInTheDocument()
  })

  it('lists a per-project group button', async () => {
    render([item({ project_id: 'pA', source_title: 'Alpha' })])
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
  })

  it('sets the active video filter when a group is clicked', async () => {
    const user = userEvent.setup()
    mockResolved('GetGallery', [item({ project_id: 'pA', source_title: 'Alpha' })])
    const { store } = renderWithStore(<GalleryColumn />, {
      preloadedState: state([item({ project_id: 'pA', source_title: 'Alpha' })]),
    })
    await user.click(await screen.findByText('Alpha'))
    await waitFor(() => expect(store.getState().gallery.activeVid).toBe('pA'))
  })
})
