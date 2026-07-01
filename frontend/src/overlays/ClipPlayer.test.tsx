import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, calls } from '../test/utils'
import ClipPlayer from './ClipPlayer'

const stateWith = (playTarget: any) => ({
  ui: {
    screen: 'gallery', overlay: 'play', previewClipId: null, previewTab: 'edit',
    exportClipIds: null, deleteClipIds: null, deleteProjectId: null,
    activeProjectId: null, playTarget, overlayProjectId: null,
  },
}) as any

describe('ClipPlayer', () => {
  it('renders nothing when there is no play target', () => {
    const { container } = renderWithStore(<ClipPlayer />, { preloadedState: stateWith(null) })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the title and a video with the /media src', () => {
    renderWithStore(<ClipPlayer />, {
      preloadedState: stateWith({ path: '/out/clip.mp4', title: 'My Clip' }),
    })
    expect(screen.getByText('My Clip')).toBeInTheDocument()
    const video = document.querySelector('video')!
    expect(video.getAttribute('src')).toBe('/media/out/clip.mp4')
  })

  it('opens the containing folder', async () => {
    const user = userEvent.setup()
    renderWithStore(<ClipPlayer />, {
      preloadedState: stateWith({ path: '/out/sub/clip.mp4', title: 'C' }),
    })
    await user.click(screen.getByRole('button', { name: /buka folder/i }))
    expect(calls.OpenFolder).toContainEqual(['/out/sub'])
  })

  it('closes the overlay when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<ClipPlayer />, {
      preloadedState: stateWith({ path: '/c.mp4', title: 'C' }),
    })
    // The outermost element is the backdrop.
    await user.click(document.querySelector('.absolute.inset-0')!)
    expect(store.getState().ui.overlay).toBeNull()
  })
})
