import { NextResponse } from 'next/server';

/**
 * GET /api/v1/stations
 * Placeholder route for public stations listing.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Stations listing not implemented yet.',
    },
    { status: 501 }
  );
}

