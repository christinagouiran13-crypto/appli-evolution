-- =====================================================================
-- Missions Junior 90 (fournies par Christina) et thèmes des séances junior
-- =====================================================================
insert into public.junior_missions (position, title, body)
select * from (values
  (0, 'Mission 1 · Ma carte de cavalière',
'On commence par faire connaissance avec la cavalière que tu es aujourd''hui. Pas de bonne ou de mauvaise réponse : sois juste toi !

1. Ma carte de cavalière (une fois, 10 min) : sur une feuille, le nom de ton cheval, ce que tu adores à cheval, et ce qui te stresse un peu.
2. Ma météo (après chaque monte, 1 min) : dessine un soleil, un nuage ou un orage pour dire comment tu t''es sentie.
3. Mes notes sur 10 (une fois, 5 min) : donne-toi une note de 1 à 10 pour ma concentration, ma confiance, mon calme, mon plaisir. Garde-les bien, on les comparera à la fin !

À m''envoyer dans l''appli (onglet Messages) avant notre séance : une photo de ta carte de cavalière et de tes 4 notes.'),
  (1, 'Mission 2 · Mon grand rêve',
'Un objectif, c''est comme un abord : il faut savoir où on regarde pour y aller. On fixe ta direction !

1. Mon grand rêve (une fois, 10 min) : écris ou dessine ton rêve de cavalière, même s''il te paraît très loin.
2. Mon escalier (une fois, 10 min) : dessine 3 marches qui montent vers ton rêve. Sur la marche du haut, ce que tu veux réussir d''ici 3 mois. Affiche-le dans ta chambre.
3. Mon petit objectif (avant chaque monte) : choisis UNE petite chose à réussir (ex. : bien regarder, rester calme au montoir).

À m''envoyer dans l''appli (onglet Messages) avant notre séance : une photo de ton escalier.'),
  (2, 'Mission 3 · Je reste dans ma bulle',
'À cheval, ta tête doit être avec ton cheval. On entraîne ta concentration comme un muscle !

1. La respiration carrée (avant de monter, 1 min) : inspire en comptant jusqu''à 4, bloque 4, souffle 4, bloque 4. Fais-le 4 fois.
2. Mon mot-clé (pendant chaque monte) : choisis un mot qui te ramène dans ta bulle (ex. : « regard », « calme »). Dis-le dans ta tête quand tu montes.
3. Le film dans ma tête (2 fois par semaine, 3 min) : yeux fermés, imagine ton parcours ou ta reprise du début à la fin, comme un film où tout se passe bien.

À m''envoyer dans l''appli (onglet Messages) avant notre séance : ton mot-clé et un moment où il t''a aidée.'),
  (3, 'Mission 4 · Mon pot de réussites',
'La confiance, ça se remplit comme une tirelire. On la remplit tous les jours !

1. Mon pot de réussites (chaque jour, 1 min) : écris une réussite sur un petit papier et mets-le dans un pot. À cheval ou ailleurs !
2. Ma voix de coach (quand ça arrive) : quand tu penses « je suis nulle », remplace par une phrase de coach : « j''apprends et je progresse ».
3. La posture de championne (avant de monter, 1 min) : debout, épaules ouvertes, menton levé, grand sourire. Ton corps donne du courage à ta tête !

À m''envoyer dans l''appli (onglet Messages) avant notre séance : une photo de ton pot et ta phrase de coach préférée.'),
  (4, 'Mission 5 · Mon thermomètre des émotions',
'Stress, peur, colère, joie… toutes les émotions sont normales. On apprend à les reconnaître et à les calmer.

1. Mon thermomètre (avant chaque monte) : donne une note à ton stress de 1 (tout calme) à 10 (très stressée).
2. La respiration ballon (quand le thermomètre monte) : mains sur le ventre, gonfle ton ventre comme un ballon en inspirant, souffle doucement. 5 fois.
3. La règle des 3 secondes (après chaque erreur) : 1, je souffle. 2, je dis mon mot-clé. 3, je regarde devant et je repars !

À m''envoyer dans l''appli (onglet Messages) avant notre séance : un moment où tu as utilisé la règle des 3 secondes.'),
  (5, 'Mission 6 · Ma routine de championne',
'Les grandes cavalières ont toutes une routine. On construit la tienne avec tout ce que tu as appris !

1. Ma routine (une fois, 10 min) : sur une feuille, 3 cases. AVANT (ce que je fais au paddock), PENDANT (mon mot-clé, mon regard), APRÈS (3 choses réussies). Tu peux aussi la noter dans l''appli : onglet Indispensables, puis Ma routine.
2. Je la teste (1 monte ou 1 concours) : utilise ta routine en concours ou en cours, comme si c''était un concours.
3. Mes notes, le retour (une fois, 5 min) : redonne-toi tes 4 notes sur 10 et compare avec ta toute première mission. Regarde ce chemin !

À m''envoyer dans l''appli (onglet Messages) avant notre séance : une photo de ta routine et tes nouvelles notes. Je suis tellement fière de toi !')
) as v(position, title, body)
where not exists (select 1 from public.junior_missions);

-- Message de confirmation adapté aux missions détaillées
update public.auto_messages set
  body = 'Ta séance {numero} est confirmée le {date} à {heure} ! Voici ta mission pour la préparer :

{mission}

Une question ? Écris-moi, je suis là.'
where code = 'junior_mission';

-- Comptes junior : les 6 séances Junior 90
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  is_first boolean := not exists (select 1 from profiles where role = 'coach');
  prog text := nullif(meta->>'program', '');
  st text := coalesce(nullif(meta->>'status', ''), 'active');
begin
  if prog = 'termine' then prog := null; st := 'alumni'; end if;
  insert into profiles (id, role, email, first_name, last_name, gender, program, program_start, status,
                        is_junior, parent_name, parent_email, parent_consent_at, activated_at, self_signup)
  values (
    new.id,
    case when is_first then 'coach'::user_role else 'rider'::user_role end,
    new.email,
    coalesce(meta->>'first_name', case when is_first then 'Christina' else '' end),
    coalesce(meta->>'last_name', ''),
    coalesce(nullif(meta->>'gender', ''), 'f'),
    case when is_first then null when st = 'alumni' then prog::program_kind else coalesce(prog, 'starter90')::program_kind end,
    case when is_first then null else coalesce(nullif(meta->>'program_start', '')::date, current_date) end,
    case when is_first then 'active'::member_status else st::member_status end,
    coalesce((meta->>'is_junior')::boolean, false),
    meta->>'parent_name',
    meta->>'parent_email',
    case when (meta->>'parent_consent')::boolean then now() end,
    case when is_first then now() end,
    coalesce((meta->>'self_signup')::boolean, false)
  );
  if not is_first then
    insert into routines (rider_id) values (new.id);
    if st = 'active' and coalesce((meta->>'is_junior')::boolean, false) then
      -- Junior 90 : 6 séances
      insert into sessions (rider_id, number, theme)
      select new.id, n, t from unnest(array['Où j''en suis', 'Mes objectifs', 'Ma concentration', 'Ma confiance en moi', 'Mes émotions', 'Mon plan d''action']) with ordinality as x(t, n);
    elsif st = 'active' and coalesce(prog, 'starter90') = 'starter90' then
      insert into sessions (rider_id, number, theme)
      select new.id, n, t from unnest(array['Objectifs', 'Concentration', 'Confiance en soi', 'Gestion des émotions', 'Plan d''action']) with ordinality as x(t, n);
    end if;
  end if;
  return new;
end $$;

-- Confirmation de séance : mission détaillée, ou simple confirmation s'il n'y a plus de mission
create or replace function public.on_session_booked() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record; tpl record; m record; extra jsonb; txt text; n int;
begin
  if new.scheduled_at is null or new.scheduled_at < now() or new.done then return new; end if;
  if tg_op = 'UPDATE' and old.scheduled_at is not distinct from new.scheduled_at then return new; end if;
  select * into p from profiles where id = new.rider_id;
  if not p.is_junior or p.status <> 'active' or p.activated_at is null then return new; end if;
  select * into tpl from auto_messages where code = 'junior_mission' and enabled;
  if not found or public.coach_id() is null then return new; end if;

  insert into auto_message_log (rider_id, code, ref_key)
  values (new.rider_id, 'junior_session', new.id::text || '@' || new.scheduled_at::text)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return new; end if;

  select * into m from junior_missions order by position, created_at
    offset greatest(coalesce(new.number, 1) - 1, 0) limit 1;
  extra := jsonb_build_object(
    'numero', coalesce(new.number::text, ''),
    'date', to_char(new.scheduled_at at time zone 'Europe/Paris', 'DD/MM'),
    'heure', to_char(new.scheduled_at at time zone 'Europe/Paris', 'HH24"h"MI'),
    'mission', case when m.id is null then '' else m.title || coalesce(E'\n\n' || nullif(m.body, ''), '') end
  );
  if m.id is null then
    txt := public.fill_template('Ta séance {numero} est confirmée le {date} à {heure} ! À très vite.', new.rider_id, extra);
  else
    txt := public.fill_template(tpl.body, new.rider_id, extra);
  end if;
  insert into messages (thread_rider_id, sender_id, kind, body) values (new.rider_id, public.coach_id(), 'auto', txt);
  perform private.call_function('push', jsonb_build_object(
    'type', 'notify', 'user_id', new.rider_id, 'pref', 'session',
    'title', 'Christina', 'body', left(txt, 120), 'url', '/messages?fil=coach'));
  return new;
end $$;
