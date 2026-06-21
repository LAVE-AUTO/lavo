import { successResponse } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * GET /api/v1/health
 * Health check endpoint for verifying the API is running.
 */
export async function GET() {
  return successResponse(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    'Hurryline API is running',
    HTTP_STATUS.OK
  );
}
