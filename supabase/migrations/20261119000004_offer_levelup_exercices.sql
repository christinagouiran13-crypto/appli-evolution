-- Level Up 180 : suivi + séance mensuelle + exercices
update public.app_settings
set offers = jsonb_set(offers, '{levelup180,description}',
  to_jsonb('Pour aller plus loin, garde ton suivi et ta coach à tes côtés : une séance par mois avec Christina et des exercices pour progresser en concours, saison après saison.'::text));
