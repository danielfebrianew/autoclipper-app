import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { XIcon, ScissorsIcon, ClosedCaptioningIcon, TargetIcon, ArrowsOutIcon, ArrowsInIcon, ExportIcon, PlayIcon, PauseIcon, SpeakerHighIcon, SpeakerLowIcon, SpeakerSlashIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { closeOverlay, openExport, setPreviewTab } from '../store/slices/uiSlice'
import { fetchClips } from '../store/slices/clipSlice'
import {
  GetVideoPath, GetClipWaveform, GetClipThumbnails, GetFaceTrack, UpdateClipTimestamp, GetClipFaces,
  GetTranscriptRange,
} from '../../wailsjs/go/main/App'
import Timeline from './preview/Timeline'
import SourceStage, { SourceStageHandle } from './preview/SourceStage'
import OutputStage from './preview/OutputStage'
import EditTab from './preview/EditTab'
import CaptionTab from './preview/CaptionTab'
import TrackTab from './preview/TrackTab'
import { computeZones, facesAt, FaceSample } from './preview/cropMath'
import { cn } from '../lib/cn'

type Tab = 'edit' | 'subtitle' | 'track'

const TAB_LABELS: Record<Tab, string> = { edit: 'Edit', subtitle: 'Caption', track: 'Track' }
const TAB_ICONS: Record<Tab, React.ElementType> = { edit: ScissorsIcon, subtitle: ClosedCaptioningIcon, track: TargetIcon }

// Flex weight for the preview column per ratio (relative to source column at 16)
const PREVIEW_FLEX: Record<string, string> = {
  '9:16': '5.5 1 0',
  '1:1':  '9 1 0',
  '4:5':  '7.5 1 0',
}

function buildCropLabel(ratio: string, template: string): string {
  const templateDesc: Record<string, string> = {
    single: 'face tracking', dual: '2 speakers',
  }
  return `${ratio} crop · ${templateDesc[template] ?? template}`
}

export default function PreviewPlayer() {
  const dispatch = useAppDispatch()
  const previewClipId = useAppSelector(s => s.ui.previewClipId)
  const previewTab = useAppSelector(s => s.ui.previewTab)
  const clip = useAppSelector(s => s.clip.list.find(c => c.id === previewClipId))
  const activeProjectId = useAppSelector(s => s.ui.activeProjectId)

  const sourceRef = useRef<SourceStageHandle>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoSrc, setVideoSrc] = useState('')
  const [videoDiskPath, setVideoDiskPath] = useState('')  // path disk absolut utk decoder native

  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState(30)
  const [waveform, setWaveform] = useState<number[]>([])
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [transcript, setTranscript] = useState<{ text: string; start: number; end: number }[]>([])

  const [ratio, setRatio] = useState('9:16')
  const [captionPreset, setCaptionPreset] = useState('bold')
  const [captionPosition, setCaptionPosition] = useState('bot')
  const [captionSize, setCaptionSize] = useState('M')
  const [captionText, setCaptionText] = useState('')
  const [trackTemplate, setTrackTemplate] = useState('single')
  const [trackSmooth, setTrackSmooth] = useState(true)
  const [trackLockMain, setTrackLockMain] = useState(false)
  const [trackSensitivity, setTrackSensitivity] = useState(50)
  const [trackReserveBottom, setTrackReserveBottom] = useState(false)

  const [split, setSplit] = useState(false)
  const [showCrop, setShowCrop] = useState(true)
  const [showCaption, setShowCaption] = useState(true)

  // Source video dimensions for normalizing pixel-coord face data
  const [sourceDims, setSourceDims] = useState({ w: 1920, h: 1080 })
  const [sourceDuration, setSourceDuration] = useState(0)

  // Face samples: tier 1 = primary face track (normalized), tier 2 = multi-face from stored JSON (pixels)
  const [faceSamplesTier1, setFaceSamplesTier1] = useState<FaceSample[]>([])
  const [faceSamplesTier2, setFaceSamplesTier2] = useState<FaceSample[]>([])

  const tsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!clip) return
    setInPoint(clip.start_seconds)
    setOutPoint(clip.end_seconds)
    setCurrentTime(clip.start_seconds)
    setRatio(clip.aspect_ratio || '9:16')
    setCaptionPreset(clip.caption_style || 'bold')
    setCaptionPosition(clip.caption_position || 'bot')
    setCaptionSize(clip.caption_size || 'M')
    setCaptionText(clip.caption_text || '')
    // Only 'single'/'dual' remain; map any legacy template to 'single'.
    const tpl = clip.track_template
    setTrackTemplate(tpl === 'single' || tpl === 'dual' ? tpl : 'single')
    setTrackSmooth(clip.track_smooth ?? true)
    setTrackLockMain(clip.track_lock_main ?? false)
    setTrackSensitivity(clip.track_sensitivity ?? 50)
    setTrackReserveBottom(clip.track_reserve_bottom ?? false)
  }, [previewClipId])

  useEffect(() => {
    if (!clip?.project_id) return
    GetVideoPath(clip.project_id).then(path => {
      if (path) {
        setVideoSrc(`/media${path}`)
        setVideoDiskPath(path)
      }
    }).catch(() => {})
  }, [clip?.project_id])

  function loadFaceData(clipId: string) {
    GetFaceTrack(clipId).then(frames => {
      if (!frames?.length) return
      const samples: FaceSample[] = frames.map((f: any) => ({
        time: f.time ?? f.frame / 30,
        faces: [{ x: f.x, y: f.y, w: f.w, h: f.h }],
      }))
      setFaceSamplesTier1(samples)
    }).catch(() => {})

    GetClipFaces(clipId).then((entries: any[]) => {
      if (!entries?.length) return
      setFaceSamplesTier2(entries.map((e: any) => ({
        time: e.time,
        faces: e.faces ?? [],
      })))
    }).catch(() => {})
  }

  useEffect(() => {
    if (!clip?.id) return
    GetClipWaveform(clip.id).then(peaks => setWaveform(peaks ?? [])).catch(() => {})
    GetClipThumbnails(clip.id, 12).then(paths => setThumbnails(paths ?? [])).catch(() => {})
    loadFaceData(clip.id)
  }, [clip?.id])

  useEffect(() => {
    if (!clip?.project_id) return
    GetTranscriptRange(clip.project_id, Math.floor(clip.start_seconds), Math.ceil(clip.end_seconds))
      .then(segs => setTranscript(segs ?? []))
      .catch(() => setTranscript([]))
  }, [clip?.project_id, clip?.start_seconds, clip?.end_seconds])

  const activeTranscript = useMemo(() => {
    const seg = transcript.find(s => currentTime >= s.start && currentTime <= s.end)
    return seg?.text?.trim() ?? ''
  }, [transcript, currentTime])

  const faceSamples = useMemo<FaceSample[]>(() => {
    const isDualTemplate = trackTemplate === 'dual'
    const tier2HasMultiFace = faceSamplesTier2.some(s => s.faces.length >= 2)

    if (isDualTemplate && tier2HasMultiFace && faceSamplesTier2.length > 0) {
      const { w, h } = sourceDims
      return faceSamplesTier2.map(s => ({
        time: s.time + (clip?.start_seconds ?? 0),
        faces: (s.faces as any[]).map(f => ({
          x: f.x / w, y: f.y / h, w: f.w / w, h: f.h / h,
        })),
      }))
    }
    return faceSamplesTier1
  }, [faceSamplesTier1, faceSamplesTier2, sourceDims, trackTemplate, clip?.start_seconds])

  const sourceAspect = sourceDims.w / sourceDims.h

  const sourceRatioLabel = useMemo(() => {
    const a = sourceAspect
    if (Math.abs(a - 16 / 9) < 0.02) return '16:9'
    if (Math.abs(a - 4 / 3) < 0.02) return '4:3'
    if (Math.abs(a - 21 / 9) < 0.05) return '21:9'
    if (Math.abs(a - 1) < 0.02) return '1:1'
    return `${a.toFixed(2)}:1`
  }, [sourceAspect])

  const zones = useMemo(() => {
    const faces = facesAt(faceSamples, currentTime)
    return computeZones(trackTemplate, ratio, faces, sourceAspect, trackReserveBottom)
  }, [trackTemplate, ratio, faceSamples, currentTime, sourceAspect, trackReserveBottom])

  // Editable window: allow extending IN 30s earlier and OUT 60s later than the
  // ORIGINAL Gemini clip bounds, clamped to the source video. Computed from the
  // ORIGINAL start/end (not live inPoint/outPoint) so the window stays fixed
  // while dragging. Until the source video reports its real duration, fall back
  // generously to end + OUT_HEADROOM.
  const IN_HEADROOM = 30
  const OUT_HEADROOM = 60
  const { windowStart, windowEnd, windowLen } = useMemo(() => {
    const s = clip?.start_seconds ?? 0
    const e = clip?.end_seconds ?? 0
    const srcDur = sourceDuration > 0 ? sourceDuration : e + OUT_HEADROOM
    const ws = Math.max(0, s - IN_HEADROOM)
    const we = Math.min(srcDur, e + OUT_HEADROOM)
    return { windowStart: ws, windowEnd: we, windowLen: Math.max(we - ws, 0.001) }
  }, [clip?.start_seconds, clip?.end_seconds, sourceDuration])

  const clampIn = useCallback(
    (v: number) => Math.min(Math.max(v, windowStart), outPoint - 0.5),
    [windowStart, outPoint],
  )
  const clampOut = useCallback(
    (v: number) => Math.max(Math.min(v, windowEnd), inPoint + 0.5),
    [windowEnd, inPoint],
  )

  const saveTimestamp = useCallback((ip: number, op: number) => {
    if (!clip) return
    if (tsDebounce.current) clearTimeout(tsDebounce.current)
    tsDebounce.current = setTimeout(() => {
      UpdateClipTimestamp(clip.id, Math.round(ip), Math.round(op)).catch(() => {})
    }, 400)
  }, [clip?.id])

  function handleInChange(v: number) { setInPoint(v); saveTimestamp(v, outPoint) }
  function handleOutChange(v: number) { setOutPoint(v); saveTimestamp(inPoint, v) }
  function handleSeek(v: number) { setCurrentTime(v); sourceRef.current?.seek(v) }

  function handleClose() {
    if (activeProjectId) dispatch(fetchClips(activeProjectId))
    dispatch(closeOverlay())
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
    switch (e.key) {
      case ' ':
        e.preventDefault()
        sourceRef.current?.toggle()
        break
      case 'ArrowLeft':
        handleSeek(Math.max(windowStart, currentTime - 1 / 30))
        break
      case 'ArrowRight':
        handleSeek(Math.min(windowEnd, currentTime + 1 / 30))
        break
      case 'i': case 'I': handleInChange(clampIn(currentTime)); break
      case 'o': case 'O': handleOutChange(clampOut(currentTime)); break
    }
  }

  function fmtTime(s: number) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const clipDuration = outPoint - inPoint
  const cropZones = showCrop ? zones.map(z => z.crop) : []
  const cropLabel = buildCropLabel(ratio, trackTemplate)
  const previewFlex = PREVIEW_FLEX[ratio] ?? '5.5 1 0'

  if (!clip) return null

  return (
    <div
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 z-50 bg-[rgba(8,6,13,0.97)] backdrop-blur-[18px] flex flex-col font-ui outline-none"
    >
      {/* Header */}
      <div className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-border-soft">
        <button onClick={handleClose} className="icon-btn shrink-0">
          <XIcon size={17} color="var(--color-muted)" />
        </button>

        <span className="text-[13.5px] font-bold text-text overflow-hidden text-ellipsis whitespace-nowrap max-w-60">
          {clip.hook || `Klip ${clip.clip_index + 1}`}
        </span>

        {clip.category && (
          <span className="font-mono text-[9px] font-bold tracking-[0.5px] uppercase text-accent-hi bg-accent-soft border border-accent-line px-1.75 py-0.5 rounded-[5px] shrink-0">
            {clip.category}
          </span>
        )}

        {clip.viral_score > 0 && (
          <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-accent-hi bg-accent-soft border border-accent-line px-2 py-0.75 rounded-full shrink-0">
            ↗ {clip.viral_score}
          </span>
        )}

        {/* Center — tab switcher */}
        <div className="flex-1 flex justify-center">
          <div className="flex gap-0.75 p-1 rounded-xl bg-white/4 border border-border">
            {(Object.keys(TAB_LABELS) as Tab[]).map(t => {
              const Icon = TAB_ICONS[t]
              const active = previewTab === t
              return (
                <button
                  key={t}
                  onClick={() => dispatch(setPreviewTab(t))}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.75 rounded-lg border-none cursor-pointer text-[13px] font-semibold font-ui transition-all duration-150',
                    active
                      ? 'bg-accent-soft text-accent-hi'
                      : 'bg-transparent text-muted',
                  )}
                >
                  <Icon size={14} weight={active ? 'fill' : 'regular'} />
                  {TAB_LABELS[t]}
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={() => dispatch(openExport([clip.id]))}
          className="btn-primary px-4 py-2 rounded-[10px] text-[13px] gap-1.75 shrink-0"
        >
          <ExportIcon size={15} weight="bold" />
          Export klip
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Stage area */}
        <div className="flex-1 min-w-0 flex gap-5 px-5 py-4 items-stretch overflow-hidden">

          {/* Source stage column — dynamic flex based on split mode */}
          <div className="min-w-0 flex flex-col gap-2" style={{ flex: split ? '1 1 0' : '16 1 0' }}>
            {/* Label row */}
            <div className="shrink-0 flex items-center justify-between">
              <span className="font-mono text-[10px] text-faint tracking-[0.5px] uppercase">
                SOURCE {sourceRatioLabel}&nbsp;
                <span className="text-muted normal-case">
                  {clip.hook ? clip.hook.slice(0, 40) + (clip.hook.length > 40 ? '…' : '') : `Klip ${clip.clip_index + 1}`}
                </span>
              </span>
              <button
                onClick={() => setSplit(s => !s)}
                className="btn-ghost px-2.25 py-0.75 rounded-[7px] text-[11px] gap-1"
              >
                {split ? <ArrowsInIcon size={12} /> : <ArrowsOutIcon size={12} />}
                {split ? 'Single' : 'Split view'}
              </button>
            </div>

            {/* Stage wrapper */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div
                className="relative w-full max-w-full max-h-full m-auto"
                style={{ aspectRatio: `${sourceDims.w} / ${sourceDims.h}` }}
              >
                <SourceStage
                  ref={sourceRef}
                  src={videoSrc}
                  inPoint={inPoint}
                  outPoint={outPoint}
                  volume={volume}
                  muted={muted}
                  showCrop={showCrop}
                  cropZones={cropZones}
                  cropLabel={cropLabel}
                  smooth={trackSmooth}
                  onTimeUpdate={t => setCurrentTime(t)}
                  onPlayStateChange={setPlaying}
                  onLoadedMetadata={(w, h, dur) => {
                    setSourceDims({ w, h })
                    if (Number.isFinite(dur) && dur > 0) setSourceDuration(dur)
                  }}
                />
                {/* Time badge */}
                <span className="absolute bottom-3.5 left-3.5 z-10 font-mono text-[11px] text-white/75 bg-black/50 px-1.75 py-0.5 rounded-md pointer-events-none">
                  {fmtTime(currentTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Preview (output) stage column — dynamic flex based on ratio */}
          <div className="min-w-0 flex flex-col gap-2" style={{ flex: split ? '1 1 0' : previewFlex }}>
            {/* Label row */}
            <div className="shrink-0 flex items-center justify-between">
              <span className="font-mono text-[10px] text-faint tracking-[0.5px] uppercase">
                PREVIEW {ratio}
              </span>
              <span className="font-mono text-[11px] font-bold text-accent-hi">
                {fmtTime(clipDuration)}
              </span>
            </div>

            {/* Stage wrapper */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <OutputStage
                src={videoSrc}
                videoPath={videoDiskPath}
                currentTime={currentTime}
                ratio={ratio}
                zones={zones}
                caption={{ preset: captionPreset, position: captionPosition, size: captionSize, text: captionText }}
                showCaption={showCaption}
                transcript={activeTranscript}
              />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72.5 shrink-0 border-l border-border-soft flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3.5 py-4">
            {previewTab === 'edit' && (
              <EditTab
                clip={clip as any}
                inPoint={inPoint}
                outPoint={outPoint}
                windowStart={windowStart}
                windowEnd={windowEnd}
                ratio={ratio}
                showCrop={showCrop}
                showCaption={showCaption}
                onInChange={v => handleInChange(clampIn(v))}
                onOutChange={v => handleOutChange(clampOut(v))}
                onRatioChange={r => setRatio(r)}
                onShowCropChange={setShowCrop}
                onShowCaptionChange={setShowCaption}
              />
            )}
            {previewTab === 'subtitle' && (
              <CaptionTab
                clipId={clip.id}
                preset={captionPreset}
                position={captionPosition}
                size={captionSize}
                text={captionText}
                onPresetChange={setCaptionPreset}
                onPositionChange={setCaptionPosition}
                onSizeChange={setCaptionSize}
                onTextChange={setCaptionText}
              />
            )}
            {previewTab === 'track' && (
              <TrackTab
                clipId={clip.id}
                template={trackTemplate}
                smooth={trackSmooth}
                lockMain={trackLockMain}
                sensitivity={trackSensitivity}
                reserveBottom={trackReserveBottom}
                onTemplateChange={setTrackTemplate}
                onOptsChange={opts => {
                  setTrackSmooth(opts.smooth)
                  setTrackLockMain(opts.lockMain)
                  setTrackSensitivity(opts.sensitivity)
                  setTrackReserveBottom(opts.reserveBottom)
                }}
                onRetrack={() => {
                  if (clip?.id) loadFaceData(clip.id)
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Transport bar + Timeline */}
      <div className="border-t border-border-soft bg-black/25 shrink-0">
        {/* Transport row: time (left) · play (center) · volume (right) */}
        <div className="grid grid-cols-3 items-center px-4 pt-2">
          {/* Left — time readout */}
          <span className="font-mono text-[11px] text-muted justify-self-start">
            {fmtTime(currentTime - windowStart)}{' '}
            <span className="text-faint">/ {fmtTime(clipDuration)}</span>
          </span>

          {/* Center — play/pause */}
          <button
            onClick={() => sourceRef.current?.toggle()}
            title="Space"
            className="w-8.5 h-8.5 rounded-full border-none cursor-pointer bg-accent shrink-0 flex items-center justify-center shadow-[0_2px_12px_rgba(123,97,255,0.4)] justify-self-center"
          >
            {playing
              ? <PauseIcon size={16} weight="fill" color="#fff" />
              : <PlayIcon size={16} weight="fill" color="#fff" style={{ marginLeft: 1 }} />
            }
          </button>

          {/* Right — volume */}
          <div className="flex items-center gap-2 justify-self-end">
            <button
              onClick={() => setMuted(m => !m)}
              title={muted ? 'Unmute' : 'Mute'}
              className="icon-btn shrink-0"
            >
              {muted || volume === 0
                ? <SpeakerSlashIcon size={17} color="var(--color-muted)" />
                : volume < 0.5
                  ? <SpeakerLowIcon size={17} color="var(--color-muted)" />
                  : <SpeakerHighIcon size={17} color="var(--color-muted)" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={e => {
                const v = Number(e.target.value)
                setVolume(v)
                if (v > 0 && muted) setMuted(false)
                if (v === 0) setMuted(true)
              }}
              title="Volume"
              className="w-24 accent-accent-hi cursor-pointer"
            />
          </div>
        </div>
        <Timeline
          duration={windowLen}
          inPoint={inPoint - windowStart}
          outPoint={outPoint - windowStart}
          currentTime={currentTime - windowStart}
          waveform={waveform}
          thumbnails={thumbnails}
          waveformStart={clip.start_seconds - windowStart}
          waveformEnd={clip.end_seconds - windowStart}
          onInChange={v => handleInChange(v + windowStart)}
          onOutChange={v => handleOutChange(v + windowStart)}
          onSeek={v => handleSeek(v + windowStart)}
        />
      </div>
    </div>
  )
}
