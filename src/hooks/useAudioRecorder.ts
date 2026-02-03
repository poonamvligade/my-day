import { useCallback, useEffect, useRef, useState } from 'react'

type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'unsupported'

const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm']
const targetAudioBitrate = 64000

const getSupportedMimeType = () => {
  if (typeof window === 'undefined' || !('MediaRecorder' in window)) {
    return null
  }

  return preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
}

export const useAudioRecorder = () => {
  const [isSupported, setIsSupported] = useState(false)
  const [hasCheckedSupport, setHasCheckedSupport] = useState(false)
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const supported = 'MediaRecorder' in window
    setIsSupported(supported)
    setHasCheckedSupport(true)
    if (!supported) {
      setStatus('unsupported')
    }
  }, [])

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      cleanupStream()
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl, cleanupStream])

  useEffect(() => {
    if (status !== 'recording') {
      return
    }

    const timer = window.setInterval(() => {
      if (startTimeRef.current === null) {
        return
      }
      const elapsed = elapsedRef.current + (performance.now() - startTimeRef.current)
      setDurationMs(elapsed)
    }, 200)

    return () => window.clearInterval(timer)
  }, [status])

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setStatus('unsupported')
      return
    }

    setError(null)
    setDurationMs(0)
    elapsedRef.current = 0
    startTimeRef.current = null

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setAudioBlob(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = getSupportedMimeType()
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: targetAudioBitrate,
      }
      if (mimeType) {
        options.mimeType = mimeType
      }
      const recorder = new MediaRecorder(stream, options)

      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstart = () => {
        startTimeRef.current = performance.now()
        setStatus('recording')
      }

      recorder.onpause = () => {
        if (startTimeRef.current !== null) {
          elapsedRef.current += performance.now() - startTimeRef.current
          startTimeRef.current = null
          setDurationMs(elapsedRef.current)
        }
        setStatus('paused')
      }

      recorder.onresume = () => {
        startTimeRef.current = performance.now()
        setStatus('recording')
      }

      recorder.onerror = (event) => {
        setError(event.error?.message ?? 'Recorder error')
        setStatus('idle')
        cleanupStream()
      }

      recorder.onstop = () => {
        if (startTimeRef.current !== null) {
          elapsedRef.current += performance.now() - startTimeRef.current
          startTimeRef.current = null
        }
        setDurationMs(elapsedRef.current)

        const blob = new Blob(chunksRef.current, { type: mimeType ?? 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setStatus('stopped')
        cleanupStream()
      }

      recorder.start()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access was blocked.')
      setStatus('idle')
      cleanupStream()
    }
  }, [audioUrl, cleanupStream, isSupported])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      return
    }
    recorder.stop()
  }, [])

  const togglePause = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) {
      return
    }
    if (recorder.state === 'recording') {
      recorder.pause()
    } else if (recorder.state === 'paused') {
      recorder.resume()
    }
  }, [])

  return {
    audioBlob,
    audioUrl,
    durationMs,
    error,
    hasCheckedSupport,
    isSupported,
    startRecording,
    status,
    stopRecording,
    togglePause,
  }
}
