import { NextResponse } from 'next/server';

/**
 * GET /api/v1/history/client
 * Placeholder route for client history.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Client history endpoint not implemented yet.',
    },
    { status: 501 }
  );
}

