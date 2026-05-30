import fs from 'fs';
import path from 'path';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

const METHOD_ORDER: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

type InferredOperation = {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query';
    required: boolean;
    description: string;
    schema: { type: string; format?: string };
    example?: string;
  }>;
  requestBody?: {
    required: boolean;
    content: {
      'application/json': {
        schema: {
          type: 'object';
          additionalProperties: true;
          description: string;
        };
      };
    };
    description: string;
  };
  responses: Record<string, { description: string; content?: Record<string, unknown> }>;
};

function walkRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkRouteFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name === 'route.ts') out.push(full);
  }
  return out;
}

function toOpenApiPath(routeFile: string): string {
  const rel = routeFile
    .replace(`${path.join(process.cwd(), 'src', 'app', 'api')}${path.sep}`, '')
    .replace(new RegExp(`${path.sep}route\\.ts$`), '')
    .replace(/\[(\.\.\.)?([^\]]+)\]/g, '{$2}')
    .split(path.sep)
    .join('/');

  if (rel.startsWith('v1/')) return `/${rel.slice(3)}`;
  return `/${rel}`;
}

function extractMethods(content: string): HttpMethod[] {
  const matches = [...content.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)];
  const methods = new Set<HttpMethod>();
  for (const m of matches) methods.add(m[1].toLowerCase() as HttpMethod);
  return METHOD_ORDER.filter((m) => methods.has(m));
}

function roleSecurity(pathname: string): InferredOperation['security'] {
  if (pathname.startsWith('/webhooks/stripe')) return [];
  if (pathname.startsWith('/cron/')) {
    return [{ CronSecret: [] }];
  }

  const publicPaths = [
    '/health',
    '/formats',
    '/legal/{key}',
    '/promo/referrals/{refCode}',
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/auth/resend-verification-email',
    '/auth/oauth/finalize',
    '/stations',
    '/stations/{id}',
    '/stations/{id}/availability',
    '/stations/{id}/formats',
    '/stations/{id}/ratings',
    '/stations/onboarding/submit',
    '/stations/onboarding/upload',
    '/stations/onboarding/validate/step1',
    '/stations/onboarding/validate/step2',
  ];

  if (publicPaths.includes(pathname)) return [];
  return [{ BearerAuth: [] }];
}

function endpointTag(pathname: string): string {
  if (pathname.startsWith('/auth/')) return 'Auth';
  if (pathname.startsWith('/admin/')) return 'Admin';
  if (pathname.startsWith('/station/')) return 'Station';
  if (pathname.startsWith('/stations/')) return 'Stations';
  if (pathname.startsWith('/reservations/')) return 'Reservations';
  if (pathname.startsWith('/support')) return 'Support';
  if (pathname.startsWith('/history/')) return 'History';
  if (pathname.startsWith('/me/')) return 'Me';
  if (pathname.startsWith('/ratings')) return 'Ratings';
  if (pathname.startsWith('/disputes')) return 'Disputes';
  if (pathname.startsWith('/cron/')) return 'Cron';
  if (pathname.startsWith('/webhooks/')) return 'Webhooks';
  return 'General';
}

