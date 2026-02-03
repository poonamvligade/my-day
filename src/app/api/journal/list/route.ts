import { listEntries } from '../../../../lib/journal'

export const runtime = 'nodejs'

export async function GET() {
  const entries = await listEntries()
  return Response.json({ entries })
}
