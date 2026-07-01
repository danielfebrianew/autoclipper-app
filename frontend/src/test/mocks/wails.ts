// Mock implementations of the Wails Go bindings (wailsjs/go/main/App), wired in
// via resolve.alias in vite.config.ts so the mock applies no matter how deep the
// importing component is.
//
// NOTE: because this module is loaded through resolve.alias (not vi.mock), the
// functions here are NOT registered as spies in any single test's `vi`
// registry. So instead of vi.fn(), each binding delegates to a mutable
// implementation in `impls`. Tests override behavior via setBinding(...) and the
// recorded calls are available via `calls` — both exported from this module and
// re-exported through src/test/utils for convenience.

type AnyFn = (...args: any[]) => any

// Per-binding default return shapes, mirroring the real backend.
const LIST_BINDINGS = [
  'GetClips', 'GetGallery', 'GetClipThumbnails', 'GetClipWaveform', 'GetFaceTrack',
  'GetClipFaces', 'GetTranscriptRange', 'ListLibraryVideos', 'ListOverlayImages',
  'ListOverlayProjects', 'ListProjects', 'ListProjectsByVideo', 'ListVideos',
  'GetProviders', 'CheckDependencies',
]
const STRING_BINDINGS = [
  'GetVideoPath', 'GetClipOutputPath', 'GetAppVersion', 'OpenFolder',
  'PickOverlayImage', 'PickOverlayClip', 'ExportClips', 'DownloadAllAsZip',
  'GeneratePreview', 'PreviewReframe',
]
const BOOL_BINDINGS = ['IsLicenseValid', 'IsSetupComplete', 'CheckUpdate']
const VOID_BINDINGS = [
  'ActivateLicense', 'AddCustomClip', 'AddOverlayClip', 'AddOverlayImage',
  'CancelGeneration', 'CancelOverlayRender', 'ClearCache', 'ConfigureWorker',
  'CreateOverlayFromClip', 'CreateOverlayProject', 'DeleteAllSource', 'DeleteClips',
  'DeleteOverlayCover', 'DeleteOverlayImage', 'DeleteOverlayProject', 'DeleteProject',
  'DeleteSourceVideo', 'DeleteVideos', 'FindMoreClips', 'GenerateClips',
  'GetDeletePreview', 'GetLicenseStatus', 'GetOverlayProject', 'GetProject',
  'GetSettings', 'GetSetupProgress', 'GetStorageBreakdown', 'GetThread', 'GetVideo',
  'MakeMoreClips', 'OnFileDrop', 'RedownloadDependency', 'RedownloadSource',
  'RegenerateCaption', 'RegenerateSubtitle', 'RemoveClip', 'RenderOverlay',
  'RetrackFaces', 'RetryClip', 'RetryStep', 'RunCommand', 'RunSetup', 'SaveCaption',
  'SaveOverlayProject', 'SaveSettings', 'SetClipAspectRatio', 'SetClipCaptionOpts',
  'SetClipCaptionStyle', 'SetClipTrackOpts', 'SetClipTrackTemplate', 'SetOverlayCover',
  'StartDownload', 'TestProviderKey', 'ToggleClip', 'UpdateClipTimestamp',
]

function defaultFor(name: string): AnyFn {
  if (LIST_BINDINGS.includes(name)) return () => Promise.resolve([])
  if (STRING_BINDINGS.includes(name)) return () => Promise.resolve('')
  if (BOOL_BINDINGS.includes(name)) return () => Promise.resolve(false)
  return () => Promise.resolve(undefined)
}

const ALL = [...LIST_BINDINGS, ...STRING_BINDINGS, ...BOOL_BINDINGS, ...VOID_BINDINGS]

// Mutable implementation per binding + a recorded call log.
const impls: Record<string, AnyFn> = {}
export const calls: Record<string, any[][]> = {}

function reset() {
  for (const name of ALL) {
    impls[name] = defaultFor(name)
    calls[name] = []
  }
}
reset()

/** Override a binding's implementation for the current test. */
export function setBinding(name: string, impl: AnyFn) {
  impls[name] = impl
}

/** Resolve a binding to a fixed value (sugar for setBinding). */
export function mockResolved(name: string, value: unknown) {
  impls[name] = () => Promise.resolve(value)
}

/** Reject a binding (sugar for setBinding). */
export function mockRejected(name: string, err: unknown) {
  impls[name] = () => Promise.reject(err)
}

/** Reset all bindings + recorded calls to defaults. Call in beforeEach. */
export function resetBindings() {
  reset()
}

// Build a callable that records args and delegates to the current impl.
function binding(name: string) {
  return (...args: any[]) => {
    calls[name].push(args)
    return impls[name](...args)
  }
}

