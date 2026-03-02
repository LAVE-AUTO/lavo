import { NextResponse } from 'next/server';

/**
 * GET /api/v1/station/config
 * Placeholder route for station configuration.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Station config endpoint not implemented yet.',
    },
    { status: 501 }
  );
}