function prettySummary(method: HttpMethod, pathname: string): string {
  const actionMap: Record<HttpMethod, string> = {
    get: 'Get',
    post: 'Create or execute',
    put: 'Replace',
    patch: 'Update',
    delete: 'Delete',
  };

  const resource = pathname
    .replace(/^\//, '')
    .replace(/\{[^}]+\}/g, 'item')
    .replace(/\//g, ' ')
    .replace(/[-_]/g, ' ')
    .trim();

  return `${actionMap[method]} ${resource}`;
}

function detailedDescription(pathname: string, method: HttpMethod): string {
  if (pathname.startsWith('/cron/')) {
    return 'Protected operational endpoint used by schedulers/cron runners. Requires CRON secret in header or bearer and executes a background maintenance/business job.';
  }
  if (pathname.startsWith('/webhooks/stripe')) {
    return 'Stripe callback endpoint. The request signature is verified server-side before processing events.';
  }
  if (pathname.startsWith('/admin/')) {
    return 'Administrative endpoint for governance, moderation, analytics, platform settings, or operational controls. Requires admin role.';
  }
  if (pathname.startsWith('/station/')) {
    return 'Station-operator endpoint used for daily operations: queue control, reservation handling, configuration, availability, analytics, and Stripe onboarding/status.';
  }
  if (pathname.startsWith('/me/')) {
    return 'Authenticated end-user endpoint for profile, entries, favorites, notifications, preferences, and device token management.';
  }
  if (pathname.startsWith('/auth/')) {
    return 'Authentication lifecycle endpoint covering registration, login, token refresh, password workflows, and account verification.';
  }
  if (pathname.startsWith('/stations/')) {
    return 'Station discovery/onboarding endpoint for public listing/details, onboarding validation/submission/upload, and station-specific booking or queue actions.';
  }
  if (pathname.startsWith('/reservations/')) {
    return 'Reservation lifecycle action endpoint (presence confirmation, delay actions, reschedule, tip, and related state transitions).';
  }
  if (pathname.startsWith('/support')) {
    return 'Support module endpoint for ticket creation/listing, ticket detail updates, and message threads.';
  }
  if (pathname.startsWith('/history/')) {
    return 'History and receipt retrieval endpoint for client/station activity and downloadable receipt resources.';
  }
  if (pathname.startsWith('/disputes')) {
    return 'Dispute workflow endpoint for opening or managing reservation/payment disputes.';
  }
  if (pathname.startsWith('/ratings')) {
    return 'Ratings endpoint for creating client ratings and reading personal rating history.';
  }
  if (pathname.startsWith('/health')) {
    return 'Health check endpoint used by monitors and deployment probes.';
  }

  return `${prettySummary(method, pathname)} endpoint derived from current route handler implementation.`;
}

function operationId(method: HttpMethod, pathname: string): string {
  const cleaned = pathname
    .replace(/^\//, '')
    .replace(/\{([^}]+)\}/g, 'By_$1')
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .split('/')
    .map((segment) => segment.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase()))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

  return `${method}${cleaned}`;
}

function inferParams(pathname: string): InferredOperation['parameters'] {
  const names = [...pathname.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (!names.length) return undefined;

  return names.map((name) => ({
    name,
    in: 'path' as const,
    required: true,
    description: `Path identifier parameter: ${name}`,
    schema: { type: 'string' },
    example: name.toLowerCase().includes('id') ? '00000000-0000-0000-0000-000000000000' : undefined,
  }));
}

function defaultResponses(method: HttpMethod, pathname: string): InferredOperation['responses'] {
  const successCode = method === 'post' ? '201' : method === 'delete' ? '200' : '200';
  const responses: InferredOperation['responses'] = {
    [successCode]: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SuccessEnvelope' },
        },
      },
    },
    '400': {
      description: 'Validation error or malformed input',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        },
      },
    },
    '500': {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        },
      },
    },
  };

  const isPublic = Array.isArray(roleSecurity(pathname)) && roleSecurity(pathname)?.length === 0;
  if (!isPublic) {
    responses['401'] = {
      description: 'Authentication required or invalid session/token',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        },
      },
    };
    responses['403'] = {
      description: 'Authenticated but not authorized for this endpoint',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        },
      },
    };
  }

  if (pathname.includes('{')) {
    responses['404'] = {
      description: 'Resource not found for provided path parameter',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        },
      },
    };
  }

  return responses;
}

function inferRequestBody(pathname: string, method: HttpMethod): InferredOperation['requestBody'] {
  if (method === 'get' || method === 'delete') return undefined;
  if (pathname.startsWith('/stations/onboarding/upload') || pathname.startsWith('/upload')) {
    return undefined;
  }

  return {
    required: true,
    description: 'Request body schema is validated in the route handler via Zod validators. See endpoint implementation for exact field constraints.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: true,
          description: 'Code-derived generic object placeholder for non-annotated endpoint. Replace with explicit schema for full contract precision.',
        },
      },
    },
  };
}

export function buildInferredPaths(): Record<string, Record<string, InferredOperation>> {
  const apiRoot = path.join(process.cwd(), 'src', 'app', 'api');
  const files = walkRouteFiles(apiRoot);

  const paths: Record<string, Record<string, InferredOperation>> = {};

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const methods = extractMethods(content);
    if (!methods.length) continue;

    const openApiPath = toOpenApiPath(file);
    paths[openApiPath] ??= {};

    for (const method of methods) {
      paths[openApiPath][method] = {
        operationId: operationId(method, openApiPath),
        tags: [endpointTag(openApiPath)],
        summary: prettySummary(method, openApiPath),
        description: detailedDescription(openApiPath, method),
        security: roleSecurity(openApiPath),
        parameters: inferParams(openApiPath),
        requestBody: inferRequestBody(openApiPath, method),
        responses: defaultResponses(method, openApiPath),
      };
    }
  }

  return paths;
}
