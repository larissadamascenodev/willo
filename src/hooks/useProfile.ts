import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  has_completed_profile: boolean;
  has_account: boolean;
  has_transactions: boolean;
  has_card: boolean;
  has_fixed_expenses: boolean;
  initial_score: number | null;
  initial_score_label: string | null;
}

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(() => authLoading);

  const fetchProfile = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!user) { setProfile(null); setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("profiles" as any)
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code === "PGRST116") {
        const { data: newProfile } = await supabase
          .from("profiles" as any)
          .insert({ id: user.id } as any)
          .select()
          .single();
        setProfile(newProfile as unknown as Profile);
      } else if (data) {
        setProfile(data as unknown as Profile);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateDisplayName = useCallback(async (name: string) => {
    if (!user) return;
    await supabase
      .from("profiles" as any)
      .update({ display_name: name, has_completed_profile: true } as any)
      .eq("id", user.id);
    await fetchProfile();
  }, [user, fetchProfile]);

  const updateBio = useCallback(async (bio: string) => {
    if (!user) return;
    await supabase
      .from("profiles" as any)
      .update({ bio } as any)
      .eq("id", user.id);
    await fetchProfile();
  }, [user, fetchProfile]);

  const uploadAvatar = useCallback(async (file: File) => {
    if (!user) return;
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // Add cache buster
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Update profile
    await supabase
      .from("profiles" as any)
      .update({ avatar_url: avatarUrl } as any)
      .eq("id", user.id);

    await fetchProfile();
  }, [user, fetchProfile]);

  const isOnboardingComplete = profile
    ? profile.has_completed_profile && profile.has_account && profile.has_transactions
    : false;

  return { profile, loading, refetch: fetchProfile, updateDisplayName, updateBio, uploadAvatar, isOnboardingComplete };
}
