"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { isAdminEmail } from "@/lib/admin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings, ChevronDown, QrCode, Printer } from "lucide-react";

function PaddleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="4.5"
        y="2.5"
        width="15"
        height="14"
        rx="7"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <circle cx="9.5" cy="7.5" r="1" fill="hsl(var(--primary-foreground))" />
      <circle cx="14.5" cy="7.5" r="1" fill="hsl(var(--primary-foreground))" />
      <circle cx="12" cy="10.5" r="1" fill="hsl(var(--primary-foreground))" />
      <rect
        x="10.5"
        y="15.5"
        width="3"
        height="6.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.95"
      />
    </svg>
  );
}

export function Navbar() {
  const { user, profile, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = isAdminEmail(user?.email);

  return (
    <nav className="h-16 sticky top-0 z-50 flex items-center px-3 sm:px-5">
      <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <Link
          href="/app"
          className="group flex items-center gap-2.5 rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-xl px-3 py-2 pr-4 transition-all hover:border-white/15 hover:bg-white/[0.06]"
        >
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
            <PaddleLogo className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight gradient-text">
            CourtQueue
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/scan"
            className={`flex items-center gap-2 rounded-2xl border backdrop-blur-xl px-3.5 py-2 text-sm font-medium transition-all ${
              pathname === "/scan"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Scan</span>
          </Link>

          {!loading &&
            (user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-xl pl-1.5 pr-3 py-1.5 transition-all hover:border-white/15 hover:bg-white/[0.06] focus:outline-none">
                  <Avatar className="h-8 w-8 ring-1 ring-white/10">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                      {profile?.full_name?.[0]?.toUpperCase() ??
                        user.email?.[0]?.toUpperCase() ??
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline">
                    Account
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="space-y-1 py-1">
                        <p className="text-sm font-semibold">
                          {profile?.full_name ?? "Player"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="rounded-xl"
                      onClick={() => router.push("/profile")}
                    >
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl"
                      onClick={() => router.push("/profile?tab=settings")}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem
                        className="rounded-xl"
                        onClick={() => router.push("/print/qr-codes")}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print park QR codes
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="rounded-xl"
                      onClick={signOut}
                      variant="destructive"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                className="rounded-2xl h-10 px-5 gradient-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20"
                onClick={() => router.push("/auth")}
              >
                Sign In
              </Button>
            ))}
        </div>
      </div>
    </nav>
  );
}
