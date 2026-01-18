import * as React from 'react'
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Settings,
  Info,
} from 'lucide-react'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

type VideoPlayerProps = {
  src: string
  poster?: string
  title?: string
  className?: string
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

export default function VideoPlayer({ src, poster, title, className }: VideoPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const [isPlaying, setIsPlaying] = React.useState(false)
  const [isMuted, setIsMuted] = React.useState(false)
  const [volume, setVolume] = React.useState(1)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [bufferedEnd, setBufferedEnd] = React.useState(0)
  const [playbackRate, setPlaybackRate] = React.useState(1)
  const [showControls, setShowControls] = React.useState(true)
  const [showHelp, setShowHelp] = React.useState(false)
  const hideTimerRef = React.useRef<number | null>(null)

  const isFullscreen =
    typeof document !== 'undefined' &&
    !!document.fullscreenElement &&
    document.fullscreenElement === containerRef.current

  const scheduleHide = React.useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    if (!isPlaying) {
      setShowControls(true)
      return
    }
    hideTimerRef.current = window.setTimeout(() => {
      setShowControls(false)
    }, 1800)
  }, [isPlaying])

  const syncBuffered = React.useCallback(() => {
    const video = videoRef.current
    if (!video) return
    try {
      const b = video.buffered
      if (b.length > 0) setBufferedEnd(b.end(b.length - 1))
    } catch {
      // ignore
    }
  }, [])

  const togglePlay = React.useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (video.paused) await video.play()
      else video.pause()
    } catch {
      // autoplay restrictions etc.
    }
  }, [])

  const seekBy = React.useCallback((deltaSeconds: number) => {
    const video = videoRef.current
    if (!video) return
    const next = clamp(video.currentTime + deltaSeconds, 0, Number.isFinite(video.duration) ? video.duration : video.currentTime)
    video.currentTime = next
    setCurrentTime(next)
    scheduleHide()
  }, [scheduleHide])

  const setPercent = React.useCallback((pct: number) => {
    const video = videoRef.current
    if (!video) return
    if (!Number.isFinite(video.duration) || video.duration <= 0) return
    const next = clamp((pct / 100) * video.duration, 0, video.duration)
    video.currentTime = next
    setCurrentTime(next)
    scheduleHide()
  }, [scheduleHide])

  const toggleMute = React.useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
    scheduleHide()
  }, [scheduleHide])

  const setVideoVolume = React.useCallback((nextVolume: number) => {
    const video = videoRef.current
    if (!video) return
    const v = clamp(nextVolume, 0, 1)
    video.volume = v
    setVolume(v)
    if (v === 0) {
      video.muted = true
      setIsMuted(true)
    } else if (video.muted) {
      video.muted = false
      setIsMuted(false)
    }
    scheduleHide()
  }, [scheduleHide])

  const toggleFullscreen = React.useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {})
      return
    }

    await container.requestFullscreen().catch(() => {})
  }, [])

  const togglePiP = React.useCallback(async () => {
    const video = videoRef.current as any
    if (!video) return

    try {
      if (document.pictureInPictureElement) {
        // @ts-expect-error - not in older lib types
        await document.exitPictureInPicture()
        return
      }
      if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture()
      }
    } catch {
      // ignore
    }
  }, [])

  const changeSpeed = React.useCallback((next: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = next
    setPlaybackRate(next)
    scheduleHide()
  }, [scheduleHide])

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      // Don't steal keys while user is interacting with inputs
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement | null)?.isContentEditable) {
        return
      }

      const key = e.key

      // help
      if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault()
        setShowHelp((v) => !v)
        setShowControls(true)
        return
      }
      if (key === 'Escape' && showHelp) {
        e.preventDefault()
        setShowHelp(false)
        return
      }

      // play/pause
      if (key === ' ' || key.toLowerCase() === 'k') {
        e.preventDefault()
        togglePlay()
        return
      }

      // seek
      if (key.toLowerCase() === 'j' || key === 'ArrowLeft') {
        e.preventDefault()
        seekBy(e.shiftKey ? -30 : -10)
        return
      }
      if (key.toLowerCase() === 'l' || key === 'ArrowRight') {
        e.preventDefault()
        seekBy(e.shiftKey ? 30 : 10)
        return
      }

      // volume
      if (key.toLowerCase() === 'm') {
        e.preventDefault()
        toggleMute()
        return
      }
      if (key === 'ArrowUp') {
        e.preventDefault()
        setVideoVolume(volume + 0.05)
        return
      }
      if (key === 'ArrowDown') {
        e.preventDefault()
        setVideoVolume(volume - 0.05)
        return
      }

      // fullscreen
      if (key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleFullscreen()
        return
      }

      // pip
      if (key.toLowerCase() === 'p') {
        e.preventDefault()
        togglePiP()
        return
      }

      // speed
      if (key === ',' || key === '<') {
        e.preventDefault()
        const idx = SPEEDS.indexOf(playbackRate as any)
        const nextIdx = idx <= 0 ? 0 : idx - 1
        changeSpeed(SPEEDS[nextIdx])
        return
      }
      if (key === '.' || key === '>') {
        e.preventDefault()
        const idx = SPEEDS.indexOf(playbackRate as any)
        const nextIdx = idx < 0 ? 2 : clamp(idx + 1, 0, SPEEDS.length - 1)
        changeSpeed(SPEEDS[nextIdx])
        return
      }

      // 0-9 seek to %
      if (/^[0-9]$/.test(key)) {
        e.preventDefault()
        const digit = Number(key)
        setPercent(digit * 10)
      }
    },
    [changeSpeed, playbackRate, seekBy, setPercent, setVideoVolume, showHelp, toggleFullscreen, toggleMute, togglePiP, togglePlay, volume],
  )

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onVolume = () => {
      setIsMuted(video.muted)
      setVolume(video.volume)
    }
    const onTime = () => setCurrentTime(video.currentTime)
    const onDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    const onRate = () => setPlaybackRate(video.playbackRate || 1)

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('volumechange', onVolume)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('durationchange', onDuration)
    video.addEventListener('progress', syncBuffered)
    video.addEventListener('ratechange', onRate)

    // initial
    onVolume()
    onDuration()
    syncBuffered()

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('volumechange', onVolume)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('durationchange', onDuration)
      video.removeEventListener('progress', syncBuffered)
      video.removeEventListener('ratechange', onRate)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [syncBuffered])

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (bufferedEnd / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={() => {
        setShowControls(true)
        scheduleHide()
      }}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false)
      }}
      onDoubleClick={() => toggleFullscreen()}
      className={
        className ??
        'group relative w-full overflow-hidden rounded-2xl border bg-black/90 shadow-2xl shadow-black/10 outline-none focus-visible:ring-2 focus-visible:ring-ring'
      }
      aria-label={title ?? 'Video player'}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="h-full w-full object-contain bg-black"
        preload="metadata"
        controls={false}
        playsInline
        onClick={() => togglePlay()}
      />

      {/* Top hint bar */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-xs text-white/80">
        <span className="rounded-full bg-black/50 px-2 py-1 backdrop-blur-sm">
          Press <span className="font-semibold">?</span> for shortcuts
        </span>
      </div>

      {/* Center play overlay */}
      {!isPlaying && (
        <button
          type="button"
          onClick={() => togglePlay()}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play"
        >
          <span className="rounded-full bg-black/50 p-4 backdrop-blur-sm transition-transform group-hover:scale-105">
            <Play className="h-8 w-8 text-white" />
          </span>
        </button>
      )}

      {/* Controls */}
      <div
        className={
          'absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 transition-opacity ' +
          (showControls ? 'opacity-100' : 'opacity-0')
        }
      >
        {/* Progress */}
        <div className="relative mb-2">
          <div className="h-1.5 w-full rounded-full bg-white/20" />
          <div
            className="absolute left-0 top-0 h-1.5 rounded-full bg-white/30"
            style={{ width: `${clamp(bufferedPct, 0, 100)}%` }}
          />
          <div
            className="absolute left-0 top-0 h-1.5 rounded-full bg-primary"
            style={{ width: `${clamp(progressPct, 0, 100)}%` }}
          />
          <input
            aria-label="Seek"
            type="range"
            min={0}
            max={duration || 0}
            step={0.25}
            value={currentTime}
            onChange={(e) => {
              const t = Number(e.currentTarget.value)
              const video = videoRef.current
              if (video) video.currentTime = t
              setCurrentTime(t)
            }}
            onMouseDown={() => setShowControls(true)}
            onMouseUp={() => scheduleHide()}
            className="absolute inset-0 h-4 w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => togglePlay()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={() => toggleMute()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>

            <input
              aria-label="Volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVideoVolume(Number(e.currentTarget.value))}
              className="h-2 w-24 accent-primary hidden sm:block"
            />

            <span className="tabular-nums text-xs text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-md bg-white/10 px-2 py-1 text-xs text-white/90">
              <Settings className="h-4 w-4" />
              <label className="sr-only" htmlFor="speed">
                Speed
              </label>
              <select
                id="speed"
                value={String(playbackRate)}
                onChange={(e) => changeSpeed(Number(e.currentTarget.value))}
                className="bg-transparent outline-none"
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => togglePiP()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
              aria-label="Picture in picture"
            >
              <PictureInPicture2 className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
              aria-label="Shortcuts"
            >
              <Info className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => toggleFullscreen()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-black/60 p-4 text-white">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Shortcuts</div>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <div className="text-white/80">Play/Pause</div>
                <div className="font-mono text-xs">Space, K</div>
              </div>
              <div>
                <div className="text-white/80">Seek</div>
                <div className="font-mono text-xs">J/L or /→ (Shift = 30s)</div>
              </div>
              <div>
                <div className="text-white/80">Mute</div>
                <div className="font-mono text-xs">M</div>
              </div>
              <div>
                <div className="text-white/80">Volume</div>
                <div className="font-mono text-xs">↑ / ↓</div>
              </div>
              <div>
                <div className="text-white/80">Fullscreen</div>
                <div className="font-mono text-xs">F (double click)</div>
              </div>
              <div>
                <div className="text-white/80">Picture-in-Picture</div>
                <div className="font-mono text-xs">P</div>
              </div>
              <div>
                <div className="text-white/80">Speed</div>
                <div className="font-mono text-xs">, / .</div>
              </div>
              <div>
                <div className="text-white/80">Jump</div>
                <div className="font-mono text-xs">0–9</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/70">
              Tip: click the player once to toggle play/pause.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
