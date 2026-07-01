import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '../../test/utils'
import LibraryCard from './LibraryCard'
import type { LibraryVideo } from '../../store/slices/librarySlice'

const video = (over: Partial<LibraryVideo> = {}): LibraryVideo => ({
  video_id: 'v1', title: 'My Video', youtube_url: 'https://y/1', created_at: '',
  duration: 3720, source_bytes: 1024 * 1024 * 200, file_exists: true, video_path: '/v.mp4',
  clip_count: 4, project_count: 2, status: 'ready', thumb_path: '',
  ...over,
} as LibraryVideo)

function renderCard(over: Partial<LibraryVideo> = {}, busy = false) {
  const onOpen = vi.fn(); const onDelete = vi.fn(); const onRedownload = vi.fn()
  const { container } = render(<LibraryCard video={video(over)} busy={busy} onOpen={onOpen} onDelete={onDelete} onRedownload={onRedownload} />)
  return { container, onOpen, onDelete, onRedownload }
}

describe('LibraryCard', () => {
  it('shows title, duration, size and clip count', () => {
    const { container } = renderCard()
    expect(screen.getByText('My Video')).toBeInTheDocument()
    expect(screen.getByText('1j 2m')).toBeInTheDocument()   // 3720s → 1h 2m
    expect(screen.getByText('200 MB')).toBeInTheDocument()
    // Icon-adjacent text is best asserted on the whole card content.
    expect(container.textContent).toContain('4 klip')
    expect(container.textContent).toContain('2 set')
  })

  it('shows a "file hilang" state and offers re-download when the file is missing', async () => {
    const user = userEvent.setup()
    const { container, onRedownload } = renderCard({ file_exists: false })
    expect(container.textContent).toContain('file hilang')
    await user.click(screen.getByRole('button', { name: /download ulang/i }))
    expect(onRedownload).toHaveBeenCalled()
  })

  it('deletes the source file when present', async () => {
    const user = userEvent.setup()
    const { onDelete } = renderCard({ file_exists: true })
    await user.click(screen.getByRole('button', { name: /hapus file sumber/i }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('shows a processing spinner and hides action buttons when analyzing', () => {
    const { container } = renderCard({ status: 'analyzing' })
    expect(container.textContent).toContain('Mencari klip')
    expect(screen.queryByRole('button', { name: /lihat project/i })).toBeNull()
  })

  it('opens the detail view via the primary button', async () => {
    const user = userEvent.setup()
    const { onOpen } = renderCard()
    await user.click(screen.getByRole('button', { name: /lihat project/i }))
    expect(onOpen).toHaveBeenCalled()
  })
})
