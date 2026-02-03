import { appendFile, mkdir, readFile, readdir, writeFile } from 'fs/promises'
import path from 'path'

const transcriptsDir = path.join(process.cwd(), 'transcripts')
const lastActivePath = path.join(transcriptsDir, 'last-active.json')

export const ensureTranscriptsDir = async () => {
  await mkdir(transcriptsDir, { recursive: true })
}

export const getDateKey = (date = new Date()) => date.toLocaleDateString('en-CA')

export const getRawPath = (dateKey: string) =>
  path.join(transcriptsDir, `${dateKey}.raw.txt`)

export const getLogPath = (dateKey: string) =>
  path.join(transcriptsDir, `${dateKey}.log.txt`)

export const getFinalPath = (dateKey: string) =>
  path.join(transcriptsDir, `${dateKey}.final.txt`)

export const appendEntry = async (filePath: string, text: string) => {
  await ensureTranscriptsDir()
  await appendFile(filePath, `${text.trim()}\n`, 'utf-8')
}

export const readText = async (filePath: string) => {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

export const readLastActiveDate = async () => {
  try {
    const raw = await readFile(lastActivePath, 'utf-8')
    const data = JSON.parse(raw) as { date?: string }
    return data.date ?? null
  } catch {
    return null
  }
}

export const writeLastActiveDate = async (dateKey: string) => {
  await ensureTranscriptsDir()
  await writeFile(lastActivePath, JSON.stringify({ date: dateKey }), 'utf-8')
}

export const listEntries = async () => {
  await ensureTranscriptsDir()
  const files = await readdir(transcriptsDir)
  const map = new Map<
    string,
    { date: string; hasRaw: boolean; hasFinal: boolean; hasLog: boolean }
  >()
  const regex = /^(\d{4}-\d{2}-\d{2})\.(raw|final|log)\.txt$/

  for (const file of files) {
    const match = regex.exec(file)
    if (!match) {
      continue
    }
    const [, date, type] = match
    const entry =
      map.get(date) ?? { date, hasRaw: false, hasFinal: false, hasLog: false }
    if (type === 'raw') {
      entry.hasRaw = true
    } else if (type === 'final') {
      entry.hasFinal = true
    } else if (type === 'log') {
      entry.hasLog = true
    }
    map.set(date, entry)
  }

  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
}

export const finalizeDay = async (dateKey: string, apiKey: string) => {
  const finalPath = getFinalPath(dateKey)
  const existing = await readText(finalPath)
  if (existing?.trim()) {
    return existing
  }

  const log = await readText(getLogPath(dateKey))
  if (!log?.trim()) {
    return null
  }

  const prompt = `Clean up the following journal log into a coherent first-person diary entry. Remove all assistant or reflection questions, preserve the user's words and chronology, fix obvious typos, and keep the content as-is without summarizing or adding facts.\n\n${log}`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You polish journal entries.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.5,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Groq summarization failed.')
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const finalText = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!finalText) {
    return null
  }

  await ensureTranscriptsDir()
  await writeFile(finalPath, finalText, 'utf-8')
  return finalText
}
