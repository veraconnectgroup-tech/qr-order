-- Denis's waiter handoff has been a context-free "someone wants a waiter"
-- ping since it shipped: staff had to walk over and ask the guest again
-- what they actually needed. This carries the guest's own words through,
-- when Denis has them (free-text T0 detection), so the founder's "find a
-- way — hand off with what's actually needed" directive is real, not
-- just a button push.

ALTER TABLE waiter_calls
  ADD COLUMN reason TEXT CHECK (reason IS NULL OR length(reason) <= 500);

COMMENT ON COLUMN waiter_calls.reason IS
  'Guest''s own message when Denis detected the waiter request from free text (T0 reflex) — null for a plain chip tap, which carries no extra context beyond "guest wants a waiter."';
