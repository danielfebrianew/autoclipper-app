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
import { cn } from '../lib/cn'

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
    <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
      <Glow x="18%" y="12%" size={460} color="rgba(123,97,255,0.20)" />
      <Glow x="64%" y="58%" size={420} color="rgba(80,60,170,0.16)" />

      <div className="w-140 max-w-full relative z-2 font-ui">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6.5">
          <div className="w-11.5 h-11.5 rounded-[13px] shrink-0 bg-[linear-gradient(160deg,var(--color-accent-hi),var(--color-accent-lo))] flex items-center justify-center shadow-[0_10px_30px_-8px_var(--color-accent-glow)]">
            <SparkleIcon size={24} color="#fff" weight="fill" />
          </div>
          <div>
            <div className="text-[22px] font-extrabold tracking-[-0.4px] text-text">
              {isDone ? 'Auto Clipper siap dipakai' : 'Menyiapkan Auto Clipper'}
            </div>
            <div className="text-[13.5px] text-muted mt-0.5">
              {isDone ? 'Semua komponen terpasang di ~/.autoclipper' : 'Sekali saja — mengunduh & memasang komponen yang dibutuhkan.'}
            </div>
          </div>
        </div>

        {/* Dep list */}
        <div className="glass rounded-[18px] p-2.5">
          {deps.map(dep => {
            const prog = progress[dep.name]
            const status = prog?.status ?? dep.status
            const dDone = status === 'ok'
            const active = status === 'installing'
            const pct = prog?.progress ?? 0
            const IconComp = dep.icon ? (ICON_MAP[dep.icon] ?? DownloadSimpleIcon) : DownloadSimpleIcon

            return (
              <div
                key={dep.name}
                className={cn(
                  'flex items-center gap-3.25 px-3 py-3.25 rounded-xl',
                  active ? 'bg-white/3' : 'bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center border',
                    dDone
                      ? 'bg-[rgba(84,214,160,0.14)] border-[rgba(84,214,160,0.3)]'
                      : active
                      ? 'bg-accent-soft border-accent-line'
                      : 'bg-white/5 border-border',
                  )}
                >
                  {dDone
                    ? <CheckIcon size={17} color="var(--color-good)" weight="bold" />
                    : active
                    ? <Spinner size={16} color="var(--color-accent-hi)" />
                    : <IconComp size={16} color={active ? 'var(--color-accent-hi)' : 'var(--color-muted)'} />
                  }
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[13px] font-semibold text-text">{dep.name}</span>
                    <span className="text-[12px] text-faint">{dep.message}</span>
                    {dep.size != null && (
                      <span className="ml-auto font-mono text-[11px] text-faint">
                        {dep.size} {dep.unit ?? 'MB'}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1 rounded-[3px] bg-white/7 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-[3px] transition-[width] duration-200',
                        dDone ? 'bg-good' : 'bg-[linear-gradient(90deg,var(--color-accent-lo),var(--color-accent-hi))]',
                      )}
                      style={{ width: `${dDone ? 100 : active ? pct : 0}%` }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    'w-23 text-right font-mono text-[10.5px]',
                    dDone ? 'text-good' : active ? 'text-accent-hi' : 'text-faint',
                  )}
                >
                  {dDone ? 'terpasang' : active ? (pct > 90 ? 'memasang…' : `${Math.round(pct)}%`) : 'menunggu'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Log toggle */}
        <div className="mt-4">
          <button
            onClick={() => setShowLog(s => !s)}
            className="inline-flex items-center gap-1.5 bg-transparent border-none text-muted font-ui text-[12px] font-semibold cursor-pointer p-0"
          >
            {showLog ? '▾' : '▸'} Log instalasi
          </button>
          {showLog && (
            <div className="mt-2.5 h-29 overflow-hidden rounded-xl bg-black/34 border border-border-soft px-3.25 py-2.5 font-mono text-[11px] leading-[1.7] flex flex-col justify-end">
              {(logLines.length > 0 ? logLines : (running ? INSTALL_LOG.slice(0, 3) : [])).map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    'whitespace-nowrap overflow-hidden text-ellipsis',
                    l.includes('✓') || l.includes('ok') ? 'text-good' : 'text-muted',
                  )}
                >
                  <span className="text-faint">$</span> {l}
                </div>
              ))}
              {running && (
                <div className="text-accent-hi">
                  <span className="text-faint">$</span> <Caret />
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 px-3.5 py-2.5 rounded-[10px] bg-[rgba(255,107,102,0.1)] border border-[rgba(255,107,102,0.3)] text-[12px] text-bad">
            {error}
          </div>
        )}

        {/* Action */}
        <div className="flex items-center gap-3.5 mt-5.5">
          <span className="text-[12.5px] text-faint">
            {isDone ? 'Komponen lokal, berjalan offline setelah ini.' : 'Jangan tutup jendela selama proses berlangsung.'}
          </span>
          <div className="flex-1" />
          {isDone ? (
            <button
              onClick={() => dispatch(setScreen('activation'))}
              className="btn-primary px-5.5 py-3 rounded-xl text-[14px]"
            >
              Lanjut ke aktivasi <ArrowRightIcon size={16} weight="bold" />
            </button>
          ) : error ? (
            <button onClick={handleSetup} className="btn-primary px-5.5 py-3 rounded-xl text-[14px]">
              Coba lagi
            </button>
          ) : (
            <button onClick={handleSetup} disabled={running} className="btn-primary px-5.5 py-3 rounded-xl text-[14px]">
              {running ? <><Spinner />Memasang…</> : 'Install Dependency'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
