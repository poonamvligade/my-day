'use client'

import { useEffect, useState } from 'react'

type JournalEntry = {
  date: string
  hasRaw: boolean
  hasFinal: boolean
  hasLog: boolean
}

type JournalDay = {
  date: string
  raw: string | null
  log: string | null
  final: string | null
}

export const JournalEntries = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [day, setDay] = useState<JournalDay | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadEntries = async () => {
    try {
      const response = await fetch('/api/journal/list')
      if (!response.ok) {
        throw new Error('Failed to load journal list.')
      }
      const payload = (await response.json()) as { entries?: JournalEntry[] }
      const list = payload.entries ?? []
      setEntries(list)
      if (!selectedDate && list.length > 0) {
        setSelectedDate(list[0].date)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journal list.')
    }
  }

  const loadDay = async (date: string) => {
    try {
      const response = await fetch(`/api/journal/day?date=${date}`)
      if (!response.ok) {
        throw new Error('Failed to load journal entry.')
      }
      const payload = (await response.json()) as JournalDay
      setDay(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journal entry.')
    }
  }

  useEffect(() => {
    loadEntries()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      loadDay(selectedDate)
    }
  }, [selectedDate])

  useEffect(() => {
    const handler = () => {
      loadEntries()
      if (selectedDate) {
        loadDay(selectedDate)
      }
    }
    window.addEventListener('journal-updated', handler)
    return () => window.removeEventListener('journal-updated', handler)
  }, [selectedDate])

  return (
    <section className="journal-history">
      <div className="journal-history-header">
        <h2>Journal history</h2>
        <p className="journal-history-subtitle">Entries are grouped by day.</p>
      </div>
      {error && <p className="error-text">{error}</p>}
      {entries.length === 0 ? (
        <p className="empty-state">No journal entries yet.</p>
      ) : (
        <div className="journal-grid">
          <aside className="journal-list">
            {entries.map((entry) => (
              <button
                key={entry.date}
                type="button"
                className={`journal-date ${
                  entry.date === selectedDate ? 'is-active' : ''
                }`}
                onClick={() => setSelectedDate(entry.date)}
              >
                <span>{entry.date}</span>
                <span className="journal-meta">
                  {entry.hasFinal ? 'Final' : entry.hasRaw ? 'Draft' : 'Empty'}
                </span>
              </button>
            ))}
          </aside>
          <div className="journal-viewer">
            {day?.final ? (
              <div className="journal-card">
                <p className="transcript-label">Final entry</p>
                <textarea className="transcript-textarea" value={day.final} readOnly rows={12} />
              </div>
            ) : (
              <div className="journal-card">
                <p className="transcript-label">Final entry</p>
                <p className="transcript-text">No final entry saved yet.</p>
              </div>
            )}
            {day?.raw ? (
              <div className="journal-card">
                <p className="transcript-label">Raw transcript</p>
                <textarea className="transcript-textarea" value={day.raw} readOnly rows={8} />
              </div>
            ) : (
              <div className="journal-card">
                <p className="transcript-label">Raw transcript</p>
                <p className="transcript-text">No transcript logged for this day.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
