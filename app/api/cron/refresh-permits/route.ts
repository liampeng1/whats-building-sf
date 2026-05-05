import { NextResponse } from 'next/server'
import { writePermitsSnapshot } from '@/lib/permit-cache'
import { fetchAllTrackedPermitsForSnapshot } from '@/lib/datasf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily cron route. Vercel hits this on the schedule defined in vercel.json.
 *
 * Authentication: Vercel Cron sends a Bearer token equal to CRON_SECRET if
 * that env var is configured. For non-Vercel callers we reject. In dev
 * (NODE_ENV !== 'production') we allow any caller so you can hit it manually
 * to seed the cache locally.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    const auth = req.headers.get('authorization') ?? ''
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const permits = await fetchAllTrackedPermitsForSnapshot()
    await writePermitsSnapshot(permits)
    return NextResponse.json({
      ok: true,
      count: permits.length,
      capturedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('cron refresh failed', err)
    return NextResponse.json(
      { error: 'snapshot refresh failed', message: (err as Error).message },
      { status: 500 },
    )
  }
}
