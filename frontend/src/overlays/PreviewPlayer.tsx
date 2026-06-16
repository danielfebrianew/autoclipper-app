import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { XIcon, ScissorsIcon, ClosedCaptioningIcon, TargetIcon, ArrowsOutIcon, ArrowsInIcon, ExportIcon, PlayIcon, PauseIcon } from '@phosphor-icons/react'
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
    single: 'face tracking', single_top: 'face top', dual: '2 speakers',
    dual_side: '2 side', speaker: 'speaker focus', static: 'static crop',
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

  const [split, setSplit] = useState(false)
  const [showCrop, setShowCrop] = useState(true)
  const [showCaption, setShowCaption] = useState(true)

  // Source video dimensions for normalizing pixel-coord face data
  const [sourceDims, setSourceDims] = useState({ w: 1920, h: 1080 })

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
    // caption_text = override subtitle manual (eksplisit). Subtitle default selalu
    // dari transcript (Whisper/YT), jadi JANGAN prefill dari suggested_caption
    // (itu teks promosi sosmed, bukan subtitle yang di-burn).
    setCaptionText(clip.caption_text || '')
    setTrackTemplate(clip.track_template || 'single')
    setTrackSmooth(clip.track_smooth ?? true)
    setTrackLockMain(clip.track_lock_main ?? false)
    setTrackSensitivity(clip.track_sensitivity ?? 50)
  }, [previewClipId])

  useEffect(() => {
    if (!clip?.project_id) return
    GetVideoPath(clip.project_id).then(path => {
      if (path) {
        setVideoSrc(`/media${path}`)
        setVideoDiskPath(path)  // path absolut disk untuk decoder native (/preview/frame)
      }
    }).catch(() => {})
  }, [clip?.project_id])

  function loadFaceData(clipId: string) {
    // Tier 1: primary face track (normalized 0-1, source-video absolute time via time field)
    GetFaceTrack(clipId).then(frames => {
      if (!frames?.length) return
      const samples: FaceSample[] = frames.map((f: any) => ({
        time: f.time ?? f.frame / 30,
        faces: [{ x: f.x, y: f.y, w: f.w, h: f.h }],
      }))
      setFaceSamplesTier1(samples)
    }).catch(() => {})

    // Tier 2: multi-face stored data (pixel coords, clip-relative time)
    GetClipFaces(clipId).then((entries: any[]) => {
      if (!entries?.length) return
      // Pixel coords are normalized by sourceDims at compute time — store raw here, normalize in useMemo
      setFaceSamplesTier2(entries.map((e: any) => ({
        time: e.time,  // clip-relative seconds
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

  // Timestamped transcript (YT transcript API / Whisper) for the clip range
  useEffect(() => {
    if (!clip?.project_id) return
    GetTranscriptRange(clip.project_id, Math.floor(clip.start_seconds), Math.ceil(clip.end_seconds))
      .then(segs => setTranscript(segs ?? []))
      .catch(() => setTranscript([]))
  }, [clip?.project_id, clip?.start_seconds, clip?.end_seconds])

  // Segment spoken at the current playback time (source-absolute seconds)
  const activeTranscript = useMemo(() => {
    const seg = transcript.find(s => currentTime >= s.start && currentTime <= s.end)
    return seg?.text?.trim() ?? ''
  }, [transcript, currentTime])

  // Re-normalize tier2 when sourceDims are known
  const faceSamples = useMemo<FaceSample[]>(() => {
    const isDualTemplate = trackTemplate === 'dual' || trackTemplate === 'dual_side'
    const tier2HasMultiFace = faceSamplesTier2.some(s => s.faces.length >= 2)

    // Prefer Tier 2 for dual templates if we have multi-face data
    if (isDualTemplate && tier2HasMultiFace && faceSamplesTier2.length > 0) {
      const { w, h } = sourceDims
      return faceSamplesTier2.map(s => ({
        time: s.time + (clip?.start_seconds ?? 0),  // convert clip-relative to source-absolute
        faces: (s.faces as any[]).map(f => ({
          x: f.x / w, y: f.y / h, w: f.w / w, h: f.h / h,
        })),
      }))
    }
    return faceSamplesTier1
  }, [faceSamplesTier1, faceSamplesTier2, sourceDims, trackTemplate, clip?.start_seconds])

  const sourceAspect = sourceDims.w / sourceDims.h

  // Label rasio source yang sebenarnya (mis. "16:9", "2.06:1") — JANGAN hardcode,
  // video sumber bisa 2220×1080 dll. Aspect yang salah bikin crop box meleset.
  const sourceRatioLabel = useMemo(() => {
    const a = sourceAspect
    if (Math.abs(a - 16 / 9) < 0.02) return '16:9'
    if (Math.abs(a - 4 / 3) < 0.02) return '4:3'
    if (Math.abs(a - 21 / 9) < 0.05) return '21:9'
    if (Math.abs(a - 1) < 0.02) return '1:1'
    return `${a.toFixed(2)}:1`
  }, [sourceAspect])

  // Compute zones from current state
  const zones = useMemo(() => {
    const faces = facesAt(faceSamples, currentTime)
    return computeZones(trackTemplate, ratio, faces, sourceAspect)
  }, [trackTemplate, ratio, faceSamples, currentTime, sourceAspect])

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
        handleSeek(Math.max(inPoint, currentTime - 1 / 30))
        break
      case 'ArrowRight':
        handleSeek(Math.min(outPoint, currentTime + 1 / 30))
        break
      case 'i': case 'I': handleInChange(currentTime); break
      case 'o': case 'O': handleOutChange(currentTime); break
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
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(8,6,13,0.97)', backdropFilter: 'blur(18px)',
        display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)',
        outline: 'none',
      }}
    >
      {/* Header */}
      <div style={{
        height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px', borderBottom: '1px solid var(--color-border-soft)',
      }}>
        <button onClick={handleClose} className="icon-btn" style={{ flexShrink: 0 }}>
          <XIcon size={17} color="var(--color-muted)" />
        </button>

        <span style={{
          fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240,
        }}>
          {clip.hook || `Klip ${clip.clip_index + 1}`}
        </span>
        {clip.category && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
            textTransform: 'uppercase', color: 'var(--color-accent-hi)',
            background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-line)',
            padding: '2px 7px', borderRadius: 5, flexShrink: 0,
          }}>
            {clip.category}
          </span>
        )}
        {clip.viral_score > 0 && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            color: 'var(--color-accent-hi)', background: 'var(--color-accent-soft)',
            border: '1px solid var(--color-accent-line)',
            padding: '3px 8px', borderRadius: 999, flexShrink: 0,
          }}>
            ↗ {clip.viral_score}
          </span>
        )}

        {/* Center — tab switcher */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 3, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
            {(Object.keys(TAB_LABELS) as Tab[]).map(t => {
              const Icon = TAB_ICONS[t]
              const active = previewTab === t
              return (
                <button
                  key={t}
                  onClick={() => dispatch(setPreviewTab(t))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)',
                    background: active ? 'var(--color-accent-soft)' : 'transparent',
                    color: active ? 'var(--color-accent-hi)' : 'var(--color-muted)',
                    transition: 'all .15s',
                  }}
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
          className="btn-primary"
          style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, gap: 7, flexShrink: 0 }}
        >
          <ExportIcon size={15} weight="bold" />
          Export klip
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Stage area */}
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', gap: 20,
          padding: '16px 20px', alignItems: 'stretch',
          overflow: 'hidden',
        }}>
          {/* Source stage column */}
          <div style={{ flex: split ? '1 1 0' : '16 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Label row */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-faint)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                SOURCE {sourceRatioLabel}&nbsp;
                <span style={{ color: 'var(--color-muted)', textTransform: 'none' }}>
                  {clip.hook ? clip.hook.slice(0, 40) + (clip.hook.length > 40 ? '…' : '') : `Klip ${clip.clip_index + 1}`}
                </span>
              </span>
              <button
                onClick={() => setSplit(s => !s)}
                className="btn-ghost"
                style={{ padding: '3px 9px', borderRadius: 7, fontSize: 11, gap: 4 }}
              >
                {split ? <ArrowsInIcon size={12} /> : <ArrowsOutIcon size={12} />}
                {split ? 'Single' : 'Split view'}
              </button>
            </div>

            {/* Stage wrapper — flex:1 gives definite height; box letterboxes inside */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                position: 'relative',
                width: '100%', maxWidth: '100%', maxHeight: '100%',
                // Aspect mengikuti source asli supaya video mengisi kotak tanpa
                // letterbox, sehingga crop box overlay sejajar dengan frame video.
                aspectRatio: `${sourceDims.w} / ${sourceDims.h}`, margin: 'auto',
              }}>
                <SourceStage
                  ref={sourceRef}
                  src={videoSrc}
                  inPoint={inPoint}
                  outPoint={outPoint}
                  showCrop={showCrop}
                  cropZones={cropZones}
                  cropLabel={cropLabel}
                  smooth={trackSmooth}
                  onTimeUpdate={t => setCurrentTime(t)}
                  onPlayStateChange={setPlaying}
                  onLoadedMetadata={(w, h) => setSourceDims({ w, h })}
                />
                {/* Time badge */}
                <span style={{
                  position: 'absolute', bottom: 14, left: 14, zIndex: 10,
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.75)',
                  background: 'rgba(0,0,0,0.5)', padding: '2px 7px', borderRadius: 6,
                  pointerEvents: 'none',
                }}>
                  {fmtTime(currentTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Preview (output) stage column */}
          <div style={{ flex: split ? '1 1 0' : previewFlex, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Label row */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-faint)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                PREVIEW {ratio}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--color-accent-hi)' }}>
                {fmtTime(clipDuration)}
              </span>
            </div>

            {/* Stage wrapper */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div style={{
          width: 290, flexShrink: 0, borderLeft: '1px solid var(--color-border-soft)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
            {previewTab === 'edit' && (
              <EditTab
                clip={clip as any}
                inPoint={inPoint}
                outPoint={outPoint}
                ratio={ratio}
                showCrop={showCrop}
                showCaption={showCaption}
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
                onTemplateChange={setTrackTemplate}
                onOptsChange={opts => {
                  setTrackSmooth(opts.smooth)
                  setTrackLockMain(opts.lockMain)
                  setTrackSensitivity(opts.sensitivity)
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
      <div style={{ borderTop: '1px solid var(--color-border-soft)', background: 'rgba(0,0,0,0.25)', flexShrink: 0 }}>
        {/* Transport row — play/pause above the timeline */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 16px 0',
        }}>
          <button
            onClick={() => sourceRef.current?.toggle()}
            title="Space"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'var(--color-accent)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(123,97,255,0.4)',
            }}
          >
            {playing
              ? <PauseIcon size={16} weight="fill" color="#fff" />
              : <PlayIcon size={16} weight="fill" color="#fff" style={{ marginLeft: 1 }} />
            }
          </button>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)',
          }}>
            {fmtTime(currentTime - clip.start_seconds)} <span style={{ color: 'var(--color-faint)' }}>/ {fmtTime(clipDuration)}</span>
          </span>
        </div>
        <Timeline
          duration={Math.max(outPoint, clip.end_seconds) - clip.start_seconds}
          inPoint={inPoint - clip.start_seconds}
          outPoint={outPoint - clip.start_seconds}
          currentTime={currentTime - clip.start_seconds}
          waveform={waveform}
          thumbnails={thumbnails}
          onInChange={v => handleInChange(v + clip.start_seconds)}
          onOutChange={v => handleOutChange(v + clip.start_seconds)}
          onSeek={v => handleSeek(v + clip.start_seconds)}
        />
      </div>
    </div>
  )
}
