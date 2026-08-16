-- Migration 017: per-screen mute toggle.
--
-- Defaults to muted (1) so a newly configured display — and every
-- existing one, via the column default backfilling current rows — never
-- produces audio until the KJ deliberately unmutes it from the
-- Connected Displays panel. Lives on display_screens alongside
-- default_volume: it's per-screen configuration the KJ can flip live,
-- not the ephemeral per-song playback clock that display_state tracks.
--
-- Once-only: idempotency is enforced by the schema_migrations ledger in
-- scripts/migrate.php.

ALTER TABLE display_screens
  ADD COLUMN muted TINYINT(1) NOT NULL DEFAULT 1 AFTER default_volume;
