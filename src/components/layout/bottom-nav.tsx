"use client";

import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";

export type BottomNavTab = "courts" | "queue" | "activity" | "settings" | "scan";

interface BottomNavProps {
  active: BottomNavTab;
  onTabChange?: (tab: BottomNavTab) => void;
  queueBadge?: number;
}

export function BottomNav({
  active,
  onTabChange,
  queueBadge = 0,
}: BottomNavProps) {
  const router = useRouter();

  const tabs: { id: BottomNavTab; icon: string; label: string; badge?: number }[] =
    [
      { id: "courts", icon: "map", label: "Courts" },
      { id: "queue", icon: "hourglass_empty", label: "Queue", badge: queueBadge },
      { id: "scan", icon: "qr_code_scanner", label: "Scan" },
      { id: "activity", icon: "history", label: "Activity" },
      { id: "settings", icon: "person", label: "Settings" },
    ];

  const handleTab = (tab: BottomNavTab) => {
    if (onTabChange) {
      onTabChange(tab);
      return;
    }
    switch (tab) {
      case "courts":
        router.push("/app");
        break;
      case "queue":
        router.push("/app?tab=queue");
        break;
      case "scan":
        router.push("/scan");
        break;
      case "activity":
        router.push("/profile?tab=history");
        break;
      case "settings":
        router.push("/profile?tab=settings");
        break;
    }
  };

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 bg-background"
      style={{ height: "var(--mobile-nav-h)" }}
    >
      <nav
        className="absolute left-5 right-5 h-16 rounded-full bg-surface-container backdrop-blur-2xl border border-white/10 shadow-2xl flex justify-around items-center"
        style={{
          bottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        {tabs.map(({ id, icon, label, badge }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTab(id)}
              className={cn(
                "relative flex flex-col items-center justify-center px-2 py-2 rounded-full active:scale-90 transition-all duration-300 min-w-0 flex-1",
                isActive
                  ? "text-primary-fixed bg-primary-container/20"
                  : "text-on-surface-variant hover:text-primary-fixed"
              )}
            >
              <MaterialIcon
                name={icon}
                filled={isActive}
                className="text-xl shrink-0"
              />
              <span className="label-caps mt-0.5 text-[9px] truncate max-w-full">
                {label}
              </span>
              {badge != null && badge > 0 && (
                <span className="absolute -top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-error-container text-[9px] font-bold text-on-error-container flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
