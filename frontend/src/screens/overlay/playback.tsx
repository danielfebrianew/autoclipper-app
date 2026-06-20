import { createContext, useContext, useRef, useState, ReactNode } from 'react'

// Lightweight playback state shared between PreviewPane and Timeline.
// Kept out of Redux because it updates ~30x/sec during playback.

interface PlaybackCtx {
  currentTime: number
  isPlaying: boolean
  duration: number
  selectedTrackId: string | null
  setCurrentTime: (t: number) => void
  setIsPlaying: (p: boolean) => void
  setDuration: (d: number) => void
  selectTrack: (id: string | null) => void
  seek: (t: number) => void
}

const Ctx = createContext<PlaybackCtx | null>(null)

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [selectedTrackId, selectTrack] = useState<string | null>(null)
  const seekRef = useRef(setCurrentTime)
  seekRef.current = setCurrentTime

  const value: PlaybackCtx = {
    currentTime, isPlaying, duration, selectedTrackId,
    setCurrentTime, setIsPlaying, setDuration, selectTrack,
    seek: (t: number) => { setIsPlaying(false); setCurrentTime(t) },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePlayback() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider')
  return ctx
}
