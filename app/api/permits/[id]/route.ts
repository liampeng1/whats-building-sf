import { fetchBuildingPermit, NotFoundError } from '@/lib/datasf'

// Cache individual permit responses for 1 hour — pipeline_status and demos
// don't change minute-by-minute, but we want shorter than the bulk list since
// these are deeper-dive lookups.
export const revalidate = 3600

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const permit = await fetchBuildingPermit(id)
    return Response.json(permit)
  } catch (err) {
    console.error(err)
    if (err instanceof NotFoundError) {
      return Response.json({ error: 'Permit not found' }, { status: 404 })
    }
    return Response.json({ error: 'Failed to fetch permit' }, { status: 500 })
  }
}
