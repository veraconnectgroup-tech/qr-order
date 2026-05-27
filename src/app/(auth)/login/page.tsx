import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Authentication failed. Please try again.",
  config:
    "Server configuration is incomplete. Contact support or check environment variables.",
  no_access:
    "Your account is signed in but has no staff access. Contact your administrator or sign up a new venue.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const urlError = params.error
    ? ERROR_MESSAGES[params.error] ?? "Sign in failed."
    : null;

  return (
    <AuthShell
      title="Sign in"
      description="Access your venue dashboard"
      error={urlError}
    >
      <LoginForm />
    </AuthShell>
  );
}
