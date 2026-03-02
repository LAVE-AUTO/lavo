import { NextResponse } from 'next/server';

/**
 * POST /api/v1/auth/register
 * Placeholder route for user registration.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Registration endpoint not implemented yet.',
    },
    { status: 501 }
  );
}

