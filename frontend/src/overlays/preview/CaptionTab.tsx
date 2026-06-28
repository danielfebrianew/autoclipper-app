import { useRef, useState } from 'react'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { SetClipCaptionStyle, SetClipCaptionOpts, SaveCaption, RegenerateCaption, RegenerateSubtitle } from '../../../wailsjs/go/main/App'
import { toastError, toastSuccess } from '../../lib/toast'
import { cn } from '../../lib/cn'

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
  const [regenSubs, setRegenSubs] = useState(false)
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

  async function handleRegenerateSubtitle() {
    setRegenSubs(true)
    try {
      await RegenerateSubtitle(clipId)
      if (text) {
        onTextChange('')
        SaveCaption(clipId, '').catch(() => {})
      }
      toastSuccess('Subtitle ber-timing dibuat ulang dari transkrip')
    } catch (e: any) {
      toastError(e?.message || 'Gagal regenerasi subtitle')
    } finally {
      setRegenSubs(false)
    }
  }

  return (
    <div className="flex flex-col gap-4.5">

      {/* Preset cards */}
      <section>
        <Label>Gaya caption</Label>
        <div className="flex flex-col gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => handlePreset(p.id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.25 rounded-[10px] cursor-pointer text-left w-full transition-[background] duration-150',
                preset === p.id
                  ? 'bg-[rgba(123,97,255,0.18)] border border-accent-lo'
                  : 'bg-[rgba(255,255,255,0.04)] border border-transparent',
              )}
            >
              {/* Mini preview */}
              <div className="w-12 h-7 rounded-[5px] overflow-hidden bg-[linear-gradient(135deg,#1a1030,#0d0820)] flex items-end justify-center p-0.5 shrink-0">
                <span
                  className="text-[7px] font-extrabold whitespace-nowrap px-1 py-px rounded-sm"
                  style={{ color: p.color, background: p.bg, textShadow: p.shadow }}
                >
                  Caption
                </span>
              </div>
              <div>
                <div className="text-[12.5px] font-bold text-text">{p.label}</div>
                <div className="text-[10.5px] text-faint">{p.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Position */}
      <section>
        <Label>Posisi</Label>
        <div className="flex gap-1.5">
          {POSITIONS.map(p => (
            <button
              key={p}
              onClick={() => handlePosition(p)}
              className={cn('chip flex-1 py-1.75 text-xs justify-center rounded-[9px]', position === p && 'active')}
            >
              {p === 'top' ? 'Atas' : p === 'mid' ? 'Tengah' : 'Bawah'}
            </button>
          ))}
        </div>
      </section>

      {/* Size */}
      <section>
        <Label>Ukuran</Label>
        <div className="flex gap-1.5">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => handleSize(s)}
              className={cn('chip flex-1 py-1.75 text-[13px] font-bold justify-center rounded-[9px]', size === s && 'active')}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Subtitle ber-timing */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <Label>Subtitle (ikut ucapan)</Label>
          <button
            onClick={handleRegenerateSubtitle}
            disabled={regenSubs}
            className="btn-ghost px-2.5 py-1.25 text-[11.5px] gap-1.25 rounded-lg"
          >
            <ArrowsClockwiseIcon
              size={13}
              className={regenSubs ? 'animate-spin' : undefined}
            />
            {regenSubs ? 'Memproses…' : 'Regenerasi subtitle'}
          </button>
        </div>
        <p className="text-[10.5px] text-faint leading-normal m-0">
          Bangun ulang subtitle ber-timing per kata (menit:detik) langsung dari audio
          lewat faster-whisper — tanpa AI/Gemini. Mengganti caption manual di bawah jika ada.
        </p>
      </section>

      {/* Caption manual */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <Label>Caption manual (opsional)</Label>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="btn-ghost px-2.5 py-1.25 text-[11.5px] gap-1.25 rounded-lg"
          >
            <ArrowsClockwiseIcon
              size={13}
              className={regenerating ? 'animate-spin' : undefined}
            />
            {regenerating ? 'Memproses…' : 'Buat dgn AI'}
          </button>
        </div>
        <p className="text-[10.5px] text-faint leading-normal mb-2 mt-0">
          Kosongkan untuk pakai subtitle ber-timing di atas. Isi untuk menimpa seluruh
          subtitle dengan satu teks statis sepanjang clip.
        </p>
        <textarea
          value={text}
          onChange={e => handleText(e.target.value)}
          rows={5}
          placeholder="Kosong = subtitle ber-timing dari transkrip…"
          className="w-full resize-y rounded-[10px] px-3 py-2.5 bg-[rgba(255,255,255,0.05)] border border-border text-text text-[12.5px] leading-relaxed font-ui box-border"
        />
      </section>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold tracking-[0.5px] uppercase text-faint mb-2">
      {children}
    </div>
  )
}
