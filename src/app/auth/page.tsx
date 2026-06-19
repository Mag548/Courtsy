"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";

type Tab = "signin" | "signup";

const GoogleIcon = () => (
  <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const PaddleLogo = () => (
  <svg viewBox="0 0 36 36" fill="none" className="w-full h-full" aria-hidden="true">
    <ellipse cx="16" cy="14" rx="11" ry="12" fill="url(#auth-paddle)" />
    <ellipse cx="16" cy="14" rx="7" ry="8" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    <rect x="14.5" y="25" width="3" height="9" rx="1.5" fill="hsl(142 50% 28%)" />
    <circle cx="27" cy="8" r="3.5" fill="hsl(90 80% 60%)" opacity="0.9" />
    <defs>
      <linearGradient id="auth-paddle" x1="5" y1="3" x2="27" y2="25" gradientUnits="userSpaceOnUse">
        <stop stopColor="hsl(142 72% 54%)" />
        <stop offset="1" stopColor="hsl(155 80% 36%)" />
      </linearGradient>
    </defs>
  </svg>
);

const fieldClass =
  "h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-primary/20 transition-colors";

const labelClass =
  "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider";

const submitClass =
  "w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold text-sm tracking-tight shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity";

export default function AuthPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [loading, setLoading] = useState(false);
  const [googleErr, setGoogleErr] = useState(false);

  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const switchTab = (next: Tab) => {
    setGoogleErr(false);
    setTab(next);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setGoogleErr(false);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      const unconfigured =
        msg.includes("provider") ||
        msg.includes("not enabled") ||
        msg.includes("unsupported") ||
        msg.includes("disabled");
      if (unconfigured) setGoogleErr(true);
      else toast.error("Google sign-in failed. Try email instead.");
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmail(signInData.email, signInData.password);
      toast.success("Welcome back!");
      router.push("/app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUpWithEmail(
        signUpData.email,
        signUpData.password,
        signUpData.fullName
      );
      toast.success("Account created! Check your email to confirm.");
      switchTab("signin");
      setSignInData({ email: signUpData.email, password: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(142 72% 45% / 0.25), transparent)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="w-full max-w-[420px] relative">
        <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="relative flex flex-col items-center pt-8 pb-5 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center shadow-lg shadow-primary/20 mb-3">
              <div className="w-8 h-8">
                <PaddleLogo />
              </div>
            </div>
            <h1 className="text-xl font-bold tracking-tight gradient-text">
              CourtQueue
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === "signin"
                ? "Welcome back — sign in to continue"
                : "Create your free account"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="px-5 pb-1">
            <div className="relative flex rounded-xl bg-white/[0.04] border border-white/[0.07] p-1">
              <div
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg gradient-primary transition-all duration-200 ease-out shadow-md shadow-primary/25"
                style={{ left: tab === "signin" ? "4px" : "calc(50%)" }}
              />
              <button
                type="button"
                onClick={() => switchTab("signin")}
                className={`relative flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-150 ${
                  tab === "signin"
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchTab("signup")}
                className={`relative flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-150 ${
                  tab === "signup"
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 pb-6 pt-4 space-y-4">
            {googleErr && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Google sign-in isn&apos;t configured yet. Use email below — it
                  works fully.
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-11 inline-flex items-center justify-center gap-3 rounded-xl bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-900 font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.07]" />
              <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">
                or
              </span>
              <div className="flex-1 h-px bg-white/[0.07]" />
            </div>

            {tab === "signin" ? (
              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email" className={labelClass}>
                    Email
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signInData.email}
                    onChange={(e) =>
                      setSignInData({ ...signInData, email: e.target.value })
                    }
                    required
                    autoFocus
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password" className={labelClass}>
                    Password
                  </Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={signInData.password}
                    onChange={(e) =>
                      setSignInData({
                        ...signInData,
                        password: e.target.value,
                      })
                    }
                    required
                    className={fieldClass}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className={submitClass}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign In
                </Button>
              </form>
            ) : (
              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name" className={labelClass}>
                    Full Name
                  </Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Alex Smith"
                    value={signUpData.fullName}
                    onChange={(e) =>
                      setSignUpData({
                        ...signUpData,
                        fullName: e.target.value,
                      })
                    }
                    required
                    autoFocus
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className={labelClass}>
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signUpData.email}
                    onChange={(e) =>
                      setSignUpData({ ...signUpData, email: e.target.value })
                    }
                    required
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className={labelClass}>
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={signUpData.password}
                    onChange={(e) =>
                      setSignUpData({
                        ...signUpData,
                        password: e.target.value,
                      })
                    }
                    required
                    minLength={6}
                    className={fieldClass}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className={submitClass}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Account
                </Button>
              </form>
            )}

            <p className="text-center text-xs text-muted-foreground pt-1">
              {tab === "signin" ? (
                <>
                  New to CourtQueue?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("signup")}
                    className="text-primary font-semibold hover:text-primary/80 transition-colors"
                  >
                    Create a free account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("signin")}
                    className="text-primary font-semibold hover:text-primary/80 transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/app" className="hover:text-foreground transition-colors">
            Continue without signing in →
          </Link>
        </p>
      </div>
    </div>
  );
}
