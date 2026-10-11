import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, LockKeyhole, Save, UserRound } from "lucide-react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setName(user?.displayName || "");
    setImage(user?.profileImageUrl || "");
  }, [user?.id, user?.displayName, user?.profileImageUrl]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const cleanedImage = image.trim();
      if (cleanedImage) {
        const url = new URL(cleanedImage);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("Avatar URL must use HTTP or HTTPS.");
        }
      }
      const result = await authClient.updateUser({ name: name.trim(), image: cleanedImage || null });
      if (result.error) throw new Error(result.error.message || "Could not save profile.");
      await authClient.getSession();
      setMessage("Profile updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) return <main className="profile-page"><div className="profile-skeleton" /></main>;
  if (!user) return <Navigate to="/login" />;
  if (!authEnabled) return <Navigate to="/" />;

  const label = user.displayName || user.primaryEmail || "MVM user";
  return (
    <main className="profile-page">
      <div className="profile-wrap">
        <div className="profile-topbar">
          <Link to="/" className="auth-brand"><img src="/design/logo/mvm-logo.svg" alt="" /><span>MVM BROWSER</span></Link>
          <Link to="/" className="mvm-secondary-button"><ArrowLeft size={14} /> Back to browser</Link>
        </div>
        <section className="profile-card">
          <div className="profile-heading">
            <div className="profile-avatar">{user.profileImageUrl ? <img src={user.profileImageUrl} alt="" referrerPolicy="no-referrer" /> : <UserRound size={27} />}</div>
            <div><p className="mvm-eyebrow">ACCOUNT / PROFILE</p><h1>{label}</h1><p>{user.primaryEmail || "Email address unavailable"}</p></div>
          </div>
          <form className="profile-form" onSubmit={saveProfile}>
            <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" /></label>
            <label>Avatar image URL<input type="url" value={image} onChange={(event) => setImage(event.target.value)} placeholder="https://example.com/avatar.png" /></label>
            <button className="auth-submit" type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : <><Save size={15} /> Save profile</>}</button>
          </form>
          {message && <p className="auth-success" role="status"><CheckCircle2 size={14} /> {message}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="profile-note"><LockKeyhole size={16} /><span>This profile updates your account identity only. Browsing history, bookmarks, passwords and settings remain local; cross-device sync will be a separate feature.</span></div>
          <div className="profile-signout"><UserButton /></div>
        </section>
      </div>
    </main>
  );
}
