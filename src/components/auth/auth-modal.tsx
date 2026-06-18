"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, ArrowLeft, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";

type View = "landing" | "signin" | "signup";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

function GoogleUnavailableBanner() {
  return (
    <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2.5 text-xs text-amber-400">
      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>
        Google sign-in isn&apos;t configured yet. Use email below — it works fully.
      </span>
    </div>
  );
}

export function AuthModal({ open, onOpenChange, onSuccess }: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [view, setView] = useState<View>("landing");
  const [loading, setLoading] = useState(false);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({ email: "", password: "", fullName: "" });

  const reset = () => {
    setView("landing");
    setGoogleUnavailable(false);
    setSignInData({ email: "", password: "" });
    setSignUpData({ email: "", password: "", fullName: "" });
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setGoogleUnavailable(false);
    try {
      await signInWithGoogle();
      // OAuth redirects away — loading stays true intentionally
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      const isNotConfigured =
        msg.includes("provider") ||
        msg.includes("not enabled") ||
        msg.includes("unsupported") ||
        msg.includes("disabled");

      if (isNotConfigured) {
        setGoogleUnavailable(true);
      } else {
        toast.error("Google sign-in failed. Try email instead.");
      }
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmail(signInData.email, signInData.password);
      toast.success("Welcome back!");
      handleClose(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUpWithEmail(signUpData.email, signUpData.password, signUpData.fullName);
      toast.success("Account created! Check your email to confirm, then sign in.");
      setView("signin");
      setSignInData({ email: signUpData.email, password: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed. Try a different email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={true}
        className="sm:max-w-[400px] p-0 overflow-hidden rounded-3xl"
      >
        {/* ── Landing ── */}
        {view === "landing" && (
          <div className="p-8 space-y-5">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
                  <Zap className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <DialogTitle className="text-xl font-bold text-white">
                Join the Queue
              </DialogTitle>
              <p className="text-sm text-zinc-400">
                Sign in to claim your spot and get notified when it&apos;s your turn.
              </p>
            </div>

            {googleUnavailable && <GoogleUnavailableBanner />}

            <div className="space-y-3">
              {/* Google */}
              <Button
                className="w-full h-12 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold border-0 gap-3 text-sm"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-zinc-950/80 px-3 text-zinc-500 uppercase tracking-wider">
                    or
                  </span>
                </div>
              </div>

              {/* Email sign in */}
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white gap-3 font-medium text-sm"
                onClick={() => setView("signin")}
                disabled={loading}
              >
                <Mail className="w-4 h-4 text-zinc-400" />
                Sign in with Email
              </Button>

              <button
                className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
                onClick={() => setView("signup")}
              >
                New to CourtQueue?{" "}
                <span className="text-primary font-semibold">Create a free account</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Sign In ── */}
        {view === "signin" && (
          <div className="p-8 space-y-5">
            <div>
              <button
                onClick={() => setView("landing")}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <DialogTitle className="text-xl font-bold text-white">Welcome back</DialogTitle>
              <p className="text-sm text-zinc-400 mt-1">Sign in to your CourtQueue account</p>
            </div>

            {googleUnavailable && <GoogleUnavailableBanner />}

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="si-email" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="si-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signInData.email}
                  onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                  required
                  autoFocus
                  className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="si-pw" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="si-pw"
                  type="password"
                  placeholder="••••••••"
                  value={signInData.password}
                  onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                  required
                  className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              <Button type="submit" className="w-full h-11 rounded-2xl gradient-primary text-primary-foreground font-semibold text-sm" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-zinc-950/80 px-3 text-zinc-600">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-11 rounded-2xl border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white gap-3 text-sm"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <p className="text-center text-sm text-zinc-500">
              Don&apos;t have an account?{" "}
              <button
                className="text-primary font-semibold hover:underline"
                onClick={() => setView("signup")}
              >
                Create one
              </button>
            </p>
          </div>
        )}

        {/* ── Sign Up ── */}
        {view === "signup" && (
          <div className="p-8 space-y-5">
            <div>
              <button
                onClick={() => setView("landing")}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <DialogTitle className="text-xl font-bold text-white">Create your account</DialogTitle>
              <p className="text-sm text-zinc-400 mt-1">Get started with CourtQueue — it&apos;s free</p>
            </div>

            {googleUnavailable && <GoogleUnavailableBanner />}

            <Button
              className="w-full h-11 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 gap-3 font-medium text-sm"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
              Sign up with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-zinc-950/80 px-3 text-zinc-500">or sign up with email</span>
              </div>
            </div>

            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="su-name" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Full Name
                </Label>
                <Input
                  id="su-name"
                  type="text"
                  placeholder="Alex Smith"
                  value={signUpData.fullName}
                  onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                  required
                  autoFocus
                  className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="su-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signUpData.email}
                  onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                  required
                  className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-pw" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="su-pw"
                  type="password"
                  placeholder="At least 6 characters"
                  value={signUpData.password}
                  onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                  required
                  minLength={6}
                  className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              <Button type="submit" className="w-full h-11 rounded-2xl gradient-primary text-primary-foreground font-semibold text-sm" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Account
              </Button>
            </form>

            <p className="text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <button
                className="text-primary font-semibold hover:underline"
                onClick={() => setView("signin")}
              >
                Sign in
              </button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
