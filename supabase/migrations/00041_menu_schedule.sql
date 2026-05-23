-- Time-limited category availability (guest menu schedule)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS schedule_start TIME;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS schedule_end TIME;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS schedule_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6,0}';
