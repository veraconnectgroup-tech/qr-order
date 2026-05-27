import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      title="Request access"
      description="Set up your venue with Denis"
    >
      <SignupForm />
    </AuthShell>
  );
}
