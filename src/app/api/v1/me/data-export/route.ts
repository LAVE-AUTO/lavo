/**
 * GET /api/v1/me/data-export
 * Returns a JSON file containing all personal data for the authenticated client
 * (RGPD Art. 20 / Loi 25 — right to data portability).
 */
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/require-role';
import { getFullUserData } from '@/server/users/user-data-service';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  try {
    const data = await getFullUserData(auth.sub);
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="hurryline-data-${date}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse(
      JSON.stringify({ message: 'Export failed', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
