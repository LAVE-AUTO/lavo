import { NextResponse } from 'next/server';

/**
 * POST /api/v1/webhooks/stripe
 * Placeholder route for Stripe webhooks.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Stripe webhook handler not implemented yet.',
    },
    { status: 501 }
  );
}

