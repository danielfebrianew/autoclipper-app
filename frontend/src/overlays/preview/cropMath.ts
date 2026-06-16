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

export const TEMPLATE_META: Record<string, { count: number; stack?: boolean; topBias?: boolean; fixed?: boolean }> = {
  single:     { count: 1 },
  single_top: { count: 1, topBias: true },
  dual:       { count: 2, stack: true },
  dual_side:  { count: 2, stack: false },
  speaker:    { count: 1 },
  static:     { count: 0, fixed: true },
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
): Zone[] {
  const meta = TEMPLATE_META[template] ?? TEMPLATE_META.single
  const A = RATIO_VALUE[ratio] ?? RATIO_VALUE['9:16']

  // --- static: fixed centered crop, no face tracking ---
  if (meta.fixed || meta.count === 0) {
    const cropW = clamp(A / sourceAspect, 0, 1)
    const cropH = clamp(cropW > 0 ? 1 : sourceAspect / A, 0, 1)
    return [{ crop: centeredCrop(cropW, cropH), rect: { x: 0, y: 0, w: 1, h: 1 } }]
  }

  // --- single zone templates (single, single_top, speaker) ---
  if (meta.count === 1) {
    const cropH = 1
    const cropW = clamp(A / sourceAspect, 0, 1)
    const adjustedCropH = cropW === A / sourceAspect ? cropH : clamp(sourceAspect / A, 0, 1)

    if (faces.length === 0) {
      return [{ crop: centeredCrop(cropW, adjustedCropH), rect: { x: 0, y: 0, w: 1, h: 1 } }]
    }
    const crop = cropForFace(faces[0], cropW, adjustedCropH, meta.topBias ?? false)
    return [{ crop, rect: { x: 0, y: 0, w: 1, h: 1 } }]
  }

  // --- dual (2 zones stacked top/bottom) ---
  if (meta.count === 2 && meta.stack) {
    // Each zone rect is half-height; zone aspect = A * rect.w / rect.h = A * 1 / 0.5 = 2A
    const zoneAspect = 2 * A
    const cropH = 1
    const cropW = clamp(zoneAspect / sourceAspect, 0, 1)

    const rects: NormBox[] = [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ]

    if (faces.length === 0) {
      return rects.map((rect, i) => ({
        crop: centeredCrop(cropW, cropH, i === 0 ? 0.3 : 0.7),
        rect,
      }))
    }

    const sorted = [...faces].sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2))
    const face0 = sorted[0]
    const face1 = sorted.length > 1 ? sorted[1] : { ...face0, x: clamp(1 - (face0.x + face0.w / 2) - face0.w / 2, 0, 1 - face0.w) }

    return [
      { crop: cropForFace(face0, cropW, cropH, false), rect: rects[0] },
      { crop: cropForFace(face1, cropW, cropH, false), rect: rects[1] },
    ]
  }

  // --- dual_side (2 zones side-by-side) ---
  if (meta.count === 2 && !meta.stack) {
    // Each zone rect is half-width; zone aspect = A * 0.5 / 1 = A/2
    const zoneAspect = A / 2
    const cropH = 1
    const cropW = clamp(zoneAspect / sourceAspect, 0, 1)

    const rects: NormBox[] = [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ]

    if (faces.length === 0) {
      return rects.map((_, i) => ({
        crop: centeredCrop(cropW, cropH, i === 0 ? 0.3 : 0.7),
        rect: rects[i],
      }))
    }

    const sorted = [...faces].sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2))
    const face0 = sorted[0]
    const face1 = sorted.length > 1 ? sorted[1] : { ...face0, x: clamp(1 - (face0.x + face0.w / 2) - face0.w / 2, 0, 1 - face0.w) }

    return [
      { crop: cropForFace(face0, cropW, cropH, false), rect: rects[0] },
      { crop: cropForFace(face1, cropW, cropH, false), rect: rects[1] },
    ]
  }

  // Fallback: single centered
  const cropW = clamp(A / sourceAspect, 0, 1)
  return [{ crop: centeredCrop(cropW, 1), rect: { x: 0, y: 0, w: 1, h: 1 } }]
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
