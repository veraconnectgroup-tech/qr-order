CREATE TABLE IF NOT EXISTS staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'kitchen')),
  invited_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON staff_invites(token);
CREATE INDEX IF NOT EXISTS idx_staff_invites_org ON staff_invites(org_id);

ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own org invites" ON staff_invites;
CREATE POLICY "Staff read own org invites" ON staff_invites
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

DROP POLICY IF EXISTS "Service role manages staff invites" ON staff_invites;
CREATE POLICY "Service role manages staff invites" ON staff_invites
  FOR ALL USING (false);
