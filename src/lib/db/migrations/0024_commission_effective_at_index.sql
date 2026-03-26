-- Index on effective_at: used by every commission rate lookup (ORDER BY + WHERE lte).
CREATE INDEX "commission_settings_effective_at_idx" ON "commission_settings" ("effective_at");
