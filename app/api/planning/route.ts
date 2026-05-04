import { fetchPlanningCases } from '@/lib/datasf'

export async function GET(_req: Request) {
  try {
    const cases = await fetchPlanningCases()
    return Response.json(cases)
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to fetch planning cases' }, { status: 500 })
  }
}
