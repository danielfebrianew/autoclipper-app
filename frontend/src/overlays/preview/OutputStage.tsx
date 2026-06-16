import { useEffect, useRef } from 'react'
import { Zone } from './cropMath'
import { GLRenderer, fetchFrameBitmap } from './glRenderer'

interface CaptionStyle {
  preset: string   // bold|clean|box|mono|glow
  position: string // top|mid|bot
  size: string     // S|M|L
  text: string
}

interface Props {
  src: string          // /media<abs-path> (untuk fallback) — kita pakai videoPath utk decoder
  videoPath: string    // path absolut video di disk (untuk /preview/frame)
  currentTime: number
  ratio: string          // '9:16' | '1:1' | '4:5'
  zones: Zone[]
  caption: CaptionStyle
  showCaption: boolean
  transcript?: string    // live transcript segment spoken at currentTime
}

const RATIO_ASPECT: Record<string, string> = {
  '9:16': '9/16',
  '1:1': '1/1',
  '4:5': '4/5',
}

const FONT_SIZE: Record<string, number> = { S: 11, M: 14, L: 18 }

const POSITION_STYLE: Record<string, React.CSSProperties> = {
  top: { top: '8%', bottom: 'auto' },
  mid: { top: '50%', transform: 'translateY(-50%)', bottom: 'auto' },
  bot: { bottom: '8%', top: 'auto' },
}

function captionCSS(preset: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 800,
    lineHeight: 1.3,
    textAlign: 'center',
    padding: '4px 10px',
    borderRadius: 6,
    maxWidth: '88%',
    wordBreak: 'break-word',
  }
  switch (preset) {
    case 'bold':  return { ...base, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.9)', background: 'transparent' }
    case 'clean': return { ...base, color: '#fff', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }
    case 'box':   return { ...base, color: '#fff', background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)' }
    case 'mono':  return { ...base, color: '#00ff99', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.7)' }
    case 'glow':  return { ...base, color: '#fff', textShadow: '0 0 12px rgba(123,97,255,1), 0 0 24px rgba(123,97,255,0.6)', background: 'transparent' }
    default:      return base
  }
}

// Resolusi render canvas (tinggi output). Lebar dihitung dari ratio.
const OUT_H = 960
const OUT_W: Record<string, number> = {
  '9:16': Math.round(OUT_H * 9 / 16),
  '1:1': OUT_H,
  '4:5': Math.round(OUT_H * 4 / 5),
}

export default function OutputStage({ videoPath, currentTime, ratio, zones, caption, showCaption, transcript }: Props) {
  const aspect = RATIO_ASPECT[ratio] || '9/16'
  const posStyle = POSITION_STYLE[caption.position] || POSITION_STYLE.bot
  const isDual = zones.length > 1

  // Satu WebGL renderer per zona (single = 1 canvas, dual = 2).
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const rendererRefs = useRef<(GLRenderer | null)[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const lastFetchedTime = useRef<number>(-1)

  // Inisialisasi renderer saat canvas siap / jumlah zona berubah.
  useEffect(() => {
    rendererRefs.current.forEach(r => r?.dispose())
    rendererRefs.current = canvasRefs.current.map(c => {
      if (!c) return null
      try {
        return new GLRenderer(c)
      } catch (e) {
        console.error('GLRenderer init gagal:', e)
        return null
      }
    })
    lastFetchedTime.current = -1 // paksa fetch ulang
    return () => {
      rendererRefs.current.forEach(r => r?.dispose())
      rendererRefs.current = []
    }
  }, [zones.length])

  // Fetch frame native + gambar tiap zona saat currentTime / zones berubah.
  useEffect(() => {
    if (!videoPath || zones.length === 0) return

    // Debounce kecil: hindari fetch berlebih saat scrubbing cepat.
    const needFetch = Math.abs(currentTime - lastFetchedTime.current) > 0.001

    let cancelled = false
    const run = async () => {
      try {
        if (needFetch) {
          abortRef.current?.abort()
          const ac = new AbortController()
          abortRef.current = ac
          const { bitmap } = await fetchFrameBitmap(videoPath, currentTime, 82, ac.signal)
          if (cancelled) { bitmap.close?.(); return }
          lastFetchedTime.current = currentTime
          // Upload frame yang sama ke semua renderer (dual = crop berbeda dari frame sama).
          rendererRefs.current.forEach(r => r?.setFrame(bitmap))
          bitmap.close?.()
        }
        zones.forEach((zone, i) => {
          const r = rendererRefs.current[i]
          if (!r) return
          const ow = OUT_W[ratio] ?? OUT_W['9:16']
          // Untuk dual stack, tiap zona setengah tinggi → canvas ow x (OUT_H * rect.h)
          const oh = Math.round(OUT_H * zone.rect.h)
          const cw = isDual ? Math.round(ow * zone.rect.w) : ow
          r.draw(zone.crop, cw, oh)
        })
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error('frame fetch/draw:', e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [videoPath, currentTime, zones, ratio, isDual])

  return (
    <div style={{
      position: 'relative', borderRadius: 14, overflow: 'hidden',
      background: '#0a0712', border: '1px solid var(--color-accent-line)',
      aspectRatio: aspect,
      width: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
      margin: 'auto',
    }}>
      {videoPath ? zones.map((zone, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${zone.rect.x * 100}%`,
            top: `${zone.rect.y * 100}%`,
            width: `${zone.rect.w * 100}%`,
            height: `${zone.rect.h * 100}%`,
            overflow: 'hidden',
            borderTop: isDual && i > 0 ? '1px solid rgba(123,97,255,0.3)' : undefined,
          }}
        >
          <canvas
            ref={el => { canvasRefs.current[i] = el }}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      )) : (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-faint)', fontSize: 11,
        }}>
          Output {ratio}
        </div>
      )}

      {/* Subtitle (libass-equivalent): override manual statis, atau transcript live. */}
      {showCaption && (caption.text || transcript) && (
        <div style={{
          position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 2,
          ...posStyle,
        }}>
          <span style={{ ...captionCSS(caption.preset), fontSize: FONT_SIZE[caption.size] || 14 }}>
            {caption.text || transcript}
          </span>
        </div>
      )}

      {/* Ratio badge */}
      <div style={{
        position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)',
        borderRadius: 6, padding: '3px 7px', fontSize: 10, fontFamily: 'var(--font-mono)',
        color: 'var(--color-accent-hi)', pointerEvents: 'none', zIndex: 3,
      }}>
        {ratio}
      </div>
    </div>
  )
}