export const GetClips = binding('GetClips')
export const GetGallery = binding('GetGallery')
export const GetClipThumbnails = binding('GetClipThumbnails')
export const GetClipWaveform = binding('GetClipWaveform')
export const GetFaceTrack = binding('GetFaceTrack')
export const GetClipFaces = binding('GetClipFaces')
export const GetTranscriptRange = binding('GetTranscriptRange')
export const ListLibraryVideos = binding('ListLibraryVideos')
export const ListOverlayImages = binding('ListOverlayImages')
export const ListOverlayProjects = binding('ListOverlayProjects')
export const ListProjects = binding('ListProjects')
export const ListProjectsByVideo = binding('ListProjectsByVideo')
export const ListVideos = binding('ListVideos')
export const GetProviders = binding('GetProviders')
export const CheckDependencies = binding('CheckDependencies')
export const GetVideoPath = binding('GetVideoPath')
export const GetClipOutputPath = binding('GetClipOutputPath')
export const GetAppVersion = binding('GetAppVersion')
export const OpenFolder = binding('OpenFolder')
export const PickOverlayImage = binding('PickOverlayImage')
export const PickOverlayClip = binding('PickOverlayClip')
export const ExportClips = binding('ExportClips')
export const DownloadAllAsZip = binding('DownloadAllAsZip')
export const GeneratePreview = binding('GeneratePreview')
export const PreviewReframe = binding('PreviewReframe')
export const IsLicenseValid = binding('IsLicenseValid')
export const IsSetupComplete = binding('IsSetupComplete')
export const CheckUpdate = binding('CheckUpdate')
export const ActivateLicense = binding('ActivateLicense')
export const AddCustomClip = binding('AddCustomClip')
export const AddOverlayClip = binding('AddOverlayClip')
export const AddOverlayImage = binding('AddOverlayImage')
export const CancelGeneration = binding('CancelGeneration')
export const CancelOverlayRender = binding('CancelOverlayRender')
export const ClearCache = binding('ClearCache')
export const ConfigureWorker = binding('ConfigureWorker')
export const CreateOverlayFromClip = binding('CreateOverlayFromClip')
export const CreateOverlayProject = binding('CreateOverlayProject')
export const DeleteAllSource = binding('DeleteAllSource')
export const DeleteClips = binding('DeleteClips')
export const DeleteOverlayCover = binding('DeleteOverlayCover')
export const DeleteOverlayImage = binding('DeleteOverlayImage')
export const DeleteOverlayProject = binding('DeleteOverlayProject')
export const DeleteProject = binding('DeleteProject')
export const DeleteSourceVideo = binding('DeleteSourceVideo')
export const DeleteVideos = binding('DeleteVideos')
export const FindMoreClips = binding('FindMoreClips')
export const GenerateClips = binding('GenerateClips')
export const GetDeletePreview = binding('GetDeletePreview')
export const GetLicenseStatus = binding('GetLicenseStatus')
export const GetOverlayProject = binding('GetOverlayProject')
export const GetProject = binding('GetProject')
export const GetSettings = binding('GetSettings')
export const GetSetupProgress = binding('GetSetupProgress')
export const GetStorageBreakdown = binding('GetStorageBreakdown')
export const GetThread = binding('GetThread')
export const GetVideo = binding('GetVideo')
export const MakeMoreClips = binding('MakeMoreClips')
export const OnFileDrop = binding('OnFileDrop')
export const RedownloadDependency = binding('RedownloadDependency')
export const RedownloadSource = binding('RedownloadSource')
export const RegenerateCaption = binding('RegenerateCaption')
export const RegenerateSubtitle = binding('RegenerateSubtitle')
export const RemoveClip = binding('RemoveClip')
export const RenderOverlay = binding('RenderOverlay')
export const RetrackFaces = binding('RetrackFaces')
export const RetryClip = binding('RetryClip')
export const RetryStep = binding('RetryStep')
export const RunCommand = binding('RunCommand')
export const RunSetup = binding('RunSetup')
export const SaveCaption = binding('SaveCaption')
export const SaveOverlayProject = binding('SaveOverlayProject')
export const SaveSettings = binding('SaveSettings')
export const SetClipAspectRatio = binding('SetClipAspectRatio')
export const SetClipCaptionOpts = binding('SetClipCaptionOpts')
export const SetClipCaptionStyle = binding('SetClipCaptionStyle')
export const SetClipTrackOpts = binding('SetClipTrackOpts')
export const SetClipTrackTemplate = binding('SetClipTrackTemplate')
export const SetOverlayCover = binding('SetOverlayCover')
export const StartDownload = binding('StartDownload')
export const TestProviderKey = binding('TestProviderKey')
export const ToggleClip = binding('ToggleClip')
export const UpdateClipTimestamp = binding('UpdateClipTimestamp')
