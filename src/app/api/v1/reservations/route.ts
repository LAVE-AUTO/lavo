import { NextResponse } from 'next/server';

/**
 * POST /api/v1/reservations
 * Placeholder route for reservation creation/listing.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Reservations endpoint not implemented yet.',
    },
    { status: 501 }
  );
}

