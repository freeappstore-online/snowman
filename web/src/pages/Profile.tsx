import { useState } from "react";
import { Nav } from "../components/Nav";
import { useAuth } from "../hooks/useAuth";
import { deleteAccount } from "../lib/api";

export function Profile() {
  const { user, loading, hasGitHubModels, signIn, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
    if (!confirm("This will permanently remove all your data. Last chance — continue?")) return;
    setDeleting(true);
    await deleteAccount();
    window.location.href = "/";
  }

  if (loading) {
    return (<><Nav /><div className="container py-16 text-center text-[var(--muted)]">Loading...</div></>);
  }

  if (!user) {
    return (
      <><Nav /><div className="container py-16 text-center">
        <p className="mb-4 text-[var(--muted)]">Sign in to view your profile.</p>
        <button
          onClick={signIn}
          className="px-5 py-2 rounded-xl text-sm font-semibold border border-[var(--line)] bg-transparent text-[var(--ink)] cursor-pointer"
        >
          Sign in with GitHub
        </button>
      </div></>
    );
  }

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Unknown";

  return (
    <>
      <Nav />
      <div className="container py-12 max-w-[600px]">
        {/* Avatar + name card */}
        <div className="flex items-center gap-6 p-8 rounded-2xl border border-[var(--line)] bg-[var(--panel)] mb-8">
          {user.photo_url && (
            <img
              src={user.photo_url}
              alt={user.name}
              className="w-[72px] h-[72px] rounded-full border-2 border-[var(--line)] shrink-0"
            />
          )}
          <div>
            <h2 className="text-xl font-bold mb-0.5">{user.name}</h2>
            <p className="text-sm text-[var(--muted)]">{user.email}</p>
          </div>
        </div>

        {/* Account details */}
        <div className="mb-8">
          <h3 className="text-base font-bold mb-3 pb-2 border-b border-[var(--line)]">Account Details</h3>
          <DetailRow label="Provider" value="GitHub" />
          <DetailRow label="Member since" value={memberSince} />
          <DetailRow
            label="GitHub Models"
            value={hasGitHubModels ? "Connected" : "Not connected"}
            valueClassName={hasGitHubModels ? "text-[var(--success)]" : "text-[var(--muted)]"}
          />
        </div>

        {/* Session */}
        <div className="mb-8">
          <h3 className="text-base font-bold mb-3 pb-2 border-b border-[var(--line)]">Session</h3>
          <button
            onClick={signOut}
            className="px-5 py-2 rounded-xl text-sm font-semibold border border-[var(--line)] bg-transparent text-[var(--ink)] cursor-pointer"
          >
            Sign out
          </button>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border p-6 bg-[color-mix(in_srgb,var(--error)_6%,var(--panel))] border-[color-mix(in_srgb,var(--error)_25%,var(--line))]">
          <h3 className="text-base font-bold mb-1 text-[var(--error)]">Danger Zone</h3>
          <p className="text-sm mb-4 text-[var(--muted)]">
            Permanently delete your account, session, and all stored data. This cannot be undone.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--error)] border-0 cursor-pointer"
            style={{ opacity: deleting ? 0.6 : 1, cursor: deleting ? 'not-allowed' : 'pointer' }}
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-[var(--line)] text-sm">
      <span className="font-medium text-[var(--muted)]">{label}</span>
      <span className={`font-semibold ${valueClassName ?? ''}`}>{value}</span>
    </div>
  );
}
