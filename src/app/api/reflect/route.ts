import { appendEntry, getDateKey, getLogPath, readText } from '../../../lib/journal'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    return Response.json(
      { error: 'Missing GROQ_API_KEY in the server environment.' },
      { status: 500 },
    )
  }

  const body = (await request.json()) as { text?: string }
  const text = body.text?.trim()

  if (!text) {
    return Response.json({ error: 'No transcript provided.' }, { status: 400 })
  }

  const dateKey = getDateKey()
  const log = await readText(getLogPath(dateKey))
  const context = log?.trim() ? log : text
  const prompt = `You are a thoughtful journaling companion. Read the user's journal context and ask exactly one reflective question that encourages deeper insight. Keep it under 20 words, and end with a question mark.\n\nContext:\n${context}`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You ask brief, reflective journal questions.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 60,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return Response.json(
      { error: errorText || 'Groq reflection failed.' },
      { status: response.status },
    )
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const question = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (question) {
    const timeLabel = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
    await appendEntry(getLogPath(dateKey), `[${timeLabel}] Reflection: ${question}`)
  }

  return Response.json({ question })
}
