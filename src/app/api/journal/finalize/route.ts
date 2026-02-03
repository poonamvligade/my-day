import { finalizeDay, getDateKey } from '../../../../lib/journal'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    return Response.json(
      { error: 'Missing GROQ_API_KEY in the server environment.' },
      { status: 500 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as { date?: string }
  const dateKey = body.date ?? getDateKey()

  try {
    const finalText = await finalizeDay(dateKey, apiKey)
    if (!finalText) {
      return Response.json({ error: 'No journal content to finalize.' }, { status: 400 })
    }
    return Response.json({ date: dateKey, final: finalText })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Finalize failed.' },
      { status: 500 },
    )
  }
}
