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
  describe('single template', () => {
    it('returns one full-frame centered crop when no faces are present', () => {
      const zones = computeZones('single', '9:16', [], SOURCE_ASPECT)
      expect(zones).toHaveLength(1)
      expect(zones[0].rect).toEqual({ x: 0, y: 0, w: 1, h: 1 })
      const crop = zones[0].crop
      expect(crop.x).toBeCloseTo((1 - crop.w) / 2, 5)
      inUnitBox(crop)
    })

    it('follows the face center horizontally when a face is given', () => {
      const face: NormBox = { x: 0.1, y: 0.3, w: 0.1, h: 0.2 } // center x = 0.15
      const zones = computeZones('single', '9:16', [face], SOURCE_ASPECT)
      const crop = zones[0].crop
      expect(crop.x).toBeLessThan((1 - crop.w) / 2)
      inUnitBox(crop)
    })

    it('clamps the crop inside the frame for a face at the far right edge', () => {
      const face: NormBox = { x: 0.95, y: 0.3, w: 0.1, h: 0.2 }
      const zones = computeZones('single', '9:16', [face], SOURCE_ASPECT)
      inUnitBox(zones[0].crop)
    })

    it('reserves the bottom 40% (rect.h=0.6) and widens the crop when reserveBottom is on', () => {
      const full = computeZones('single', '9:16', [], SOURCE_ASPECT, false)
      const band = computeZones('single', '9:16', [], SOURCE_ASPECT, true)
      expect(band[0].rect.h).toBeCloseTo(0.6, 5)
      // Wider box aspect (A/0.6) → wider crop than full-frame.
      expect(band[0].crop.w).toBeGreaterThan(full[0].crop.w)
      inUnitBox(band[0].crop)
    })
  })

  describe('dual template (side-by-side)', () => {
    it('returns two half-width zones side by side', () => {
      const zones = computeZones('dual', '9:16', [], SOURCE_ASPECT)
      expect(zones).toHaveLength(2)
      expect(zones[0].rect).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
      expect(zones[1].rect).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
    })

    it('sorts two faces left-to-right into the two zones', () => {
      const right: NormBox = { x: 0.7, y: 0.2, w: 0.1, h: 0.2 }
      const left: NormBox = { x: 0.1, y: 0.2, w: 0.1, h: 0.2 }
      const zones = computeZones('dual', '9:16', [right, left], SOURCE_ASPECT)
      expect(zones[0].crop.x).toBeLessThanOrEqual(zones[1].crop.x)
      zones.forEach(z => inUnitBox(z.crop))
    })

    it('applies the bottom band to both panels when reserveBottom is on', () => {
      const zones = computeZones('dual', '9:16', [], SOURCE_ASPECT, true)
      expect(zones).toHaveLength(2)
      expect(zones[0].rect.h).toBeCloseTo(0.6, 5)
      expect(zones[1].rect.h).toBeCloseTo(0.6, 5)
      zones.forEach(z => inUnitBox(z.crop))
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
  })
})
