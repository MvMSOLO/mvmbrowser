import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = mode === "sign-up"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: "/profile" })
        : await authClient.signIn.email({ email: email.trim(), password, callbackURL: "/profile" });
      if (result.error) throw new Error(result.error.message || "Authentication failed.");
      await authClient.getSession();
      await navigate({ to: "/profile" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) return <main className="auth-page"><div className="profile-skeleton" /></main>;
  if (user) return <Navigate to="/profile" />;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="auth-brand"><img src="/design/logo/mvm-logo.svg" alt="" /><span>MVM BROWSER</span></Link>
        <p className="mvm-eyebrow">YOUR BROWSER IDENTITY</p>
        <h1>{mode === "sign-up" ? "Create your account." : "Welcome back."}</h1>
        <p className="auth-subtitle">Sign in to your MVM Browser account. Browsing history and bookmarks remain on this device; cross-device sync is not enabled yet.</p>
        {!authEnabled ? (
          <p className="auth-error">Authentication is disabled in this environment.</p>
        ) : (
          <>
            <div className="auth-provider-list">
              {GROK_PROVIDERS.map((provider) => (
                <button key={provider.providerId} className="auth-provider-button" type="button" disabled={busy} onClick={() => {
                  setBusy(true);
                  setError("");
                  void signIn(provider.providerId, { callbackURL: "/profile", errorCallbackURL: "/login" }).catch((caught) => {
                    setError(caught instanceof Error ? caught.message : "Sign-in did not complete.");
                    setBusy(false);
                  });
                }}>
                  <UserRound size={16} /> Continue with {provider.label}
                  {busy ? <LoaderCircle size={14} /> : <ArrowRight size={14} />}
                </button>
              ))}
            </div>
            <div className="auth-divider"><span>OR USE EMAIL</span></div>
            <form className="auth-form" onSubmit={submit}>
              {mode === "sign-up" && <label className="auth-field">DISPLAY NAME<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={80} placeholder="Your name" /></label>}
              <label className="auth-field"><span><Mail size={13} /> EMAIL ADDRESS</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
              <label className="auth-field"><span><LockKeyhole size={13} /> PASSWORD</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={8} maxLength={128} placeholder="At least 8 characters" /></label>
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? <LoaderCircle size={15} /> : mode === "sign-up" ? <CheckCircle2 size={15} /> : <ArrowRight size={15} />}
                {busy ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}
              </button>
            </form>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <p className="auth-switch">
              {mode === "sign-up" ? "Already have an account? " : "New to MVM Browser? "}
              <button type="button" onClick={() => { setMode(mode === "sign-up" ? "sign-in" : "sign-up"); setError(""); }}>
                {mode === "sign-up" ? "Sign in" : "Create account"}
              </button>
            </p>
          </>
        )}
        <Link to="/" className="auth-back"><ArrowLeft size={14} /> Back to browser</Link>
      </section>
    </main>
  );
}
