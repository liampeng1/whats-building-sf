import {
  buildPublicRows,
  PUBLIC_API_META,
  PUBLIC_API_HEADERS,
} from '@/lib/public-permits'

export const revalidate = 21600

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  try {
    const rows = await buildPublicRows({
      completedYears: searchParams.get('completedYears') != null
        ? Number(searchParams.get('completedYears'))
        : undefined,
      recentMonths: searchParams.get('recentMonths') != null
        ? Number(searchParams.get('recentMonths'))
        : undefined,
    })
    return Response.json(
      {
        meta: {
          ...PUBLIC_API_META,
          generated_at: new Date().toISOString(),
          count: rows.length,
        },
        permits: rows,
      },
      { headers: PUBLIC_API_HEADERS },
    )
  } catch (err) {
    console.error('public permits.json', err)
    return Response.json({ error: 'Failed to fetch permits' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  })
}
