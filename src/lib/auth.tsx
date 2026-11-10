import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile, Settings } from "./types";

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  settings: Settings | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setSettings(null);
      return;
    }
    const [{ data: p }, { data: st }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", s.user.id).single(),
      supabase.from("app_settings").select("*").maybeSingle(),
    ]);
    setProfile(p as Profile | null);
    setSettings(st as Settings | null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Évite un appel imbriqué pendant l'événement d'authentification
        setTimeout(() => load(s), 0);
      }
    });
    // Quand l'appli revient au premier plan, on recharge le profil (routine, programme… modifiés par la coach)
    const onVisible = () => {
      if (document.visibilityState === "visible") supabase.auth.getSession().then(({ data }) => data.session && load(data.session));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const value: AuthState = {
    loading,
    session,
    profile,
    settings,
    refresh: () => load(session),
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth hors AuthProvider");
  return v;
}

// Profil garanti (pages protégées)
export function useMe() {
  const { profile, settings, refresh } = useAuth();
  return { me: profile!, settings, refresh };
}
