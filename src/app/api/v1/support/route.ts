import { NextResponse } from 'next/server';

/**
 * POST /api/v1/support
 * Placeholder route for support ticket creation.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Support endpoint not implemented yet.',
    },
    { status: 501 }
  );
}

