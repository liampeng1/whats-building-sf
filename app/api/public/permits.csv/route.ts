import { buildPublicRows, rowsToCsv, PUBLIC_API_HEADERS } from '@/lib/public-permits'

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
    return new Response(rowsToCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="whats-building-sf-permits.csv"',
        ...PUBLIC_API_HEADERS,
      },
    })
  } catch (err) {
    console.error('public permits.csv', err)
    return new Response('Failed to fetch permits\n', { status: 500 })
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
