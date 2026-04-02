/**
 * GET /api/docs
 * Serves the OpenAPI 3.1 specification as JSON.
 *
 * This endpoint is intentionally public (no auth required) so that API clients,
 * Swagger UI, and automated tooling can consume the spec without credentials.
 * Sensitive implementation details are not exposed through the spec itself.
 *
 * Response:
 *   200 application/json — full OpenAPI 3.1 spec object
 */
import { NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/openapi/build-spec';

/**
 * Returns the assembled OpenAPI 3.1 JSON specification.
 * The spec is built once and cached in memory for the process lifetime.
 */
export async function GET(): Promise<NextResponse> {
  const spec = buildOpenApiSpec();

  return new NextResponse(JSON.stringify(spec, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Allow Swagger UI hosted on the same origin to fetch the spec.
      'Access-Control-Allow-Origin': '*',
      // Prevent caching in dev; allow short-lived cache in prod.
      'Cache-Control':
        process.env.NODE_ENV === 'production'
          ? 'public, max-age=300, s-maxage=300'
          : 'no-store',
    },
  });
}
