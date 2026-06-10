/**
 * Cron job: send the daily activity report to every station that opted in
 * (notification_prefs.daily_report === true).
 *
 * Summarises the PREVIOUS UTC calendar day (the cron is meant to run early each
 * morning): completed services, revenue, tips, and distinct clients. Stations
 * with no activity are skipped to avoid empty noise.
 *
 * Invocation: GET /api/cron/send-station-daily-report with CRON_SECRET header.
 */
import { findStationsWantingDailyReport } from '@/server/station/station-repository';
import { getStationDailySummary } from '@/server/station/station-analytics-repository';
import { sendStationDailyReportEmail } from '@/lib/email';
import { runWithConcurrencyLimit } from '@/helpers/concurrency';

const LOG_PREFIX = '[send-station-daily-report]';

export type SendDailyReportResult = { processed: number; sent: number; skipped: number; failed: number };

/** Returns [startOfYesterday, startOfToday) in UTC. */
function previousDayRange(now = new Date()): { from: Date; to: Date; reportDate: Date } {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const from = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  return { from, to: todayStart, reportDate: from };
}

export async function runSendStationDailyReport(): Promise<SendDailyReportResult> {
  const recipients = await findStationsWantingDailyReport();
  const { from, to, reportDate } = previousDayRange();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const results = await runWithConcurrencyLimit(recipients, 5, async (recipient) => {
    const summary = await getStationDailySummary(recipient.station_id, from, to);
    // Skip a fully idle day - an empty report is noise, not value.
    if (summary.completed === 0) {
      skipped += 1;
      return;
    }
    await sendStationDailyReportEmail({
      to: recipient.owner_email,
      stationName: recipient.station_name,
      date: reportDate,
      completed: summary.completed,
      revenue: Number.parseFloat(summary.revenue) || 0,
      tips: Number.parseFloat(summary.tips) || 0,
      clients: summary.clients,
    });
    sent += 1;
  });

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') {
      failed += 1;
      console.error(
        `${LOG_PREFIX} Failed for station ${recipients[i].station_id}:`,
        r.reason instanceof Error ? r.reason.message : String(r.reason)
      );
    }
  }

  return { processed: recipients.length, sent, skipped, failed };
}
