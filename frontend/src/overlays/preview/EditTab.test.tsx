import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent, waitFor, calls } from '../../test/utils'
import EditTab from './EditTab'
import type { Clip } from '../../store/slices/clipSlice'

const clip = (over: Partial<Clip> = {}): Clip => ({
  id: 'c1', hook: 'Hook text', summary: 'Summary text',
  viral_score: 80, content_score: 70, engagement_score: 60,
  transcript_excerpt: 'transcript here', start_seconds: 0, end_seconds: 30,
} as Clip)

function setup(props: Partial<Parameters<typeof EditTab>[0]> = {}) {
  const onRatioChange = vi.fn()
  const onShowCropChange = vi.fn()
  const onShowCaptionChange = vi.fn()
  render(
    <EditTab
      clip={clip()}
      inPoint={0}
      outPoint={30}
      ratio="9:16"
      showCrop
      showCaption
      onRatioChange={onRatioChange}
      onShowCropChange={onShowCropChange}
      onShowCaptionChange={onShowCaptionChange}
      {...props}
    />,
  )
  return { onRatioChange, onShowCropChange, onShowCaptionChange }
}

describe('EditTab', () => {
  it('shows trim info (IN / OUT / Dur) and clip metadata', () => {
    setup()
    expect(screen.getByText('IN')).toBeInTheDocument()
    expect(screen.getByText('OUT')).toBeInTheDocument()
    expect(screen.getByText('Dur')).toBeInTheDocument()
    expect(screen.getByText('Hook text')).toBeInTheDocument()
    expect(screen.getByText('Summary text')).toBeInTheDocument()
    expect(screen.getByText('transcript here')).toBeInTheDocument()
  })

  it('changes ratio and persists it via SetClipAspectRatio', async () => {
    const user = userEvent.setup()
    const { onRatioChange } = setup()
    await user.click(screen.getByRole('button', { name: '1:1' }))
    expect(onRatioChange).toHaveBeenCalledWith('1:1')
    await waitFor(() => expect(calls.SetClipAspectRatio).toContainEqual(['c1', '1:1']))
  })

  it('toggles the face-track and caption overlays', async () => {
    const user = userEvent.setup()
    const { onShowCropChange, onShowCaptionChange } = setup()
    const toggles = screen.getAllByRole('button').filter(b => b.className.includes('toggle'))
    await user.click(toggles[0])
    await user.click(toggles[1])
    expect(onShowCropChange).toHaveBeenCalledWith(false)
    expect(onShowCaptionChange).toHaveBeenCalledWith(false)
  })
})
