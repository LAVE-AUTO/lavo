# Stripe Connect Escrow — Webhooks, Notifications, Rapport hebdo

## Events Stripe gérés

1. `transfer.created`
   - Objectif: mapper le `transfer.id` vers la réservation correspondante.
   - Le mapping se fait via `transfer.metadata.reservation_id` (propagé depuis `createPaymentIntent`).
   - Idempotence: `reservations.stripe_transfer_id` n’est écrit que lorsqu’il est `NULL`.

2. `payment_intent.amount_capturable_updated`
   - Objectif: passer la réservation en `status=confirmed`.

3. `payment_intent.payment_failed` / `payment_intent.canceled`
   - Objectif: annuler la réservation (décrément booked_count) et envoyer un push client.

4. `payment_intent.succeeded`
   - Objectif: déclencher la “libération escrow” (push) une fois que Stripe confirme la capture.
   - Idempotence:
     - timestamp `reservations.stripe_payment_succeeded_at`
     - timestamp `reservations.stripe_payment_succeeded_notified_at` pour éviter les doublons push.
   - Timing:
     - si `status=completed` est déjà présent: push immédiat côté webhook.
     - si le webhook arrive avant `status=completed` (cas late capture): un fallback en backend envoie le push lors du passage en `completed`.

## Push notifications

- Client: push type `invitation_to_rate` lors de la libération escrow.
- Station/Admin (optionnel, via settings globales):
  - `enable_station_push_on_escrow_released` (valeur string `"true"`)
  - `enable_admin_push_on_escrow_released` (valeur string `"true"`)

## Cron hebdo email transactionnel

Endpoint:
- `GET /api/cron/send-escrow-weekly-transactions-report`

Sécurité:
- protégé par `CRON_SECRET` via `x-cron-secret` (ou `Authorization: Bearer <CRON_SECRET>`).

Période:
- fenêtre glissante “derniers 7 jours” (basée sur `reservations.stripe_payment_succeeded_at`).

Email:
- destinataire: `WEEKLY_TRANSACTIONS_REPORT_EMAIL`
- fallback: `ADMIN_NOTIFICATION_EMAIL`
- envoi via Resend (`src/lib/email.ts`).

## Notes d’intégration

- Pour que `transfer.created` puisse mapper correctement:
  - `createPaymentIntent` propage les metadata en `transfer_data.metadata`.
- Pour l’idempotence indispensable aux webhooks Stripe:
  - ne pas s’appuyer uniquement sur le statut en cours: utiliser `stripe_payment_succeeded_notified_at` côté DB.

