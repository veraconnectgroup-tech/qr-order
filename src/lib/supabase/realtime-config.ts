/** Shared Supabase Realtime client options (browser + server). */
export const SUPABASE_REALTIME_OPTIONS = {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
} as const;
