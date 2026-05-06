-- Migration 0009: add service_scope to stations (Unit 5 - type de prestation).
-- Values: 'exterior' | 'interior' | 'both'. Nullable for existing stations.

--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN IF NOT EXISTS "service_scope" varchar(20) CHECK ("service_scope" IN ('exterior', 'interior', 'both'));

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stations_service_scope_idx" ON "stations"("service_scope");
