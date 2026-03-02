import { NextResponse } from 'next/server';

/**
 * POST /api/v1/ratings
 * Placeholder route for submitting ratings.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Ratings endpoint not implemented yet.',
    },
    { status: 501 }
  );
}

