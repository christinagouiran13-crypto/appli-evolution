import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
});

export async function callFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Message d'erreur lisible renvoyé par la fonction
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const j = await ctx.json().catch(() => null);
      if (j?.error) throw new Error(j.error);
    }
    throw error;
  }
  return data as T;
}

// Donne au temps réel le jeton de la personne connectée avant de s'abonner
// (sinon les règles de sécurité peuvent bloquer les mises à jour en direct)
export async function ensureRealtimeAuth() {
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.realtime.setAuth(data.session.access_token);
}
