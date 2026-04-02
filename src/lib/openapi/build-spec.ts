/**
 * Builds the complete OpenAPI 3.1 specification by combining the base
 * swaggerDefinition with @swagger JSDoc annotations extracted from route files.
 *
 * This module is intended to run only inside a Node.js API Route handler
 * (server-side). It must never be imported from client components.
 *
 * The spec is generated once per process lifetime and cached in memory to
 * avoid repeated filesystem scans on every request.
 */
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { swaggerDefinition } from './spec';

let cachedSpec: ReturnType<typeof swaggerJsdoc> | null = null;

/**
 * Returns the fully assembled OpenAPI spec object.
 * The result is memoized after the first call.
 *
 * Throws if the annotation scan encounters errors (failOnErrors: true)
 * so broken annotations are caught early instead of producing a partial spec.
 */
export function buildOpenApiSpec(): ReturnType<typeof swaggerJsdoc> {
  if (cachedSpec) return cachedSpec;

  // Resolve paths relative to the project root (cwd at build/runtime).
  const apiDir = path.join(process.cwd(), 'src', 'app', 'api', 'v1');

  const options: swaggerJsdoc.Options = {
    definition: swaggerDefinition,
    // Scan every route.ts file under /api/v1/ for @swagger JSDoc annotations.
    apis: [`${apiDir}/**/*.ts`],
    failOnErrors: true,
  };

  const spec = swaggerJsdoc(options);

  // Freeze the cached object so request handlers cannot mutate it (cache poisoning).
  cachedSpec = Object.freeze(spec) as ReturnType<typeof swaggerJsdoc>;
  return cachedSpec;
}
