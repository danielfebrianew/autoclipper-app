import { useEffect, useState } from 'react'
import { SparkleIcon, DownloadSimpleIcon, FilmStripIcon, TargetIcon, StackIcon, CheckIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { CheckDependencies, RunSetup } from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { useAppDispatch } from '../store/hooks'
import { setSetupComplete } from '../store/slices/appSlice'
import { setScreen } from '../store/slices/uiSlice'
import Glow from '../components/primitives/Glow'
import Caret from '../components/primitives/Caret'
import Spinner from '../components/primitives/Spinner'

interface Dep { name: string; status: string; message: string; size?: number; unit?: string; icon?: string }
interface SetupProgress { name: string; status: string; progress: number; message: string }

const ICON_MAP: Record<string, React.ElementType> = {
  download: DownloadSimpleIcon, film: FilmStripIcon, target: TargetIcon, layers: StackIcon,
}

const INSTALL_LOG = [
  'creating virtualenv at ~/.autoclipper/venv',
  'pip install yt-dlp … ok',
  'fetching ffmpeg-7.1 (static, arm64) …',
  'verifying checksum sha256 … ok',
  'downloading face-yolov8.pt …',
  'pip install ultralytics torch torchvision …',
  'pip install faster-whisper …',
  'linking binaries → ~/.autoclipper/bin',
  'warming up models … ok',
  'environment ready ✓',
]

export default function BootstrapScreen() {
  const dispatch = useAppDispatch()
  const [deps, setDeps] = useState<Dep[]>([])
  const [progress, setProgress] = useState<Record<string, SetupProgress>>({})
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [showLog, setShowLog] = useState(true)
  const [logLines, setLogLines] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    CheckDependencies().then(d => setDeps(d as Dep[]))
    EventsOn('setup:progress', (ev: SetupProgress) => {
      setProgress(prev => ({ ...prev, [ev.name]: ev }))
      setLogLines(prev => [...prev.slice(-50), `${ev.name}: ${ev.message}`])
    })
  }, [])

  const allOk = deps.length > 0 && deps.every(d => {
    const p = progress[d.name]
    return (p?.status ?? d.status) === 'ok'
  })

  async function handleSetup() {
    setRunning(true); setError('')
    try {
      await RunSetup()
      await CheckDependencies().then(d => setDeps(d as Dep[]))
      setDone(true)
      dispatch(setSetupComplete(true))
    } catch (e: any) {
      setError(e?.toString() ?? 'Setup gagal')
    } finally {
      setRunning(false)
    }
  }

  const isDone = done || allOk

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Glow x="18%" y="12%" size={460} color="rgba(123,97,255,0.20)" />
      <Glow x="64%" y="58%" size={420} color="rgba(80,60,170,0.16)" />

      <div style={{ width: 560, maxWidth: '100%', position: 'relative', zIndex: 2, fontFamily: 'var(--font-ui)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: 'linear-gradient(160deg, var(--color-accent-hi), var(--color-accent-lo))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 30px -8px var(--color-accent-glow)',
          }}>
            <SparkleIcon size={24} color="#fff" weight="fill" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: 'var(--color-text)' }}>
              {isDone ? 'Auto Clipper siap dipakai' : 'Menyiapkan Auto Clipper'}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--color-muted)', marginTop: 2 }}>
              {isDone ? 'Semua komponen terpasang di ~/.autoclipper' : 'Sekali saja — mengunduh & memasang komponen yang dibutuhkan.'}
            </div>
          </div>
        </div>

        {/* Dep list */}
        <div className="glass" style={{ borderRadius: 18, padding: 10 }}>
          {deps.map(dep => {
            const prog = progress[dep.name]
            const status = prog?.status ?? dep.status
            const dDone = status === 'ok'
            const active = status === 'installing'
            const pct = prog?.progress ?? 0
            const IconComp = dep.icon ? (ICON_MAP[dep.icon] ?? DownloadSimpleIcon) : DownloadSimpleIcon

            return (
              <div key={dep.name} style={{
                display: 'flex', alignItems: 'center', gap: 13, padding: '13px 12px',
                borderRadius: 12, background: active ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: dDone ? 'rgba(84,214,160,0.14)' : active ? 'var(--color-accent-soft)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${dDone ? 'rgba(84,214,160,0.3)' : active ? 'var(--color-accent-line)' : 'var(--color-border)'}`,
                }}>
                  {dDone
                    ? <CheckIcon size={17} color="var(--color-good)" weight="bold" />
                    : active
                    ? <Spinner size={16} color="var(--color-accent-hi)" />
                    : <IconComp size={16} color={active ? 'var(--color-accent-hi)' : 'var(--color-muted)'} />
                  }
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{dep.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-faint)' }}>{dep.message}</span>
                    {dep.size != null && (
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-faint)' }}>
                        {dep.size} {dep.unit ?? 'MB'}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 8, height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${dDone ? 100 : active ? pct : 0}%`,
                      borderRadius: 3, background: dDone ? 'var(--color-good)' : 'linear-gradient(90deg, var(--color-accent-lo), var(--color-accent-hi))',
                      transition: 'width .2s',
                    }} />
                  </div>
                </div>
                <span style={{ width: 92, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: dDone ? 'var(--color-good)' : active ? 'var(--color-accent-hi)' : 'var(--color-faint)' }}>
                  {dDone ? 'terpasang' : active ? (pct > 90 ? 'memasang…' : `${Math.round(pct)}%`) : 'menunggu'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Log toggle */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowLog(s => !s)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--color-muted)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {showLog ? '▾' : '▸'} Log instalasi
          </button>
          {showLog && (
            <div style={{
              marginTop: 10, height: 116, overflow: 'hidden', borderRadius: 12,
              background: 'rgba(0,0,0,0.34)', border: '1px solid var(--color-border-soft)',
              padding: '10px 13px', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}>
              {(logLines.length > 0 ? logLines : (running ? INSTALL_LOG.slice(0, 3) : [])).map((l, i) => (
                <div key={i} style={{ color: l.includes('✓') || l.includes('ok') ? 'var(--color-good)' : 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: 'var(--color-faint)' }}>$</span> {l}
                </div>
              ))}
              {running && <div style={{ color: 'var(--color-accent-hi)' }}><span style={{ color: 'var(--color-faint)' }}>$</span> <Caret /></div>}
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,107,102,0.1)', border: '1px solid rgba(255,107,102,0.3)', fontSize: 12, color: 'var(--color-bad)' }}>
            {error}
          </div>
        )}

        {/* Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22 }}>
          <span style={{ fontSize: 12.5, color: 'var(--color-faint)' }}>
            {isDone ? 'Komponen lokal, berjalan offline setelah ini.' : 'Jangan tutup jendela selama proses berlangsung.'}
          </span>
          <div style={{ flex: 1 }} />
          {isDone ? (
            <button
              onClick={() => dispatch(setScreen('activation'))}
              className="btn-primary"
              style={{ padding: '12px 22px', borderRadius: 12, fontSize: 14 }}
            >
              Lanjut ke aktivasi <ArrowRightIcon size={16} weight="bold" />
            </button>
          ) : error ? (
            <button onClick={handleSetup} className="btn-primary" style={{ padding: '12px 22px', borderRadius: 12, fontSize: 14 }}>
              Coba lagi
            </button>
          ) : (
            <button onClick={handleSetup} disabled={running} className="btn-primary" style={{ padding: '12px 22px', borderRadius: 12, fontSize: 14 }}>
              {running ? <><Spinner />Memasang…</> : 'Install Dependency'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
