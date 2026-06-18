"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Navbar } from "@/components/layout/navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, User, History, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry } from "@/lib/supabase/types";
import { formatDistanceToNow } from "date-fns";

export default function ProfilePage() {
  const { user, profile, loading, updateProfile, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "profile";

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    preferred_sport: "both" as "tennis" | "pickleball" | "both",
  });
  type HistoryEntry = QueueEntry & { court?: { name: string } | null };
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        preferred_sport: (profile.preferred_sport as "tennis" | "pickleball" | "both") ?? "both",
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHistory((data as any[]).map((entry) => ({
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
        court: entry.queue?.court ?? null,
      })));
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const statusColors = {
    waiting: "bg-yellow-500/20 text-yellow-400",
    notified: "bg-blue-500/20 text-blue-400",
    playing: "bg-green-500/20 text-green-400",
    expired: "bg-red-500/20 text-red-400",
    left: "bg-muted text-muted-foreground",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto p-4 pt-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xl">
              {profile?.full_name?.[0]?.toUpperCase() ??
                user.email?.[0]?.toUpperCase() ??
                "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">
              {profile?.full_name ?? "Player"}
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {profile?.preferred_sport && (
              <Badge variant="outline" className="mt-1 text-xs">
                {profile.preferred_sport === "both"
                  ? "🎾🏓 Tennis & Pickleball"
                  : profile.preferred_sport === "tennis"
                  ? "🎾 Tennis"
                  : "🏓 Pickleball"}
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="profile" className="flex-1">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) =>
                        setForm({ ...form, full_name: e.target.value })
                      }
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preferred Sport</Label>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: "tennis", label: "🎾 Tennis" },
                          { value: "pickleball", label: "🏓 Pickleball" },
                          { value: "both", label: "Both" },
                        ] as const
                      ).map((opt) => (
                        <Button
                          key={opt.value}
                          type="button"
                          variant={
                            form.preferred_sport === opt.value
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            setForm({ ...form, preferred_sport: opt.value })
                          }
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Queue History</CardTitle>
                <CardDescription>Your recent court activity</CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No history yet. Join a queue to get started!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {entry.court?.name ?? "Unknown Court"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {entry.party_size > 1
                              ? `${entry.party_size} players · `
                              : ""}
                            {entry.sport} ·{" "}
                            {entry.joined_at ? formatDistanceToNow(new Date(entry.joined_at), {
                              addSuffix: true,
                            }) : ""}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            statusColors[entry.status as keyof typeof statusColors] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Verified
                  </Badge>
                </div>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={signOut}
                >
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
