const isServer = typeof window === "undefined";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val && isServer) throw new Error(`Missing env: ${key}`);
  return val ?? "";
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  get supabaseServiceKey() {
    return isServer ? requireEnv("SUPABASE_SERVICE_ROLE_KEY") : "";
  },
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  cronSecret: process.env.CRON_SECRET,
  get integrationCredentialsEncryptionKey() {
    return isServer ? requireEnv("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY") : "";
  },
} as const;
