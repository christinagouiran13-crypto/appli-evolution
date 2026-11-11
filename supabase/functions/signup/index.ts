// Inscription autonome d'une cliente, avec le lien d'inscription partagé par Christina.
import { adminClient, cors, json } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = adminClient();
  const b = await req.json().catch(() => ({}));

  const { data: settings } = await db.from("app_settings").select("signup_code").single();
  if (!b.code || b.code !== settings?.signup_code) {
    return json({ error: "Ce lien d'inscription n'est plus valable. Demande le nouveau lien à Christina." }, 403);
  }

  const email = String(b.email ?? "").trim().toLowerCase();
  const firstName = String(b.first_name ?? "").trim();
  const password = String(b.password ?? "");
  if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Indique ton prénom et une adresse e-mail valide." }, 400);
  if (password.length < 8) return json({ error: "Ton mot de passe doit faire au moins 8 caractères." }, 400);
  if (!b.consent || !b.sensitive) return json({ error: "Coche les deux cases d'accord pour continuer." }, 400);
  if (b.is_junior && (!String(b.parent_name ?? "").trim() || !b.parent_consent)) {
    return json({ error: "Pour une junior, indique le nom du parent et coche son accord." }, 400);
  }
  const program = ["starter90", "levelup180", "club", "termine"].includes(b.program) ? b.program : "starter90";

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: String(b.last_name ?? "").trim(),
      gender: b.gender === "m" ? "m" : "f",
      program,
      program_start: b.program_start || null,
      is_junior: !!b.is_junior,
      parent_name: b.parent_name ?? null,
      parent_email: b.parent_email ?? null,
      parent_consent: !!b.parent_consent,
      self_signup: true,
    },
  });
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return json({ error: exists ? "Tu as déjà un compte avec cette adresse : connecte-toi avec ton mot de passe. Mot de passe oublié ? Demande à Christina un lien de connexion." : error.message }, 400);
  }
  // Accord RGPD donné dans le formulaire : le compte est activé tout de suite
  await db.from("profiles").update({ consent_at: new Date().toISOString(), activated_at: new Date().toISOString() }).eq("id", data.user!.id);
  return json({ ok: true });
});
