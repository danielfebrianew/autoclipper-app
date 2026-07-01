import { describe, it, expect } from 'vitest'
import { renderWithPlayback, screen } from '../../../test/utils'
import Timeline from './Timeline'

const track = (over: any = {}) => ({
  id: 't1', kind: 'image', asset_path: '/a.png', asset_name: 'Layer A',
  start_sec: 1, end_sec: 4, trim_start_sec: 0, fit_override: '', click_enabled: null,
  sort_order: 0, ...over,
})

const current = (over: any = {}) => ({
  id: 'ov1', name: 'Overlay One', source_video_path: '/v.mp4', source_clip_id: '',
  video_width: 1080, video_height: 1920, video_fps: 30, video_duration: 20,
  layout: { aspect_ratio: '9:16', image_area_ratio: 0.3 },
  click_sound: { enabled: false, volume: 1 }, cover: null, tracks: [], ...over,
})

function state(tracks: any[]) {
  return {
    overlay: {
      projects: [], current: current({ tracks }), images: [], loading: false,
      saveStatus: 'idle', render: { status: 'idle', percent: 0, message: '', outputPath: '' },
    },
  } as any
}

describe('overlay Timeline', () => {
  it('renders track chips with their asset names', () => {
    renderWithPlayback(<Timeline />, { preloadedState: state([track({ asset_name: 'Layer A' })]) })
    expect(screen.getByText('Layer A')).toBeInTheDocument()
  })

  it('renders multiple tracks', () => {
    renderWithPlayback(<Timeline />, {
      preloadedState: state([track({ id: 't1', asset_name: 'A' }), track({ id: 't2', asset_name: 'B' })]),
    })
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renders the ruler time labels', () => {
    renderWithPlayback(<Timeline />, { preloadedState: state([]) })
    // Ruler always renders a 0:00 tick.
    expect(screen.getAllByText('0:00').length).toBeGreaterThanOrEqual(1)
  })
})
