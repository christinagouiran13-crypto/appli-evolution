import { supabase } from "./supabase";

type BadgeNav = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

// Met à jour la pastille de l'icône avec le nombre de messages non lus
export async function refreshAppBadge() {
  const nav = navigator as BadgeNav;
  if (!nav.setAppBadge) return;
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) { await nav.clearAppBadge?.().catch(() => undefined); return; }
  const { data } = await supabase.rpc("unread_count", { uid });
  const n = typeof data === "number" ? data : 0;
  try {
    if (n > 0) await nav.setAppBadge(n);
    else await nav.clearAppBadge?.();
  } catch { /* pas pris en charge */ }
}
