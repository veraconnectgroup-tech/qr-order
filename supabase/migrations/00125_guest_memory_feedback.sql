-- I2: Remember last visit feedback for consented return guests (never shown to guest)

ALTER TABLE denis_guest_memory
  ADD COLUMN IF NOT EXISTS last_feedback_sentiment TEXT
    CHECK (
      last_feedback_sentiment IS NULL OR
      last_feedback_sentiment IN ('positive', 'neutral', 'negative')
    ),
  ADD COLUMN IF NOT EXISTS last_feedback_category TEXT
    CHECK (
      last_feedback_category IS NULL OR
      last_feedback_category IN ('food', 'service', 'wait_time', 'other')
    ),
  ADD COLUMN IF NOT EXISTS last_feedback_at TIMESTAMPTZ;

COMMENT ON COLUMN denis_guest_memory.last_feedback_sentiment IS
  'Last submitted feedback sentiment — staff/LLM context only, not guest-facing';
