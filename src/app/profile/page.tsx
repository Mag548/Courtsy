"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AdminCourtClearPanel } from "@/components/admin/admin-court-clear-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MaterialIcon } from "@/components/ui/material-icon";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry } from "@/lib/supabase/types";
import { formatDistanceToNow } from "date-fns";
import { isAdminEmail } from "@/lib/admin";

export default function ProfilePage() {
  const { user, profile, loading, updateProfile, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "settings";

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    preferred_sport: "both" as "tennis" | "pickleball" | "both",
  });
  type HistoryEntry = QueueEntry & { court?: { name: string } | null };
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        preferred_sport:
          (profile.preferred_sport as "tennis" | "pickleball" | "both") ??
          "both",
      });
    }
  }, [profile]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("queue_entries")
      .select("*, queue:queues(court:courts(name))")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(20);

    if (data) {
      setHistory(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data as any[]).map((entry) => ({
          id: entry.id,
          queue_id: entry.queue_id,
          user_id: entry.user_id,
          party_size: entry.party_size,
          sport: entry.sport,
          position: entry.position,
          status: entry.status,
          joined_at: entry.joined_at,
          notified_at: entry.notified_at,
          started_playing_at: entry.started_playing_at,
          invite_code: entry.invite_code ?? null,
          extended_at: entry.extended_at ?? null,
          assigned_court_number: entry.assigned_court_number ?? null,
          court: entry.queue?.court ?? null,
        }))
      );
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = isAdminEmail(user.email);
  const bottomActive =
    activeTab === "history" ? "activity" : ("settings" as const);

  const statusLabel: Record<string, string> = {
    waiting: "WAITING",
    notified: "READY",
    playing: "PLAYING",
    expired: "EXPIRED",
    left: "LEFT",
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-container-padding pt-28 space-y-section-gap slide-up">
        {/* Profile hero */}
        <section className="glass-panel p-6 sm:p-8 rounded-[32px] relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative shrink-0">
              <div className="w-28 h-28 rounded-3xl border-2 border-primary-container p-1 overflow-hidden">
                <Avatar className="w-full h-full rounded-[20px]">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-surface-container-high text-primary-fixed text-2xl">
                    {profile?.full_name?.[0]?.toUpperCase() ??
                      user.email?.[0]?.toUpperCase() ??
                      "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-2xl font-semibold text-primary">
                {profile?.full_name ?? "Player"}
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">{user.email}</p>
              {profile?.preferred_sport && (
                <p className="text-sm text-on-surface-variant mt-2 flex items-center justify-center sm:justify-start gap-2">
                  <MaterialIcon name="sports_score" className="text-primary-fixed" />
                  {profile.preferred_sport === "both"
                    ? "Tennis & Pickleball"
                    : profile.preferred_sport.charAt(0).toUpperCase() +
                      profile.preferred_sport.slice(1)}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Activity */}
        {(activeTab === "history" || activeTab === "profile") && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                <MaterialIcon name="history" className="text-primary-fixed" />
                Recent Activity
              </h3>
            </div>
            {history.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant text-sm">
                No history yet. Join a queue to get started!
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="glass-card p-4 rounded-2xl flex items-center gap-4 hover:bg-surface-bright/20 transition-all"
                  >
                    <div className="w-11 h-11 bg-primary-container/10 rounded-xl flex items-center justify-center text-primary-fixed shrink-0">
                      <MaterialIcon
                        name={
                          entry.sport === "pickleball"
                            ? "sports_volleyball"
                            : "sports_tennis"
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-primary truncate">
                        {entry.court?.name ?? "Unknown Court"}
                      </h4>
                      <p className="text-sm text-on-surface-variant">
                        {entry.joined_at
                          ? formatDistanceToNow(new Date(entry.joined_at), {
                              addSuffix: true,
                            })
                          : ""}
                        {entry.assigned_court_number
                          ? ` · Court ${entry.assigned_court_number}`
                          : ""}
                      </p>
                    </div>
                    <span className="label-caps text-primary-fixed shrink-0">
                      {statusLabel[entry.status] ?? entry.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Settings */}
        {(activeTab === "settings" || activeTab === "profile") && (
          <section className="glass-panel p-6 rounded-3xl space-y-5">
            <h3 className="text-lg font-semibold text-primary">App Preferences</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-on-surface-variant">Full Name</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  placeholder="Your name"
                  className="bg-white/5 border-white/10 rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-on-surface-variant">Primary Sport</Label>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "tennis", label: "Tennis" },
                      { value: "pickleball", label: "Pickleball" },
                      { value: "both", label: "Both" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, preferred_sport: opt.value })
                      }
                      className={`flex-1 py-2.5 rounded-xl label-caps transition-all ${
                        form.preferred_sport === opt.value
                          ? "bg-primary-container text-on-primary-container"
                          : "bg-white/5 text-on-surface-variant border border-white/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-12 rounded-2xl bg-primary-container text-on-primary-container font-semibold hover:brightness-110"
                disabled={saving}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </form>
            <hr className="border-white/5" />
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-3 py-2 text-error hover:opacity-80 transition-opacity"
            >
              <MaterialIcon name="logout" />
              <span className="text-base">Log Out</span>
            </button>
          </section>
        )}

        {isAdmin && activeTab !== "history" && (
          <AdminCourtClearPanel />
        )}
      </main>

      <BottomNav active={bottomActive} />
    </div>
  );
}
