"use client";

import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";

export type BottomNavTab = "courts" | "queue" | "activity" | "settings" | "scan";

interface BottomNavProps {
  active: BottomNavTab;
  onTabChange?: (tab: BottomNavTab) => void;
  queueBadge?: number;
  showFab?: boolean;
}

export function BottomNav({
  active,
  onTabChange,
  queueBadge = 0,
  showFab = true,
}: BottomNavProps) {
  const router = useRouter();

  const tabs: { id: BottomNavTab; icon: string; label: string; badge?: number }[] =
    [
      { id: "courts", icon: "map", label: "Courts" },
      { id: "queue", icon: "hourglass_empty", label: "Queue", badge: queueBadge },
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
      case "activity":
        router.push("/profile?tab=history");
        break;
      case "settings":
        router.push("/profile?tab=settings");
        break;
    }
  };

  return (
    <>
      {showFab && (
        <button
          type="button"
          onClick={() =>
            onTabChange ? onTabChange("scan") : router.push("/scan")
          }
          className="fixed bottom-[5.5rem] right-6 z-40 w-14 h-14 rounded-full bg-primary-container text-on-primary-container shadow-[0px_20px_40px_-10px_rgba(195,244,0,0.5)] flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Scan QR code"
        >
          <MaterialIcon name="qr_code_scanner" filled className="text-[28px]" />
        </button>
      )}

      <nav
        className="fixed bottom-6 left-5 right-5 z-50 h-16 rounded-full bg-surface-container/90 backdrop-blur-2xl border border-white/10 shadow-2xl flex justify-around items-center"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map(({ id, icon, label, badge }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTab(id)}
              className={cn(
                "relative flex flex-col items-center justify-center px-4 py-2 rounded-full active:scale-90 transition-all duration-300",
                isActive
                  ? "text-primary-fixed bg-primary-container/20"
                  : "text-on-surface-variant hover:text-primary-fixed"
              )}
            >
              <MaterialIcon
                name={icon}
                filled={isActive}
                className="text-xl"
              />
              <span className="label-caps mt-0.5 text-[10px]">{label}</span>
              {badge != null && badge > 0 && (
                <span className="absolute -top-0.5 right-1 min-w-4 h-4 px-1 rounded-full bg-error-container text-[9px] font-bold text-on-error-container flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
