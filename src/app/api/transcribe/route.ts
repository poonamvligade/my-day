import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import {
  appendEntry,
  finalizeDay,
  getDateKey,
  getLogPath,
  getRawPath,
  readLastActiveDate,
  writeLastActiveDate,
} from '../../../lib/journal'

export const runtime = 'nodejs'

const maxFileSize = 25 * 1024 * 1024

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return Response.json(
      { error: 'Missing OPENAI_API_KEY in the server environment.' },
      { status: 500 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return Response.json({ error: 'No audio file uploaded.' }, { status: 400 })
  }

  if (file.size > maxFileSize) {
    return Response.json(
      { error: 'File exceeds the 25MB limit.' },
      { status: 413 },
    )
  }

  const whisperData = new FormData()
  whisperData.append('file', file, file.name)
  whisperData.append('model', 'whisper-1')
  whisperData.append('response_format', 'json')

  // TODO: If you want MP3 output, convert to mp3 with FFmpeg here before sending.

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: whisperData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    return Response.json(
      { error: errorText || 'Transcription failed.' },
      { status: response.status },
    )
  }

  const data = (await response.json()) as { text?: string }
  const text = data.text ?? ''
  let savedAs: string | null = null

  const dateKey = getDateKey()
  const lastActive = await readLastActiveDate()
  if (lastActive && lastActive !== dateKey) {
    const groqKey = process.env.GROQ_API_KEY
    if (groqKey) {
      try {
        await finalizeDay(lastActive, groqKey)
      } catch {
        // Ignore auto-finalize failures to keep transcription responsive.
      }
    }
  }
  await writeLastActiveDate(dateKey)

  if (text) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `transcript-${timestamp}.txt`
    const transcriptsDir = path.join(process.cwd(), 'transcripts')
    await mkdir(transcriptsDir, { recursive: true })
    await writeFile(path.join(transcriptsDir, filename), text, 'utf-8')
    savedAs = path.join('transcripts', filename)

    const timeLabel = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
    await appendEntry(getRawPath(dateKey), `[${timeLabel}] ${text}`)
    await appendEntry(getLogPath(dateKey), `[${timeLabel}] User: ${text}`)
  }

  return Response.json({ text, savedAs, date: dateKey })
}
