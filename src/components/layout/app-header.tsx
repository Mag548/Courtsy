"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { MaterialIcon } from "@/components/ui/material-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type SportFilter = "all" | "tennis" | "pickleball";

interface AppHeaderProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  filter?: SportFilter;
  onFilterChange?: (filter: SportFilter) => void;
  showSearch?: boolean;
  showSportToggle?: boolean;
  /** Extra controls below the mobile search bar (places search, filters, etc.) */
  mobileSearchSlot?: ReactNode;
  /** Inline in page flow (desktop sidebar layout) vs fixed over map */
  variant?: "floating" | "inline";
  /** Slide header off-screen (mobile map view when bottom sheet is expanded) */
  dismissed?: boolean;
  className?: string;
}

export function AppHeader({
  search = "",
  onSearchChange,
  filter = "all",
  onFilterChange,
  showSearch = false,
  showSportToggle = false,
  mobileSearchSlot,
  variant = "floating",
  dismissed = false,
  className,
}: AppHeaderProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const isFloating = variant === "floating";

  const bar = (
    <header
      className={cn(
        "flex items-center justify-between gap-3",
        "rounded-full border border-white/10 bg-surface/80 backdrop-blur-xl",
        "px-4 sm:px-6 py-3 shadow-[0px_40px_40px_-10px_rgba(19,19,19,0.4)]",
        !isFloating && className
      )}
    >
      <Link href="/app" className="flex items-center gap-2.5 shrink-0">
        <MaterialIcon
          name="sports_tennis"
          filled
          className="text-primary-fixed text-xl"
        />
        <h1 className="text-xl font-bold tracking-tighter text-primary-fixed hidden sm:block">
          CourtQueue
        </h1>
      </Link>

      {showSearch && onSearchChange && (
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="w-full relative">
            <MaterialIcon
              name="search"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search parks or courts..."
              className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-container/30 transition-all"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {showSportToggle && onFilterChange && (
          <div className="hidden sm:flex bg-white/5 rounded-full p-1 border border-white/10">
            {(["tennis", "pickleball"] as const).map((sport) => (
              <button
                key={sport}
                type="button"
                onClick={() =>
                  onFilterChange(filter === sport ? "all" : sport)
                }
                className={cn(
                  "px-3 py-1.5 rounded-full label-caps transition-all capitalize",
                  filter === sport
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:text-primary"
                )}
              >
                {sport}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push(user ? "/profile" : "/auth")}
          className="h-10 w-10 rounded-full border border-white/20 bg-surface-container overflow-hidden active:scale-95 transition-transform"
        >
          {user ? (
            <Avatar className="h-full w-full">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-surface-container-high text-primary-fixed text-sm font-semibold">
                {profile?.full_name?.[0]?.toUpperCase() ??
                  user.email?.[0]?.toUpperCase() ??
                  "U"}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <MaterialIcon name="person" className="text-on-surface-variant" />
            </div>
          )}
        </button>
      </div>
    </header>
  );

  const mobileSearch = showSearch && onSearchChange && (
    <div className="md:hidden flex flex-col gap-2">
      <div className="relative">
        <MaterialIcon
          name="search"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search courts…"
          className="w-full h-11 bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-container/30 transition-all"
        />
      </div>
      {mobileSearchSlot}
    </div>
  );

  if (!isFloating) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {bar}
        {mobileSearch}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed top-0 inset-x-0 z-50 px-5 pt-[max(1rem,env(safe-area-inset-top,0px))]",
        "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
        dismissed && "-translate-y-[110%] opacity-0 pointer-events-none",
        className
      )}
    >
      <div className="flex flex-col gap-2 max-w-2xl mx-auto">
        {bar}
        {mobileSearch}
      </div>
    </div>
  );
}
