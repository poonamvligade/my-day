'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const AudioRecorder = () => {
  const {
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
  } = useAudioRecorder()
  const [isUploading, setIsUploading] = useState(false)
  const [isReflecting, setIsReflecting] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [savedAs, setSavedAs] = useState<string | null>(null)
  const [reflectiveQuestion, setReflectiveQuestion] = useState<string | null>(null)
  const [assistantAudioUrl, setAssistantAudioUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [finalEntry, setFinalEntry] = useState<string | null>(null)
  const [finalError, setFinalError] = useState<string | null>(null)
  const lastProcessedBlobRef = useRef<Blob | null>(null)

  const isRecording = status === 'recording'
  const isPaused = status === 'paused'
  const canRecord = status === 'idle' || status === 'stopped'
  const statusLabel = useMemo(() => {
    if (!hasCheckedSupport) {
      return 'Checking microphone support...'
    }
    if (!isSupported) {
      return 'Your browser does not support audio recording.'
    }
    if (isRecording) {
      return 'Recording...'
    }
    if (isPaused) {
      return 'Paused'
    }
    if (status === 'stopped') {
      return 'Recording saved locally.'
    }
    return 'Ready to record.'
  }, [isPaused, isRecording, isSupported, status])

  const downloadName = useMemo(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `journal-audio-${timestamp}.webm`
  }, [])

  const clearAssistantAudio = () => {
    if (assistantAudioUrl) {
      URL.revokeObjectURL(assistantAudioUrl)
    }
    setAssistantAudioUrl(null)
  }

  const notifyJournalUpdate = () => {
    window.dispatchEvent(new Event('journal-updated'))
  }

  useEffect(() => {
    return () => {
      if (assistantAudioUrl) {
        URL.revokeObjectURL(assistantAudioUrl)
      }
    }
  }, [assistantAudioUrl])

  const requestSpeech = async (text: string) => {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Failed to generate speech.')
      }

      const audioBuffer = await response.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    clearAssistantAudio()
    const url = URL.createObjectURL(audioBlob)
    setAssistantAudioUrl(url)
  }

  const requestReflection = async (text: string) => {
    setIsReflecting(true)
    try {
      const response = await fetch('/api/reflect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Reflection failed.')
      }

      const payload = (await response.json()) as { question?: string }
      const question = payload.question ?? ''
      setReflectiveQuestion(question || null)
      if (question) {
        await requestSpeech(question)
      }
      notifyJournalUpdate()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Reflection failed.')
    } finally {
      setIsReflecting(false)
    }
  }

  const handleUpload = async (blob = audioBlob) => {
    if (!blob || isUploading || isReflecting) {
      return
    }

    setIsUploading(true)
    setUploadError(null)
    setTranscript('')
    setSavedAs(null)
    setReflectiveQuestion(null)
    clearAssistantAudio()

    const formData = new FormData()
    formData.append('file', blob, downloadName)

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Transcription failed.')
      }

      const payload = (await response.json()) as { text?: string; savedAs?: string }
      const nextTranscript = payload.text ?? ''
      setTranscript(nextTranscript)
      setSavedAs(payload.savedAs ?? null)
      setFinalEntry(null)
      setFinalError(null)
      if (nextTranscript) {
        await requestReflection(nextTranscript)
      }
      notifyJournalUpdate()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    if (status !== 'stopped' || !audioBlob) {
      return
    }
    if (lastProcessedBlobRef.current === audioBlob) {
      return
    }
    lastProcessedBlobRef.current = audioBlob
    handleUpload(audioBlob)
  }, [audioBlob, status])

  const handleFinalize = async () => {
    if (isFinalizing) {
      return
    }
    setIsFinalizing(true)
    setFinalError(null)

    try {
      const response = await fetch('/api/journal/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Finalize failed.')
      }

      const payload = (await response.json()) as { final?: string }
      setFinalEntry(payload.final ?? null)
      notifyJournalUpdate()
    } catch (err) {
      setFinalError(err instanceof Error ? err.message : 'Finalize failed.')
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <section className="recorder-card">
      <div className="recorder-header">
        <div>
          <p className="recorder-kicker">Mic capture</p>
          <h2>Record a voice note</h2>
          <p className="recorder-subtitle">
            Tap to capture thoughts fast. Saved as WebM for now.
          </p>
        </div>
        <div className="recorder-status">
          <span className={`status-dot ${status}`} />
          <span>{statusLabel}</span>
        </div>
      </div>

      <div className="recorder-actions">
        <button
          className={`mic-button ${isRecording || isPaused ? 'is-active' : ''}`}
          type="button"
          onClick={canRecord ? startRecording : stopRecording}
          disabled={!isSupported}
          aria-label={canRecord ? 'Start recording' : 'Stop recording'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" />
            <path d="M5 11a7 7 0 0 0 14 0v-1h-2v1a5 5 0 0 1-10 0v-1H5v1z" />
            <path d="M11 19v3h2v-3h3v-2H8v2h3z" />
          </svg>
        </button>

        <div className="recorder-controls">
          <div className="timer">{formatDuration(durationMs)}</div>
          <div className="action-row">
            <button
              className="ghost-button"
              type="button"
              onClick={togglePause}
              disabled={!isRecording && !isPaused}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={handleUpload}
              disabled={!audioBlob || isUploading || isReflecting}
            >
              {isUploading
                ? 'Transcribing...'
                : isReflecting
                  ? 'Reflecting...'
                  : transcript
                    ? 'Re-run transcription'
                    : 'Transcribe + Reflect'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={handleFinalize}
              disabled={isFinalizing}
            >
              {isFinalizing ? 'Saving...' : "Save today's journal"}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
          {uploadError && <p className="error-text">{uploadError}</p>}
          {finalError && <p className="error-text">{finalError}</p>}
        </div>
      </div>

      <div className="recorder-output">
        {audioUrl ? (
          <>
            <audio controls src={audioUrl} />
            <a className="download-link" href={audioUrl} download={downloadName}>
              Download WebM
            </a>
          </>
        ) : (
          <p className="empty-state">No recording yet.</p>
        )}
        {transcript ? (
          <div className="transcript">
            <p className="transcript-label">Transcript</p>
            <textarea
              className="transcript-textarea"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              rows={8}
              placeholder="Transcribed text will appear here..."
            />
            {savedAs && (
              <p className="transcript-meta">Saved to {savedAs}</p>
            )}
          </div>
        ) : (
          <div className="transcript transcript-empty">
            <p className="transcript-label">Transcript</p>
            <p className="transcript-text">Transcribed text will appear here.</p>
          </div>
        )}
        <div className="assistant-card">
          <p className="transcript-label">Reflection prompt</p>
          {reflectiveQuestion ? (
            <p className="assistant-text">{reflectiveQuestion}</p>
          ) : (
            <p className="transcript-text">
              We will ask one reflective question after transcription.
            </p>
          )}
          {assistantAudioUrl ? (
            <audio controls autoPlay src={assistantAudioUrl} />
          ) : (
            <p className="assistant-hint">Audio playback will appear here.</p>
          )}
        </div>
        <div className="assistant-card">
          <p className="transcript-label">Final journal entry</p>
          {finalEntry ? (
            <textarea className="transcript-textarea" value={finalEntry} readOnly rows={10} />
          ) : (
            <p className="transcript-text">
              Save today&apos;s journal to generate a polished entry.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
