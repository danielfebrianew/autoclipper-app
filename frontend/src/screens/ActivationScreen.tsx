import { useRef, useState, KeyboardEvent, ClipboardEvent } from 'react'
import { SparkleIcon, ShieldCheckIcon, ArrowRightIcon, WifiNoneIcon } from '@phosphor-icons/react'
import { ActivateLicense } from '../../wailsjs/go/main/App'
import { useAppDispatch } from '../store/hooks'
import { setLicenseValid } from '../store/slices/appSlice'
import { setScreen } from '../store/slices/uiSlice'
import Glow from '../components/primitives/Glow'
import Spinner from '../components/primitives/Spinner'

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
    if (e.key === 'Backspace' && groups[idx] === '' && idx > 0) {
      refs.current[idx - 1]?.focus()
    }
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
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Glow x="18%" y="18%" size={460} color="rgba(123,97,255,0.18)" />
      <Glow x="72%" y="60%" size={380} color="rgba(80,60,170,0.14)" />

      <div style={{ width: 440, maxWidth: '100%', position: 'relative', zIndex: 2, fontFamily: 'var(--font-ui)', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(160deg, var(--color-accent-hi), var(--color-accent-lo))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 14px 36px -10px var(--color-accent-glow)',
          }}>
            <SparkleIcon size={28} color="#fff" weight="fill" />
          </div>
        </div>

        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: 'var(--color-text)', marginBottom: 8 }}>
          Aktivasi Lisensi
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.55, marginBottom: 34 }}>
          Masukkan kode lisensi 16 karakter dari email konfirmasi<br />pembelianmu.
        </div>

        {/* KeyIcon input groups */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
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
                style={{
                  width: 74, height: 52, textAlign: 'center', border: 'none', outline: 'none',
                  fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, letterSpacing: 4,
                  color: error ? 'var(--color-bad)' : 'var(--color-text)',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 13,
                  boxShadow: error
                    ? '0 0 0 1.5px rgba(255,107,102,0.6) inset'
                    : groups[idx].length === CHARS_PER_GROUP
                    ? '0 0 0 1.5px var(--color-accent-line) inset'
                    : '0 0 0 1px var(--color-border) inset',
                  caretColor: 'var(--color-accent-hi)',
                  transition: 'box-shadow .14s',
                }}
              />
              {idx < GROUPS - 1 && (
                <span key={`sep-${idx}`} style={{ color: 'var(--color-border)', fontSize: 20, fontWeight: 300, userSelect: 'none' }}>—</span>
              )}
            </>
          ))}
        </div>

        {error && (
          <div style={{ marginBottom: 18, fontSize: 12.5, color: 'var(--color-bad)' }}>{error}</div>
        )}
        {!error && <div style={{ height: 18, marginBottom: 18 }} />}

        {/* Activate button */}
        <button
          onClick={handleActivate}
          disabled={!isComplete || checking}
          className="btn-primary"
          style={{ width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 15, fontWeight: 700 }}
        >
          {checking ? <><Spinner size={16} /> Memverifikasi…</> : <>Aktifkan <ShieldCheckIcon size={17} weight="fill" /></>}
        </button>

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, color: 'var(--color-faint)' }}>
          <WifiNoneIcon size={14} />
          Diverifikasi online sekali — tidak ada subscription.
        </div>
      </div>
    </div>
  )
}
