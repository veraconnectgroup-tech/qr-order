function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

export const env = {
  supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  cronSecret: process.env.CRON_SECRET,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
