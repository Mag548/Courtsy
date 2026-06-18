"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin, Bell, Timer, ChevronDown } from "lucide-react";

/* ── Pickleball SVG ──────────────────────────────────────────────────────── */
function PickleballSVG({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="pb-body" cx="38%" cy="30%" r="65%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#e8ff5a" />
          <stop offset="45%"  stopColor="#a8d910" />
          <stop offset="100%" stopColor="#5a8400" />
        </radialGradient>
        <radialGradient id="pb-shine" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="white" stopOpacity="0.45" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <filter id="pb-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7acc00" floodOpacity="0.8" />
        </filter>
      </defs>
      {/* Main ball */}
      <circle cx="30" cy="30" r="28" fill="url(#pb-body)" filter="url(#pb-shadow)" />
      {/* Seam lines */}
      <path d="M 5 28 Q 30 16 55 28" stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" fill="none" />
      <path d="M 5 32 Q 30 44 55 32" stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" fill="none" />
      {/* Holes — scattered in realistic pickleball pattern */}
      {[
        [16,14],[28,10],[40,14],[12,24],[24,20],[36,20],[48,24],
        [10,32],[20,29],[30,30],[40,29],[50,32],
        [14,40],[26,42],[38,42],[46,38],
        [20,48],[32,50],[42,46],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.5" fill="rgba(0,0,0,0.30)" />
      ))}
      {/* Specular highlight */}
      <ellipse cx="21" cy="17" rx="9" ry="6" fill="url(#pb-shine)" />
    </svg>
  );
}

/* ── Paddle SVG ──────────────────────────────────────────────────────────── */
function PaddleSVG({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pd-face" x1="6" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(142 72% 55%)" />
          <stop offset="1" stopColor="hsl(158 84% 38%)" />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="22" rx="16" ry="18" fill="url(#pd-face)" />
      <ellipse cx="24" cy="22" rx="10" ry="12" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="13" y1="13" x2="35" y2="31" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <line x1="13" y1="31" x2="35" y2="13" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <rect x="22" y="39" width="5" height="16" rx="2.5" fill="hsl(142 50% 28%)" />
    </svg>
  );
}

/* ── Logo paddle (small) ─────────────────────────────────────────────────── */
function LogoPaddleIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="18" cy="16" rx="12" ry="13" fill="url(#logo-grad)" opacity="0.95" />
      <ellipse cx="18" cy="16" rx="8.5" ry="9.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="10" y1="10" x2="26" y2="22" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <line x1="10" y1="22" x2="26" y2="10" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <rect x="16" y="28" width="4" height="10" rx="2" fill="url(#logo-handle)" />
      <circle cx="31" cy="10" r="4" fill="hsl(142 72% 65%)" opacity="0.9" />
      <defs>
        <linearGradient id="logo-grad" x1="6" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(142 72% 52%)" />
          <stop offset="1" stopColor="hsl(158 84% 40%)" />
        </linearGradient>
        <linearGradient id="logo-handle" x1="16" y1="28" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(142 72% 40%)" />
          <stop offset="1" stopColor="hsl(142 50% 25%)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Transition overlay ──────────────────────────────────────────────────── */
function EnterTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="overlay-darken fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Paddle — swings in from bottom-left and "hits" */}
      <div
        className="paddle-swing absolute"
        style={{ top: "50%", left: "50%", marginTop: "-50px", marginLeft: "-50px" }}
      >
        <PaddleSVG size={100} />
      </div>

      {/* Motion trail streaks */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: `calc(50% - ${(i - 1) * 12}px)`,
            left: "50%",
            width: `${80 - i * 15}px`,
            height: "3px",
            borderRadius: "99px",
            background: `linear-gradient(90deg, hsl(142 72% 55% / ${0.5 - i * 0.15}), transparent)`,
            animation: `trail-streak ${0.6 + i * 0.08}s ease-out ${0.18 + i * 0.04}s both`,
            transformOrigin: "left center",
          }}
        />
      ))}

      {/* Ball — flies across in an arc */}
      <div
        className="pickleball-fly absolute"
        style={{
          top: "50%",
          left: "50%",
          marginTop: "-36px",
          marginLeft: "-36px",
        }}
      >
        {/* Glow halo around ball */}
        <div
          style={{
            position: "absolute",
            inset: "-16px",
            borderRadius: "50%",
            background: "radial-gradient(circle, hsl(90 80% 55% / 0.55) 0%, transparent 70%)",
            filter: "blur(8px)",
            pointerEvents: "none",
          }}
        />
        <PickleballSVG size={72} />
      </div>
    </div>
  );
}

