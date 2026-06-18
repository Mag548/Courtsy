"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";

type Tab = "signin" | "signup";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const GoogleIcon = () => (
  <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const PaddleLogo = () => (
  <svg viewBox="0 0 36 36" fill="none" className="w-full h-full">
    <ellipse cx="16" cy="14" rx="11" ry="12" fill="url(#am-paddle)" />
    <ellipse cx="16" cy="14" rx="7"  ry="8"  fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    <line x1="9" y1="8"  x2="23" y2="20" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
    <line x1="9" y1="20" x2="23" y2="8"  stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
    <rect x="14.5" y="25" width="3" height="9" rx="1.5" fill="hsl(142 50% 28%)" />
    <circle cx="27" cy="8" r="3.5" fill="hsl(90 80% 60%)" opacity="0.9" />
    <defs>
      <linearGradient id="am-paddle" x1="5" y1="3" x2="27" y2="25" gradientUnits="userSpaceOnUse">
        <stop stopColor="hsl(142 72% 54%)" />
        <stop offset="1" stopColor="hsl(155 80% 36%)" />
      </linearGradient>
    </defs>
  </svg>
);

export function AuthModal({ open, onOpenChange, onSuccess }: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [tab,       setTab]       = useState<Tab>("signin");
  const [loading,   setLoading]   = useState(false);
  const [googleErr, setGoogleErr] = useState(false);
  const [siData,    setSiData]    = useState({ email: "", password: "" });
  const [suData,    setSuData]    = useState({ email: "", password: "", fullName: "" });

  const reset = () => {
    setTab("signin");
    setGoogleErr(false);
    setSiData({ email: "", password: "" });
    setSuData({ email: "", password: "", fullName: "" });
  };

  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const switchTab = (t: Tab) => { setGoogleErr(false); setTab(t); };

  const handleGoogle = async () => {
    setLoading(true);
    setGoogleErr(false);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      const unconfigured = msg.includes("provider") || msg.includes("not enabled") || msg.includes("unsupported") || msg.includes("disabled");
      if (unconfigured) setGoogleErr(true);
      else toast.error("Google sign-in failed. Try email instead.");
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmail(siData.email, siData.password);
      toast.success("Welcome back!");
      handleClose(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid email or password.");
    } finally { setLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUpWithEmail(suData.email, suData.password, suData.fullName);
      toast.success("Account created! Check your email to confirm.");
      switchTab("signin");
      setSiData({ email: suData.email, password: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed. Try a different email.");
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={true}
        className="sm:max-w-[420px] p-0 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0a0a0a] shadow-2xl"
      >
        {/* ── Branded header ── */}
        <div className="relative flex flex-col items-center pt-8 pb-6 px-6 overflow-hidden">
          {/* background glow */}
          <div className="pointer-events-none absolute inset-0 opacity-40"
            style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(142 72% 45% / 0.35), transparent)" }} />
          {/* subtle grid */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(hsl(0 0% 100%) 1px,transparent 1px),linear-gradient(90deg,hsl(0 0% 100%) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

          <div className="relative w-12 h-12 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center shadow-lg shadow-primary/20 mb-3">
            <div className="w-8 h-8"><PaddleLogo /></div>
          </div>
          <DialogTitle className="relative text-lg font-bold tracking-tight text-white mb-0.5">
            CourtQueue
          </DialogTitle>
          <p className="relative text-xs text-white/40 font-medium">
            {tab === "signin" ? "Welcome back — sign in to continue" : "Create your free account"}
          </p>
        </div>

        {/* ── Tab switcher ── */}
        <div className="px-5 pb-1">
          <div className="relative flex rounded-xl bg-white/[0.04] border border-white/[0.07] p-1">
            {/* sliding pill */}
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg gradient-primary transition-all duration-200 ease-out shadow-md shadow-primary/25"
              style={{ left: tab === "signin" ? "4px" : "calc(50%)" }}
            />
            <button
              onClick={() => switchTab("signin")}
              className={`relative flex-1 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 ${
                tab === "signin" ? "text-[hsl(0_0%_4%)]" : "text-white/50 hover:text-white/80"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchTab("signup")}
              className={`relative flex-1 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 ${
                tab === "signup" ? "text-[hsl(0_0%_4%)]" : "text-white/50 hover:text-white/80"
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 pb-6 pt-4 space-y-4">

          {/* Google error banner */}
          {googleErr && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Google sign-in isn&apos;t configured yet. Use email below — it works fully.</span>
            </div>
          )}

          {/* Google CTA */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-3 rounded-xl bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-900 font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
              : <GoogleIcon />
            }
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          {/* Sign In form */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="si-email" className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="si-email"
                  type="email"
                  placeholder="you@example.com"
                  value={siData.email}
                  onChange={(e) => setSiData({ ...siData, email: e.target.value })}
                  required
                  autoFocus
                  className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="si-pw" className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="si-pw"
                  type="password"
                  placeholder="••••••••"
                  value={siData.password}
                  onChange={(e) => setSiData({ ...siData, password: e.target.value })}
                  required
                  className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20 transition-colors"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl gradient-primary text-[hsl(0_0%_4%)] font-bold text-sm tracking-tight shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>
          )}

          {/* Sign Up form */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="su-name" className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                  Full Name
                </Label>
                <Input
                  id="su-name"
                  type="text"
                  placeholder="Alex Smith"
                  value={suData.fullName}
                  onChange={(e) => setSuData({ ...suData, fullName: e.target.value })}
                  required
                  autoFocus
                  className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="su-email" className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="su-email"
                  type="email"
                  placeholder="you@example.com"
                  value={suData.email}
                  onChange={(e) => setSuData({ ...suData, email: e.target.value })}
                  required
                  className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="su-pw" className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="su-pw"
                  type="password"
                  placeholder="At least 6 characters"
                  value={suData.password}
                  onChange={(e) => setSuData({ ...suData, password: e.target.value })}
                  required
                  minLength={6}
                  className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20 transition-colors"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl gradient-primary text-[hsl(0_0%_4%)] font-bold text-sm tracking-tight shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Account
              </Button>
            </form>
          )}

          {/* Footer toggle */}
          <p className="text-center text-xs text-white/35 pt-1">
            {tab === "signin" ? (
              <>
                New to CourtQueue?{" "}
                <button onClick={() => switchTab("signup")} className="text-primary font-semibold hover:text-primary/80 transition-colors">
                  Create a free account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => switchTab("signin")} className="text-primary font-semibold hover:text-primary/80 transition-colors">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
