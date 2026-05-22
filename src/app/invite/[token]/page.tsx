import Link from "next/link";
import { notFound } from "next/navigation";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
        <h1 className="text-xl font-semibold text-zinc-100">Invite expired</h1>
        <p className="mt-2 text-sm text-zinc-500">
          This link is invalid or has already been used.
        </p>
        <Link
          href="/login"
          className="mt-6 text-sm text-orange-400 hover:underline"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12">
      <AcceptInviteForm token={token} {...invite} />
    </div>
  );
}
