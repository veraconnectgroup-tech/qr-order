-- J2: Remember dessert nudge dismissals across visits

ALTER TABLE denis_guest_memory
  ADD COLUMN IF NOT EXISTS dessert_nudge_dismiss_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip_dessert_nudge BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN denis_guest_memory.dessert_nudge_dismiss_count IS
  'Times guest dismissed dessert_nudge — J2 banner learning';
COMMENT ON COLUMN denis_guest_memory.skip_dessert_nudge IS
  'When true, suppress dessert_nudge proactive offers for this guest';
