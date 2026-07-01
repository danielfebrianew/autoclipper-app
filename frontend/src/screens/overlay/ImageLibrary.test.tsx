import { describe, it, expect } from 'vitest'
import { renderWithPlayback, screen, userEvent, waitFor } from '../../test/utils'
import ImageLibrary from './ImageLibrary'

const current = (over: any = {}) => ({
  id: 'ov1', name: 'Overlay One', source_video_path: '/v.mp4', source_clip_id: '',
  video_width: 1080, video_height: 1920, video_fps: 30, video_duration: 12,
  layout: { aspect_ratio: '9:16', image_area_ratio: 0.3 },
  click_sound: { enabled: false, volume: 1 }, cover: null, tracks: [],
  created_at: '', updated_at: '', ...over,
})

const image = (over: any = {}) => ({ id: 'img1', path: '/i.png', name: 'pic', width: 100, height: 100, created_at: '', ...over })

function state(images: any[] = []) {
  return {
    overlay: {
      projects: [], current: current(), images, loading: false,
      saveStatus: 'idle', render: { status: 'idle', percent: 0, message: '', outputPath: '' },
    },
  } as any
}

describe('ImageLibrary', () => {
  it('shows upload actions', () => {
    renderWithPlayback(<ImageLibrary />, { preloadedState: state() })
    expect(screen.getByRole('button', { name: /unggah .* gambar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tambah klip video overlay/i })).toBeInTheDocument()
  })

  it('shows the empty message when there are no images', () => {
    renderWithPlayback(<ImageLibrary />, { preloadedState: state([]) })
    expect(screen.getByText(/belum ada gambar/i)).toBeInTheDocument()
  })

  it('renders image thumbnails', () => {
    const { container } = renderWithPlayback(<ImageLibrary />, { preloadedState: state([image()]) })
    const img = container.querySelector('img[alt="pic"]')!
    expect(img.getAttribute('src')).toBe('/media/i.png')
  })

  it('adds a track when an image thumbnail is clicked', async () => {
    const user = userEvent.setup()
    const { store, container } = renderWithPlayback(<ImageLibrary />, { preloadedState: state([image()]) })
    await user.click(container.querySelector('img[alt="pic"]')!.parentElement!)
    await waitFor(() => expect(store.getState().overlay.current?.tracks.length).toBe(1))
  })

  it('deletes an image via its trash button', async () => {
    const user = userEvent.setup()
    const { store, container } = renderWithPlayback(<ImageLibrary />, { preloadedState: state([image()]) })
    const cell = container.querySelector('img[alt="pic"]')!.parentElement!
    await user.click(cell.querySelector('button')!)
    // deleteOverlayImage.fulfilled removes it from the store → thumbnail gone.
    await waitFor(() => expect(store.getState().overlay.images).toHaveLength(0))
  })
})
