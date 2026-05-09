import { fetchBmrForParcel } from '@/lib/mohcd'

export const revalidate = 86400

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ block: string; lot: string }> },
) {
  const { block, lot } = await params
  if (!/^[0-9A-Z]+$/i.test(block) || !/^[0-9A-Z]+$/i.test(lot)) {
    return Response.json({ error: 'invalid block or lot' }, { status: 400 })
  }
  try {
    const row = await fetchBmrForParcel(block, lot)
    if (!row) return Response.json({ found: false }, { status: 404 })
    return Response.json(
      { found: true, ...row },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  } catch (err) {
    console.error('bmr lookup', err)
    return Response.json({ error: 'lookup failed' }, { status: 500 })
  }
}
