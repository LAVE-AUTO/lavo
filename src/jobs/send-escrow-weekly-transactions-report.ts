/**
 * Cron job: send weekly escrow transactions report.
 *
 * The report aggregates Stripe PaymentIntent captures released through escrow:
 * - uses reservations.stripe_payment_succeeded_at (set on payment_intent.succeeded webhook)
 * - includes all reservations with succeeded_at in the last 7 days window
 *
 * Email copy locale: `WEEKLY_REPORT_LOCALE` (`fr` | `en`, default `fr`) — see `.env.example`.
 */
import { and, eq, gte, isNotNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservations, stations, users } from '@/lib/db/schema';
import {
  sendWeeklyEscrowTransactionsReportEmail,
  type WeeklyEscrowTransactionRow,
} from '@/lib/email';
import { validateEmail } from '@/helpers/validators';

export type SendEscrowWeeklyTransactionsReportResult = {
  processed: number;
  emailSent: boolean;
  weekStartISO: string;
  weekEndISO: string;
};

type WeeklyReportLocale = 'fr' | 'en';

/**
 * Resolves email template locale; default `fr` matches app primary locale (next-intl) and operator expectations.
 */
function resolveWeeklyReportLocale(): WeeklyReportLocale {
  const raw = process.env.WEEKLY_REPORT_LOCALE?.trim().toLowerCase();
  if (raw === 'en') return 'en';
  return 'fr';
}

export async function runSendEscrowWeeklyTransactionsReport(): Promise<SendEscrowWeeklyTransactionsReportResult> {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekEnd = now;

  const recipient =
    process.env.WEEKLY_TRANSACTIONS_REPORT_EMAIL?.trim() ||
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim() ||
    '';

  if (!recipient) {
    console.warn(
      '[send-escrow-weekly-transactions-report] Missing WEEKLY_TRANSACTIONS_REPORT_EMAIL (or ADMIN_NOTIFICATION_EMAIL). Skipping email.'
    );
    return {
      processed: 0,
      emailSent: false,
      weekStartISO: weekStart.toISOString(),
      weekEndISO: weekEnd.toISOString(),
    };
  }

  if (!validateEmail(recipient)) {
    console.warn(
      '[send-escrow-weekly-transactions-report] Invalid WEEKLY_TRANSACTIONS_REPORT_EMAIL or ADMIN_NOTIFICATION_EMAIL (not a valid email). Skipping email.'
    );
    return {
      processed: 0,
      emailSent: false,
      weekStartISO: weekStart.toISOString(),
      weekEndISO: weekEnd.toISOString(),
    };
  }

  const rawRows = await db
    .select({
      reservationId: reservations.id,
      reservationStatus: reservations.status,
      succeededAt: reservations.stripe_payment_succeeded_at,
      clientEmail: users.email,
      stationName: stations.name,
      amountPaid: reservations.amount_paid,
      commissionAmount: reservations.commission_amount,
      stationPayout: reservations.station_payout,
      stripePaymentId: reservations.stripe_payment_id,
      stripeTransferId: reservations.stripe_transfer_id,
    })
    .from(reservations)
    .innerJoin(users, eq(reservations.user_id, users.id))
    .innerJoin(stations, eq(reservations.station_id, stations.id))
    .where(
      and(
        eq(reservations.entry_type, 'reservation'),
        isNotNull(reservations.stripe_payment_succeeded_at),
        gte(reservations.stripe_payment_succeeded_at, weekStart),
        lt(reservations.stripe_payment_succeeded_at, weekEnd)
      )
    )
    .orderBy(reservations.stripe_payment_succeeded_at);

  const rows: WeeklyEscrowTransactionRow[] = [];
  for (const r of rawRows) {
    const succeededAt = r.succeededAt;
    if (!(succeededAt instanceof Date) || Number.isNaN(succeededAt.getTime())) {
      console.warn('[send-escrow-weekly-transactions-report] Skipping row with invalid succeededAt', {
        reservationId: r.reservationId,
      });
      continue;
    }
    rows.push({
      reservationId: r.reservationId,
      reservationStatus: r.reservationStatus,
      succeededAt,
      clientEmail: r.clientEmail,
      stationName: r.stationName,
      amountPaid: r.amountPaid,
      commissionAmount: r.commissionAmount,
      stationPayout: r.stationPayout,
      stripePaymentId: r.stripePaymentId,
      stripeTransferId: r.stripeTransferId,
    });
  }

  await sendWeeklyEscrowTransactionsReportEmail(recipient, {
    locale: resolveWeeklyReportLocale(),
    weekStart,
    weekEnd,
    rows,
  });

  return {
    processed: rows.length,
    emailSent: true,
    weekStartISO: weekStart.toISOString(),
    weekEndISO: weekEnd.toISOString(),
  };
}

