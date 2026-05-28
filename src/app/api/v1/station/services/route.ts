/**
 * GET /api/v1/station/services: List services for authenticated station
 * POST /api/v1/station/services: Create a new service
 */
import { requireRole } from '@/lib/require-role';
import {
  getServicesByStationUser,
  createServiceWithEntries,
} from '@/server/station/services-service';
import { createServiceBodySchema } from '@/validators/station';
import { handleError } from '@/lib/responses';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

function decodeCursor(cursor?: string): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const [ts, id] = Buffer.from(cursor, 'base64').toString().split('|');
    const createdAt = new Date(ts ?? '');
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (Number.isNaN(createdAt.getTime()) || !id || !UUID_RE.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, 'station');
    if (auth instanceof Response) return auth;
    const { searchParams } = new URL(request.url);
    const parsedQuery = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsedQuery.success) return Response.json({ error: 'Validation failed' }, { status: 400 });
    const parsed = parsedQuery.data;
    const services = await getServicesByStationUser(auth.sub);
    const sorted = [...services].sort((a, b) => {
      const ts = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (ts !== 0) return ts;
      return b.id.localeCompare(a.id);
    });
    const cursor = decodeCursor(parsed.cursor);
    const filtered = cursor
      ? sorted.filter((s) => {
          const ts = new Date(s.created_at).getTime();
          const cursorTs = cursor.createdAt.getTime();
          return ts < cursorTs || (ts === cursorTs && s.id < cursor.id);
        })
      : sorted;
    const page = filtered.slice(0, parsed.limit);
    const hasMore = filtered.length > parsed.limit;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${new Date(last.created_at).toISOString()}|${last.id}`).toString('base64')
        : null;

    return Response.json({
      data: {
        items: page,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, 'station');
    if (auth instanceof Response) return auth;
    const body = await request.json();
    const validated = createServiceBodySchema.parse(body);

    const service = await createServiceWithEntries(auth.sub, validated);

    return Response.json({ data: service }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
