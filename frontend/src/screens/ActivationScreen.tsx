import { useRef, useState, KeyboardEvent, ClipboardEvent } from 'react'
import { SparkleIcon, ShieldCheckIcon, WifiNoneIcon } from '@phosphor-icons/react'
import { ActivateLicense } from '../../wailsjs/go/main/App'
import { useAppDispatch } from '../store/hooks'
import { setLicenseValid } from '../store/slices/appSlice'
import { setScreen } from '../store/slices/uiSlice'
import Glow from '../components/primitives/Glow'
import Spinner from '../components/primitives/Spinner'
import { cn } from '../lib/cn'

const GROUPS = 4
const CHARS_PER_GROUP = 4

function buildKey(groups: string[]): string {
  return groups.join('-').toUpperCase()
}

function splitKey(raw: string): string[] {
  const clean = raw.replace(/[-\s]/g, '')
  const groups: string[] = []
  for (let i = 0; i < GROUPS; i++) {
    groups.push(clean.slice(i * CHARS_PER_GROUP, (i + 1) * CHARS_PER_GROUP).toUpperCase())
  }
  return groups
}

export default function ActivationScreen() {
  const dispatch = useAppDispatch()
  const [groups, setGroups] = useState<string[]>(Array(GROUPS).fill(''))
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const fullKey = buildKey(groups)
  const isComplete = groups.every(g => g.length === CHARS_PER_GROUP)

  function handleChange(idx: number, val: string) {
    const filtered = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CHARS_PER_GROUP)
    const next = groups.map((g, i) => (i === idx ? filtered : g))
    setGroups(next)
    setError('')
    if (filtered.length === CHARS_PER_GROUP && idx < GROUPS - 1) {
      refs.current[idx + 1]?.focus()
    }
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && groups[idx] === '' && idx > 0) refs.current[idx - 1]?.focus()
    if (e.key === 'ArrowLeft' && idx > 0) refs.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < GROUPS - 1) refs.current[idx + 1]?.focus()
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const parts = splitKey(text)
    setGroups(parts)
    const lastFilled = parts.reduce((acc, g, i) => (g.length === CHARS_PER_GROUP ? i : acc), -1)
    const focusIdx = Math.min(lastFilled + 1, GROUPS - 1)
    setTimeout(() => refs.current[focusIdx]?.focus(), 0)
  }

  async function handleActivate() {
    if (!isComplete) return
    setChecking(true)
    setError('')
    try {
      await ActivateLicense(fullKey)
      dispatch(setLicenseValid(true))
      dispatch(setScreen('workspace'))
    } catch (e: any) {
      const msg = e?.toString() ?? ''
      if (msg.includes('network') || msg.includes('offline') || msg.includes('connect')) {
        dispatch(setScreen('offline'))
      } else {
        setError('Lisensi tidak valid. Periksa kode dan coba lagi.')
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
      <Glow x="18%" y="18%" size={460} color="rgba(123,97,255,0.18)" />
      <Glow x="72%" y="60%" size={380} color="rgba(80,60,170,0.14)" />

      <div className="w-110 max-w-full relative z-2 font-ui text-center">
        {/* Icon */}
        <div className="flex justify-center mb-5.5">
          <div className="w-14 h-14 rounded-2xl bg-[linear-gradient(160deg,var(--color-accent-hi),var(--color-accent-lo))] flex items-center justify-center shadow-[0_14px_36px_-10px_var(--color-accent-glow)]">
            <SparkleIcon size={28} color="#fff" weight="fill" />
          </div>
        </div>

        <div className="text-[24px] font-extrabold tracking-[-0.5px] text-text mb-2">
          Aktivasi Lisensi
        </div>
        <div className="text-[14px] text-muted leading-[1.55] mb-8.5">
          Masukkan kode lisensi 16 karakter dari email konfirmasi<br />pembelianmu.
        </div>

        {/* Key input groups */}
        <div className="flex items-center justify-center gap-2.5 mb-2.5">
          {Array.from({ length: GROUPS }).map((_, idx) => (
            <>
              <input
                key={idx}
                ref={el => { refs.current[idx] = el }}
                maxLength={CHARS_PER_GROUP}
                value={groups[idx]}
                onChange={e => handleChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                placeholder="XXXX"
                className={cn(
                  'w-18.5 h-13 text-center border-none outline-none font-mono text-[18px] font-bold tracking-[4px] bg-white/5 rounded-[13px] transition-shadow duration-[0.14s]',
                  error
                    ? 'text-bad shadow-[0_0_0_1.5px_rgba(255,107,102,0.6)_inset]'
                    : groups[idx].length === CHARS_PER_GROUP
                    ? 'text-text shadow-[0_0_0_1.5px_var(--color-accent-line)_inset]'
                    : 'text-text shadow-[0_0_0_1px_var(--color-border)_inset]',
                )}
                style={{ caretColor: 'var(--color-accent-hi)' }}
              />
              {idx < GROUPS - 1 && (
                <span key={`sep-${idx}`} className="text-border text-[20px] font-light select-none">—</span>
              )}
            </>
          ))}
        </div>

        {error
          ? <div className="mb-4.5 text-[12.5px] text-bad">{error}</div>
          : <div className="h-4.5 mb-4.5" />
        }

        {/* Activate button */}
        <button
          onClick={handleActivate}
          disabled={!isComplete || checking}
          className="btn-primary w-full py-3.5 rounded-[14px] text-[15px] font-bold"
        >
          {checking ? <><Spinner size={16} /> Memverifikasi…</> : <>Aktifkan <ShieldCheckIcon size={17} weight="fill" /></>}
        </button>

        <div className="mt-5 flex items-center justify-center gap-1.75 text-[12.5px] text-faint">
          <WifiNoneIcon size={14} />
          Diverifikasi online sekali — tidak ada subscription.
        </div>
      </div>
    </div>
  )
}
