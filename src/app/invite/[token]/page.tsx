import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getStaffInvite } from "@/lib/dashboard/staff-actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getStaffInvite(token);

  if (!invite) {
    return (
      <AuthShell title="Invite expired" description="This link is invalid or has already been used.">
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${invite.orgName}`}
      description={`${invite.name} · ${invite.email} · ${invite.role}`}
    >
      <AcceptInviteForm token={token} />
    </AuthShell>
  );
}
