// Actions réservées à la coach :
// - invite : crée le compte d'une nouvelle cliente et renvoie son lien d'invitation
// - link   : renvoie un nouveau lien de connexion (mot de passe oublié)
// - delete : supprime définitivement une cliente et toutes ses données (RGPD)
import { adminClient, cors, json } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = adminClient();

  // Qui appelle ? Seule la coach est autorisée.
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData } = await db.auth.getUser(token);
  const caller = userData?.user;
  if (!caller) return json({ error: "Connexion requise." }, 401);
  const { data: me } = await db.from("profiles").select("role").eq("id", caller.id).single();
  if (me?.role !== "coach") return json({ error: "Réservé à la coach." }, 403);

  const body = await req.json().catch(() => ({}));
  const { data: settings } = await db.from("app_settings").select("app_url").single();
  const appUrl = (settings?.app_url ?? "").replace(/\/$/, "");
  const redirectTo = `${appUrl}/bienvenue`;

  if (body.action === "invite") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const firstName = String(body.first_name ?? "").trim();
    if (!email || !firstName) return json({ error: "Le prénom et l'e-mail sont obligatoires." }, 400);
    if (body.is_junior && !body.parent_consent) {
      return json({ error: "Pour une cliente junior, l'accord du parent est obligatoire." }, 400);
    }
    const { data, error } = await db.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: {
          first_name: firstName,
          last_name: String(body.last_name ?? "").trim(),
          gender: body.gender === "m" ? "m" : "f",
          program: body.program ?? "starter90",
          program_start: body.program_start ?? null,
          is_junior: !!body.is_junior,
          parent_name: body.parent_name ?? null,
          parent_email: body.parent_email ?? null,
          parent_consent: !!body.parent_consent,
        },
      },
    });
    if (error) {
      const exists = /already|registered|exists/i.test(error.message);
      return json({
        error: exists ? "Cette adresse e-mail a déjà un compte. Ouvre sa fiche pour lui renvoyer un lien." : error.message,
      }, 400);
    }
    return json({ link: data.properties?.action_link, user_id: data.user?.id });
  }

  if (body.action === "link") {
    const { data: p } = await db.from("profiles").select("email").eq("id", body.rider_id).single();
    if (!p?.email) return json({ error: "Cliente introuvable." }, 404);
    const { data: u } = await db.auth.admin.getUserById(body.rider_id);
    const type = u?.user?.last_sign_in_at ? "recovery" : "invite";
    const { data, error } = type === "invite"
      ? await db.auth.admin.generateLink({ type: "invite", email: p.email, options: { redirectTo } })
      : await db.auth.admin.generateLink({ type: "recovery", email: p.email, options: { redirectTo } });
    if (error) {
      // L'invitation existe déjà : on passe par un lien magique.
      const retry = await db.auth.admin.generateLink({ type: "magiclink", email: p.email, options: { redirectTo } });
      if (retry.error) return json({ error: retry.error.message }, 400);
      return json({ link: retry.data.properties?.action_link });
    }
    return json({ link: data.properties?.action_link });
  }

  if (body.action === "delete") {
    const riderId = String(body.rider_id ?? "");
    const { data: p } = await db.from("profiles").select("role").eq("id", riderId).single();
    if (!p || p.role !== "rider") return json({ error: "Cliente introuvable." }, 404);
    // Fichiers (photos, vocaux, audios)
    for (const bucket of ["avatars", "chat", "audios"]) {
      const { data: files } = await db.storage.from(bucket).list(riderId, { limit: 1000 });
      if (files?.length) await db.storage.from(bucket).remove(files.map((f) => `${riderId}/${f.name}`));
    }
    // Ses messages dans le groupe
    const { data: groupMsgs } = await db.from("messages").select("image_path, audio_path")
      .is("thread_rider_id", null).eq("sender_id", riderId);
    const groupFiles = (groupMsgs ?? []).flatMap((m) => [m.image_path, m.audio_path]).filter(Boolean) as string[];
    if (groupFiles.length) await db.storage.from("chat").remove(groupFiles);
    await db.from("messages").delete().is("thread_rider_id", null).eq("sender_id", riderId);
    // Le compte (toutes les autres données sont supprimées en cascade)
    const { error } = await db.auth.admin.deleteUser(riderId);
    if (error) return json({ error: error.message }, 400);
    return json({ deleted: true });
  }

  return json({ error: "Action inconnue." }, 400);
});
