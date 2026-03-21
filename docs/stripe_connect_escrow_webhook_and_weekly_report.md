# Stripe Connect Escrow — Webhooks, Notifications, Rapport hebdo

## Events Stripe gérés

1. `transfer.created`
   - Objectif: mapper le `transfer.id` vers la réservation correspondante.
   - Mapping robuste:
     - prioritaire via `transfer.metadata.reservation_id` (quand présent),
     - fallback via `transfer.source_transaction` (Charge) → `charge.payment_intent` → lookup `reservations.stripe_payment_id`.
   - Si données incohérentes/incomplètes: log backend + webhook ack (pas d’échec artificiel/retry inutile).
   - Idempotence: `reservations.stripe_transfer_id` n’est écrit que lorsqu’il est `NULL`.

2. `payment_intent.amount_capturable_updated`
   - Objectif: passer la réservation en `status=confirmed`.

3. `payment_intent.payment_failed` / `payment_intent.canceled`
   - Objectif: annuler la réservation (décrément `booked_count`), push client (`entry_cancelled`), **e-mail client** (Resend) lorsque l’annulation est effective (idempotent: pas de retraitement si l’entrée n’était plus éligible).

4. `payment_intent.succeeded`
   - Objectif: déclencher la « libération escrow » (push + **e-mail client de succès** Resend) une fois que Stripe confirme la capture et que les garde-fous métier sont remplis.
   - Idempotence:
     - timestamp `reservations.stripe_payment_succeeded_at`
     - timestamp `reservations.stripe_payment_succeeded_notified_at` pour éviter les doublons **push et e-mail**.
   - Timing:
     - si `status=completed` est déjà présent: notifications immédiates côté webhook.
     - si le webhook arrive avant `status=completed` (late capture): fallback en backend (`reservation-service`) envoie push + e-mail au passage en `completed`, avec la même barrière d’idempotence.

## E-mails client (Resend)

- Succès escrow: envoyé dans le même flux idempotent que le push `invitation_to_rate` (webhook ou fallback après `completed`).
- Échec / annulation paiement: envoyé après annulation effective + push (si adresse utilisateur valide).
- Rapport hebdo admin (activité escrow): voir section cron ci-dessous — distinct des e-mails transactionnels ci-dessus.

## Push notifications

- Client: push type `invitation_to_rate` lors de la libération escrow.
- Station/Admin (optionnel, via settings globales):
  - `enable_station_push_on_escrow_released` (valeur string `"true"`)
  - clé canonique admin: `stripe_admin_notifications_enabled` (valeur string `"true"`)
  - compat backward: fallback sur `enable_admin_push_on_escrow_released` si la clé canonique est absente

## Cron hebdo email transactionnel

Endpoint:
- `GET /api/cron/send-escrow-weekly-transactions-report`

Sécurité:
- protégé par `CRON_SECRET` via `x-cron-secret` (ou `Authorization: Bearer <CRON_SECRET>`).

Période:
- fenêtre glissante « derniers 7 jours » (basée sur `reservations.stripe_payment_succeeded_at`).

Email:
- destinataire: `WEEKLY_TRANSACTIONS_REPORT_EMAIL`
- fallback: `ADMIN_NOTIFICATION_EMAIL`
- envoi via Resend (`src/lib/email.ts`).

## Notes d’intégration

- Pour que `transfer.created` puisse mapper correctement:
  - `createPaymentIntent` propage les metadata en `transfer_data.metadata`.
- Pour l’idempotence indispensable aux webhooks Stripe:
  - ne pas s’appuyer uniquement sur le statut en cours: utiliser `stripe_payment_succeeded_notified_at` côté DB.
