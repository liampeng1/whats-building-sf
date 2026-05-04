import { fetchBuildingPermit, NotFoundError } from '@/lib/datasf'

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
