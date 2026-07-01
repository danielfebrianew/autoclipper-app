import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, mockResolved } from '../../test/utils'
import GalleryMain from './GalleryMain'

const item = (over: any = {}) => ({
  id: 'g1', project_id: 'p1', source_title: 'Video One', hook: 'My Clip', category: 'tutorial',
  viral_score: 70, duration_seconds: 90, final_clip_path: '/a.mp4', status: 'done', ...over,
})

function state(items: any[], selected: string[] = [], activeVid = 'all') {
  return { gallery: { items, activeVid, selected, loading: false } } as any
}

describe('GalleryMain', () => {
  // Mount effect re-fetches; seed GetGallery so preloaded items stick.
  const render = (items: any[], selected: string[] = []) => {
    mockResolved('GetGallery', items)
    return renderWithStore(<GalleryMain />, { preloadedState: state(items, selected) })
  }

  it('renders the clip count and cards', async () => {
    render([item()])
    expect(await screen.findByText('My Clip')).toBeInTheDocument()
    // "1 klip" appears both in the toolbar and any group header, so match ≥1.
    expect(screen.getAllByText(/1 klip/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows the empty state with no items', async () => {
    render([])
    expect(await screen.findByText(/belum ada klip di galeri/i)).toBeInTheDocument()
  })

  it('selects all clips via the toolbar checkbox', async () => {
    const user = userEvent.setup()
    const { store } = render([item(), item({ id: 'g2' })])
    await screen.findAllByText('My Clip')
    // The first button in the toolbar is the select-all checkbox.
    const selectAll = screen.getAllByRole('button')[0]
    await user.click(selectAll)
    await waitFor(() => expect(store.getState().gallery.selected).toEqual(['g1', 'g2']))
  })

  it('shows export + delete actions once items are selected', async () => {
    render([item()], ['g1'])
    expect(await screen.findByRole('button', { name: /ekspor \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hapus/i })).toBeInTheDocument()
  })

  it('opens the export overlay from the toolbar', async () => {
    const user = userEvent.setup()
    const { store } = render([item()], ['g1'])
    await user.click(await screen.findByRole('button', { name: /ekspor \(1\)/i }))
    expect(store.getState().ui.overlay).toBe('export')
  })
})
