/**
 * GET /api/v1/cancellation-policy — Public. Returns the current cancellation/reschedule
 * penalty policy (free window + penalty rate) so client-facing screens can show an accurate
 * fee preview instead of a hardcoded guess. Read-only, no sensitive data — same admin-configured
 * values already used server-side by cancellation-service.ts / reschedule-service.ts /
 * no-show-service.ts via getCancellationPolicy().
 */
import { getCancellationPolicy } from '@/server/admin/platform-settings-service';
import { handleError } from '@/lib/responses';

export async function GET() {
  try {
    const policy = await getCancellationPolicy();
    return Response.json({
      data: {
        free_window_minutes: policy.freeWindowMinutes,
        penalty_rate: policy.penaltyRate,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
