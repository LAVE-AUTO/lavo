/**
 * /api/v1/reservations
 * Deprecated: Use POST /api/v1/stations/:id/reservations to create reservations,
 * and GET /api/v1/me/entries to list user entries.
 */
import { error404 } from '@/lib/responses';

export async function POST() {
  return error404('Use POST /api/v1/stations/:stationId/reservations instead');
}

export async function GET() {
  return error404('Use GET /api/v1/me/entries instead');
}
