'use client';

/**
 * /docs — Swagger UI viewer for the Lavo OpenAPI specification.
 *
 * Displays the full API documentation by loading the spec from GET /api/docs.
 *
 * In production the backing /api/docs endpoint returns 404 unless
 * ENABLE_API_DOCS=true, so even if this page is rendered it will not
 * display any spec content.
 *
 * Implementation notes:
 * - Uses 'use client' because swagger-ui-react requires browser APIs.
 * - Dynamic import is used to avoid SSR errors from swagger-ui-react.
 * - No authentication is required to view the docs (the endpoint itself
 *   is the control point).
 * - tryItOutEnabled is disabled to reduce accidental mutation risk.
 */
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to prevent SSR — swagger-ui-react uses browser globals.
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#555' }}>
      Loading API documentation...
    </div>
  ),
});

/**
 * Swagger UI page component.
 * Renders the OpenAPI spec fetched from /api/docs.
 */
export default function ApiDocsPage() {
  const isNonProd = process.env.NODE_ENV !== 'production';

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {isNonProd && (
        <div
          role="alert"
          style={{
            background: '#fff3cd',
            borderBottom: '2px solid #ffc107',
            color: '#664d03',
            fontFamily: 'sans-serif',
            fontSize: '0.875rem',
            padding: '0.75rem 1.5rem',
          }}
        >
          <strong>Dev / Staging only</strong> — This API documentation page is visible because{' '}
          <code>NODE_ENV</code> is not set to <code>production</code>. Do not expose this page to
          end users in production without additional access controls.
        </div>
      )}

      <SwaggerUI
        url="/api/docs"
        docExpansion="list"
        defaultModelsExpandDepth={1}
        persistAuthorization
        filter
        deepLinking
        tryItOutEnabled={false}
      />
    </div>
  );
}