/* ── Feature cards data ──────────────────────────────────────────────────── */
const features = [
  { icon: MapPin, label: "Find Courts",    desc: "Discover nearby tennis & pickleball courts on a live map",       delay: "0.55s", float: "float-slow" },
  { icon: Timer,  label: "Join the Queue", desc: "Claim your spot and track your place in real time",              delay: "0.65s", float: "float-mid"  },
  { icon: Bell,   label: "Get Notified",   desc: "Receive instant alerts the moment a court opens up",             delay: "0.75s", float: "float-fast" },
];

/* ── Landing page ────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router   = useRouter();
  const [ready,    setReady]    = useState(false);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleEnter = useCallback(() => {
    if (entering) return;
    setEntering(true);
  }, [entering]);

  const handleTransitionDone = useCallback(() => {
    router.push("/app");
  }, [router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040404] flex flex-col items-center justify-center px-5">

      {/* Animated background orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb-1 absolute w-[600px] h-[600px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, hsl(142 72% 45% / 0.7) 0%, transparent 70%)", top: "-15%", left: "-10%", filter: "blur(60px)" }} />
        <div className="orb-2 absolute w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(199 89% 55% / 0.8) 0%, transparent 70%)", bottom: "0%", right: "-5%", filter: "blur(70px)" }} />
        <div className="orb-3 absolute w-[350px] h-[350px] rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, hsl(262 83% 58% / 0.6) 0%, transparent 70%)", top: "40%", right: "15%", filter: "blur(55px)" }} />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl w-full">

        {/* Location pill */}
        <div className="badge-pop mb-8" style={{ animationDelay: "0.1s", opacity: ready ? undefined : 0 }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] backdrop-blur-md px-4 py-2 text-xs font-medium text-white/70 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live in Oakville · Burlington · Halton Hills
          </div>
        </div>

        {/* Logo */}
        <div className="hero-in flex flex-col items-center mb-6" style={{ animationDelay: "0.2s", opacity: ready ? undefined : 0 }}>
          <div className="w-20 h-20 mb-5 drop-shadow-[0_0_30px_hsl(142_72%_45%_/_0.5)]">
            <LogoPaddleIcon />
          </div>
          <span className="text-sm font-semibold tracking-[0.25em] uppercase text-white/40">
            CourtQueue
          </span>
        </div>

        {/* Headline */}
        <h1 className="hero-in text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6"
          style={{ animationDelay: "0.3s", opacity: ready ? undefined : 0 }}>
          <span className="shimmer-text">Skip the Wait.</span>
          <br />
          <span className="text-white">Own the Court.</span>
        </h1>

        {/* Subtitle */}
        <p className="hero-in text-base sm:text-lg text-white/50 leading-relaxed max-w-md mb-10"
          style={{ animationDelay: "0.42s", opacity: ready ? undefined : 0 }}>
          Find tennis &amp; pickleball courts near you, join the live queue,
          and get notified the moment your spot opens up.
        </p>

        {/* CTA */}
        <div className="hero-in mb-14" style={{ animationDelay: "0.5s", opacity: ready ? undefined : 0 }}>
          <button
            onClick={handleEnter}
            disabled={entering}
            className={`cta-glow inline-flex items-center gap-3 px-8 py-4 rounded-2xl gradient-primary text-[hsl(0_0%_4%)] font-bold text-base sm:text-lg tracking-tight transition-all duration-200 ${
              entering
                ? "scale-95 opacity-70 cursor-not-allowed"
                : "hover:scale-[1.04] active:scale-[0.97]"
            }`}
          >
            {entering ? (
              <>
                <PickleballSVG size={22} />
                Launching…
              </>
            ) : (
              <>
                Enter the App
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Feature cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
          {features.map(({ icon: Icon, label, desc, delay, float: f }) => (
            <div key={label}
              className={`hero-in ${f} rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm p-5 text-left`}
              style={{ animationDelay: delay, opacity: ready ? undefined : 0 }}>
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center mb-3 shadow-md shadow-primary/20">
                <Icon className="w-4 h-4 text-[hsl(0_0%_4%)]" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">{label}</p>
              <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/20">
        <ChevronDown className="w-4 h-4 animate-bounce" />
      </div>

      {/* Transition overlay — rendered when entering */}
      {entering && <EnterTransition onDone={handleTransitionDone} />}
    </div>
  );
}
