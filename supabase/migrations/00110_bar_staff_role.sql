-- ADR-024 S4: Bar role for dedicated bar station interface.
-- Rollback: ALTER TABLE staff DROP CONSTRAINT staff_role_check, ADD CONSTRAINT staff_role_check CHECK (role IN ('owner', 'manager', 'staff', 'kitchen', 'waiter'));
--           ALTER TABLE staff_invites DROP CONSTRAINT staff_invites_role_check, ADD CONSTRAINT staff_invites_role_check CHECK (role IN ('owner', 'manager', 'staff', 'kitchen', 'waiter'));

ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_role_check,
  ADD CONSTRAINT staff_role_check
    CHECK (role IN ('owner', 'manager', 'staff', 'kitchen', 'waiter', 'bar'));

ALTER TABLE staff_invites
  DROP CONSTRAINT IF EXISTS staff_invites_role_check,
  ADD CONSTRAINT staff_invites_role_check
    CHECK (role IN ('owner', 'manager', 'staff', 'kitchen', 'waiter', 'bar'));
