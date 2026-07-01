import { describe, it, expect } from 'vitest'
import { computeZones, facesAt, RATIO_VALUE, TEMPLATE_META, NormBox, FaceSample } from './cropMath'

const SOURCE_ASPECT = 16 / 9 // 1.777…

function inUnitBox(b: NormBox) {
  expect(b.x).toBeGreaterThanOrEqual(0)
  expect(b.y).toBeGreaterThanOrEqual(0)
  expect(b.x + b.w).toBeLessThanOrEqual(1 + 1e-9)
  expect(b.y + b.h).toBeLessThanOrEqual(1 + 1e-9)
}

describe('computeZones', () => {
  describe('static template', () => {
    it('returns one centered full-frame zone with no face tracking', () => {
      const zones = computeZones('static', '9:16', [], SOURCE_ASPECT)
      expect(zones).toHaveLength(1)
      expect(zones[0].rect).toEqual({ x: 0, y: 0, w: 1, h: 1 })
      // crop should be horizontally centered
      const crop = zones[0].crop
      expect(crop.x).toBeCloseTo((1 - crop.w) / 2, 5)
      inUnitBox(crop)
    })

    it('ignores faces for the static template', () => {
      const face: NormBox = { x: 0.8, y: 0.1, w: 0.1, h: 0.2 }
      const withFace = computeZones('static', '9:16', [face], SOURCE_ASPECT)
      const without = computeZones('static', '9:16', [], SOURCE_ASPECT)
      expect(withFace[0].crop).toEqual(without[0].crop)
    })
  })

  describe('single template', () => {
    it('returns a centered crop when no faces are present', () => {
      const zones = computeZones('single', '9:16', [], SOURCE_ASPECT)
      expect(zones).toHaveLength(1)
      const crop = zones[0].crop
      expect(crop.x).toBeCloseTo((1 - crop.w) / 2, 5)
      inUnitBox(crop)
    })

    it('follows the face center horizontally when a face is given', () => {
      const face: NormBox = { x: 0.1, y: 0.3, w: 0.1, h: 0.2 } // center x = 0.15
      const zones = computeZones('single', '9:16', [face], SOURCE_ASPECT)
      const crop = zones[0].crop
      // crop is pulled left toward the face (clamped at 0)
      expect(crop.x).toBeLessThan((1 - crop.w) / 2)
      inUnitBox(crop)
    })

    it('clamps the crop inside the frame for a face at the far right edge', () => {
      const face: NormBox = { x: 0.95, y: 0.3, w: 0.1, h: 0.2 }
      const zones = computeZones('single', '9:16', [face], SOURCE_ASPECT)
      inUnitBox(zones[0].crop)
    })
  })

  describe('single_top template', () => {
    it('is flagged with topBias in the template metadata', () => {
      expect(TEMPLATE_META.single_top.topBias).toBe(true)
    })

    it('produces a valid in-frame crop that follows the face horizontally', () => {
      const face: NormBox = { x: 0.4, y: 0.6, w: 0.1, h: 0.2 }
      const zones = computeZones('single_top', '9:16', [face], SOURCE_ASPECT)
      expect(zones).toHaveLength(1)
      inUnitBox(zones[0].crop)
    })

    it('moves the crop vertically toward the face when the crop is shorter than the frame', () => {
      // A tall source (portrait) into a 1:1 output yields cropH < 1, so the
      // top bias can actually shift cropY above 0.
      const tallAspect = 9 / 16
      const face: NormBox = { x: 0.4, y: 0.8, w: 0.1, h: 0.1 }
      const zones = computeZones('single_top', '1:1', [face], tallAspect)
      expect(zones[0].crop.y).toBeGreaterThan(0)
      inUnitBox(zones[0].crop)
    })
  })

  describe('dual template (stacked)', () => {
    it('returns two half-height zones stacked vertically', () => {
      const zones = computeZones('dual', '9:16', [], SOURCE_ASPECT)
      expect(zones).toHaveLength(2)
      expect(zones[0].rect).toEqual({ x: 0, y: 0, w: 1, h: 0.5 })
      expect(zones[1].rect).toEqual({ x: 0, y: 0.5, w: 1, h: 0.5 })
    })

    it('sorts two faces left-to-right into the two zones', () => {
      const right: NormBox = { x: 0.7, y: 0.2, w: 0.1, h: 0.2 }
      const left: NormBox = { x: 0.1, y: 0.2, w: 0.1, h: 0.2 }
      const zones = computeZones('dual', '9:16', [right, left], SOURCE_ASPECT)
      // zone 0 should track the left face → smaller crop.x than zone 1
      expect(zones[0].crop.x).toBeLessThanOrEqual(zones[1].crop.x)
      zones.forEach(z => inUnitBox(z.crop))
    })

    it('mirrors a single face into the second zone as a fallback', () => {
      const only: NormBox = { x: 0.2, y: 0.2, w: 0.1, h: 0.2 }
      const zones = computeZones('dual', '9:16', [only], SOURCE_ASPECT)
      expect(zones).toHaveLength(2)
      zones.forEach(z => inUnitBox(z.crop))
    })
  })

  describe('dual_side template', () => {
    it('returns two half-width zones side by side', () => {
      const zones = computeZones('dual_side', '9:16', [], SOURCE_ASPECT)
      expect(zones).toHaveLength(2)
      expect(zones[0].rect).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
      expect(zones[1].rect).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    })
  })

  describe('fallback', () => {
    it('treats an unknown template as single', () => {
      const zones = computeZones('does-not-exist', '9:16', [], SOURCE_ASPECT)
      expect(zones).toHaveLength(1)
      expect(zones[0].rect).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    })

    it('falls back to 9:16 ratio value for an unknown ratio', () => {
      const known = computeZones('single', '9:16', [], SOURCE_ASPECT)
      const unknown = computeZones('single', 'bogus', [], SOURCE_ASPECT)
      expect(unknown[0].crop.w).toBeCloseTo(known[0].crop.w, 5)
    })
  })
})

describe('facesAt', () => {
  const samples: FaceSample[] = [
    { time: 0, faces: [{ x: 0, y: 0, w: 0.1, h: 0.1 }] },
    { time: 1, faces: [{ x: 0.5, y: 0, w: 0.1, h: 0.1 }] },
    { time: 2, faces: [{ x: 0.9, y: 0, w: 0.1, h: 0.1 }] },
  ]

  it('returns an empty array when there are no samples', () => {
    expect(facesAt([], 1.2)).toEqual([])
  })

  it('returns the faces of the nearest sample by time', () => {
    expect(facesAt(samples, 0.9)).toEqual(samples[1].faces)
    expect(facesAt(samples, 1.6)).toEqual(samples[2].faces)
  })

  it('returns the exact sample on an exact time match', () => {
    expect(facesAt(samples, 0)).toEqual(samples[0].faces)
  })
})

describe('metadata tables', () => {
  it('exposes ratio values', () => {
    expect(RATIO_VALUE['9:16']).toBeCloseTo(9 / 16, 5)
    expect(RATIO_VALUE['1:1']).toBe(1)
  })

  it('exposes template counts', () => {
    expect(TEMPLATE_META.single.count).toBe(1)
    expect(TEMPLATE_META.dual.count).toBe(2)
    expect(TEMPLATE_META.static.count).toBe(0)
  })
})
