import { useRef, useState } from 'react'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { SetClipCaptionStyle, SetClipCaptionOpts, SaveCaption, RegenerateCaption } from '../../../wailsjs/go/main/App'
import { toastError, toastSuccess } from '../../lib/toast'

const PRESETS = [
  { id: 'bold',  label: 'Bold',  desc: 'Tebal, shadow kuat',  color: '#fff', bg: 'transparent', shadow: '0 2px 8px rgba(0,0,0,0.9)' },
  { id: 'clean', label: 'Clean', desc: 'Frosted glass ringan', color: '#fff', bg: 'rgba(0,0,0,0.45)', shadow: 'none' },
  { id: 'box',   label: 'Box',   desc: 'Kotak solid gelap',   color: '#fff', bg: 'rgba(0,0,0,0.75)', shadow: 'none' },
  { id: 'mono',  label: 'Mono',  desc: 'Terminal hijau',      color: '#00ff99', bg: 'rgba(0,0,0,0.7)', shadow: 'none' },
  { id: 'glow',  label: 'Glow',  desc: 'Glow ungu neon',      color: '#fff', bg: 'transparent', shadow: '0 0 12px rgba(123,97,255,1)' },
]
const POSITIONS = ['top', 'mid', 'bot']
const SIZES = ['S', 'M', 'L']

interface Props {
  clipId: string
  preset: string
  position: string
  size: string
  text: string
  onPresetChange: (p: string) => void
  onPositionChange: (p: string) => void
  onSizeChange: (s: string) => void
  onTextChange: (t: string) => void
}

export default function CaptionTab({
  clipId, preset, position, size, text,
  onPresetChange, onPositionChange, onSizeChange, onTextChange,
}: Props) {
  const [regenerating, setRegenerating] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handlePreset(id: string) {
    onPresetChange(id)
    SetClipCaptionStyle(clipId, id).catch(() => {})
  }

  function handlePosition(p: string) {
    onPositionChange(p)
    SetClipCaptionOpts(clipId, { position: p, size }).catch(() => {})
  }

  function handleSize(s: string) {
    onSizeChange(s)
    SetClipCaptionOpts(clipId, { position, size: s }).catch(() => {})
  }

  function handleText(t: string) {
    onTextChange(t)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      SaveCaption(clipId, t).catch(() => {})
    }, 400)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const result = await RegenerateCaption(clipId)
      onTextChange(result)
      toastSuccess('Caption diperbarui')
    } catch (e: any) {
      toastError(e?.message || 'Gagal regenerasi caption')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Preset cards */}
      <section>
        <Label>Gaya caption</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => handlePreset(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
                background: preset === p.id ? 'rgba(123,97,255,0.18)' : 'rgba(255,255,255,0.04)',
                border: preset === p.id ? '1px solid var(--color-accent-lo)' : '1px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              {/* Mini preview */}
              <div style={{
                width: 48, height: 28, borderRadius: 5, overflow: 'hidden',
                background: 'linear-gradient(135deg,#1a1030,#0d0820)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                padding: 2, flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 7, fontWeight: 800, color: p.color,
                  background: p.bg, textShadow: p.shadow, padding: '1px 4px', borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}>
                  Caption
                </span>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)' }}>{p.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--color-faint)' }}>{p.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Position + Size */}
      <section>
        <Label>Posisi</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          {POSITIONS.map(p => (
            <button key={p} onClick={() => handlePosition(p)}
              className={`chip ${position === p ? 'active' : ''}`}
              style={{ flex: 1, padding: '7px 0', fontSize: 12, justifyContent: 'center', borderRadius: 9 }}>
              {p === 'top' ? 'Atas' : p === 'mid' ? 'Tengah' : 'Bawah'}
            </button>
          ))}
        </div>
      </section>

      <section>
        <Label>Ukuran</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          {SIZES.map(s => (
            <button key={s} onClick={() => handleSize(s)}
              className={`chip ${size === s ? 'active' : ''}`}
              style={{ flex: 1, padding: '7px 0', fontSize: 13, fontWeight: 700, justifyContent: 'center', borderRadius: 9 }}>
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Subtitle override manual */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Label>Override subtitle (opsional)</Label>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="btn-ghost"
            style={{ padding: '5px 10px', fontSize: 11.5, gap: 5, borderRadius: 8 }}
          >
            <ArrowsClockwiseIcon size={13} style={{ animation: regenerating ? 'spin 0.8s linear infinite' : 'none' }} />
            {regenerating ? 'Memproses…' : 'Regenerasi'}
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: 'var(--color-faint)', lineHeight: 1.5, margin: '0 0 8px' }}>
          Kosongkan untuk pakai subtitle otomatis dari transkrip (Whisper / YouTube).
          Isi hanya jika ingin mengganti teks subtitle secara manual.
        </p>
        <textarea
          value={text}
          onChange={e => handleText(e.target.value)}
          rows={5}
          placeholder="Kosong = subtitle dari transkrip otomatis…"
          style={{
            width: '100%', resize: 'vertical', borderRadius: 10, padding: '10px 12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontSize: 12.5, lineHeight: 1.6,
            fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
          }}
        />
      </section>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--color-faint)', marginBottom: 8 }}>{children}</div>
}
