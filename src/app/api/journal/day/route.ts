import { getFinalPath, getLogPath, getRawPath, readText } from '../../../../lib/journal'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (!date) {
    return Response.json({ error: 'Missing date.' }, { status: 400 })
  }

  const [raw, log, final] = await Promise.all([
    readText(getRawPath(date)),
    readText(getLogPath(date)),
    readText(getFinalPath(date)),
  ])

  return Response.json({ date, raw, log, final })
}
