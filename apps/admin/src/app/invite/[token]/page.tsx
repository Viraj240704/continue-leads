import Link from "next/link";
import { getInviteByToken } from "@/lib/team";
import { ROLE_LABELS } from "@/lib/rbac";
import { AcceptForm } from "./AcceptForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  const valid = invite && invite.status === "pending";

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        {!valid ? (
          <div className="card text-center">
            <h1 className="text-lg font-semibold">Invite not valid</h1>
            <p className="mt-1 text-sm text-dim">This invitation has expired, been revoked, or already used.</p>
            <Link href="/login" className="btn mt-4 inline-flex">Go to sign in</Link>
          </div>
        ) : (
          <div className="card">
            <p className="eyebrow mb-1">Join {invite.org_name}</p>
            <h1 className="text-lg font-semibold">Set up your account</h1>
            <p className="mt-1 text-sm text-dim">
              <span className="mono">{invite.email}</span> · role <b>{(ROLE_LABELS as Record<string,string>)[invite.role] ?? invite.role}</b>
            </p>
            <AcceptForm token={token} />
          </div>
        )}
      </div>
    </div>
  );
}
