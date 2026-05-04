import { fetchPlanningCase, NotFoundError } from '@/lib/datasf'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const planningCase = await fetchPlanningCase(id)
    return Response.json(planningCase)
  } catch (err) {
    console.error(err)
    if (err instanceof NotFoundError) {
      return Response.json({ error: 'Planning case not found' }, { status: 404 })
    }
    return Response.json({ error: 'Failed to fetch planning case' }, { status: 500 })
  }
}
