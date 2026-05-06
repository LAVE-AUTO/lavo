/**
 * GET /api/docs
 * Serves the OpenAPI 3.1 specification as JSON.
 *
 * In production the endpoint is disabled by default to prevent attackers from
 * mapping the full API surface via the spec.  Set the ENABLE_API_DOCS
 * environment variable to "true" to opt in (e.g. for an internal staging
 * deployment).
 *
 * Response:
 *   200 application/json - full OpenAPI 3.1 spec object
 *   404 - when the docs endpoint is disabled
 */
import { NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/openapi/build-spec';

const isProduction = process.env.NODE_ENV === 'production';
const docsEnabled = !isProduction || process.env.ENABLE_API_DOCS === 'true';

/**
 * Returns the assembled OpenAPI 3.1 JSON specification.
 * The spec is built once and cached in memory for the process lifetime.
 * Disabled in production unless ENABLE_API_DOCS=true.
 */
export async function GET(): Promise<NextResponse> {
  if (!docsEnabled) {
    return NextResponse.json(
      { message: 'Not found' },
      { status: 404 },
    );
  }

  let spec: ReturnType<typeof buildOpenApiSpec>;
  try {
    spec = buildOpenApiSpec();
  } catch {
    // Do not leak internal error details (file paths, stack traces).
    return NextResponse.json(
      { message: 'Failed to build API specification' },
      { status: 500 },
    );
  }

  return new NextResponse(JSON.stringify(spec, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Prevent caching in dev; allow short-lived cache in prod.
      'Cache-Control': isProduction
        ? 'public, max-age=300, s-maxage=300'
        : 'no-store',
    },
  });
}
