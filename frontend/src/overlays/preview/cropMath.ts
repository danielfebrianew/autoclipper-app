export type Ratio = '9:16' | '1:1' | '4:5'

export const RATIO_VALUE: Record<string, number> = {
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
}

export interface NormBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Zone {
  crop: NormBox  // region of the source video to show (normalized 0-1)
  rect: NormBox  // placement in output canvas (normalized 0-1)
}

// Only two tracking modes remain. Any other value is treated as 'single'.
export const TEMPLATE_META: Record<string, { count: number }> = {
  single: { count: 1 },
  dual:   { count: 2 },
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function cropForFace(
  face: NormBox,
  cropW: number,
  cropH: number,
  topBias: boolean,
): NormBox {
  const faceCenterX = face.x + face.w / 2
  const faceCenterY = face.y + face.h / 2
  const cropX = clamp(faceCenterX - cropW / 2, 0, 1 - cropW)
  const cropY = topBias
    ? clamp(faceCenterY - cropH / 3, 0, 1 - cropH)
    : 0
  return { x: cropX, y: cropY, w: cropW, h: cropH }
}

function centeredCrop(cropW: number, cropH: number, offsetCenterX?: number): NormBox {
  const cx = offsetCenterX !== undefined ? offsetCenterX : 0.5
  const cropX = clamp(cx - cropW / 2, 0, 1 - cropW)
  return { x: cropX, y: 0, w: cropW, h: cropH }
}

export function computeZones(
  template: string,
  ratio: string,
  faces: NormBox[],
  sourceAspect: number,  // e.g. 16/9
  reserveBottom = false,
): Zone[] {
  const isDual = template === 'dual'
  const A = RATIO_VALUE[ratio] ?? RATIO_VALUE['9:16']
  // When reserve_bottom is on, content occupies only the top 60% of the frame.
  const bandH = reserveBottom ? 0.6 : 1

  // --- single: one centered/face-tracked zone filling the (top-band) frame ---
  if (!isDual) {
    // The content box aspect = A / bandH (wider when the band is shorter).
    const boxAspect = A / bandH
    const cropW = clamp(boxAspect / sourceAspect, 0, 1)
    const rect: NormBox = { x: 0, y: 0, w: 1, h: bandH }

    if (faces.length === 0) {
      return [{ crop: centeredCrop(cropW, 1), rect }]
    }
    return [{ crop: cropForFace(faces[0], cropW, 1, false), rect }]
  }

  // --- dual: two zones side-by-side within the (top-band) frame ---
  // Each panel rect is half-width; panel box aspect = (A * 0.5) / bandH.
  const zoneAspect = (A * 0.5) / bandH
  const cropW = clamp(zoneAspect / sourceAspect, 0, 1)
  const rects: NormBox[] = [
    { x: 0,   y: 0, w: 0.5, h: bandH },
    { x: 0.5, y: 0, w: 0.5, h: bandH },
  ]

  if (faces.length === 0) {
    return rects.map((rect, i) => ({
      crop: centeredCrop(cropW, 1, i === 0 ? 0.3 : 0.7),
      rect,
    }))
  }

  const sorted = [...faces].sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2))
  const face0 = sorted[0]
  const face1 = sorted.length > 1 ? sorted[1] : { ...face0, x: clamp(1 - (face0.x + face0.w / 2) - face0.w / 2, 0, 1 - face0.w) }

  return [
    { crop: cropForFace(face0, cropW, 1, false), rect: rects[0] },
    { crop: cropForFace(face1, cropW, 1, false), rect: rects[1] },
  ]
}

export interface FaceSample {
  time: number
  faces: NormBox[]
}

export function facesAt(samples: FaceSample[], time: number): NormBox[] {
  if (samples.length === 0) return []
  let best = samples[0]
  let bestDiff = Math.abs(samples[0].time - time)
  for (const s of samples) {
    const diff = Math.abs(s.time - time)
    if (diff < bestDiff) {
      bestDiff = diff
      best = s
    }
  }
  return best.faces
}
