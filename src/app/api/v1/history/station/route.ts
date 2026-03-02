import { NextResponse } from 'next/server';

/**
 * GET /api/v1/history/station
 * Placeholder route for station history.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Station history endpoint not implemented yet.',
    },
    { status: 501 }
  );
}

