import { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/dashboard
 * Placeholder route for admin dashboard metrics.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Admin dashboard endpoint not implemented yet.',
    },
    { status: 501 }
  );
}

