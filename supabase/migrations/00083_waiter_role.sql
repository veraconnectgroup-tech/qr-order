-- H10: Waiter role for mobile-first floor staff interface.
-- Rollback: ALTER TABLE staff DROP CONSTRAINT staff_role_check, ADD CONSTRAINT staff_role_check CHECK (role IN ('owner', 'manager', 'staff', 'kitchen'));
--           ALTER TABLE staff_invites DROP CONSTRAINT staff_invites_role_check, ADD CONSTRAINT staff_invites_role_check CHECK (role IN ('owner', 'manager', 'staff', 'kitchen'));

ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_role_check,
  ADD CONSTRAINT staff_role_check
    CHECK (role IN ('owner', 'manager', 'staff', 'kitchen', 'waiter'));

ALTER TABLE staff_invites
  DROP CONSTRAINT IF EXISTS staff_invites_role_check,
  ADD CONSTRAINT staff_invites_role_check
    CHECK (role IN ('owner', 'manager', 'staff', 'kitchen', 'waiter'));
