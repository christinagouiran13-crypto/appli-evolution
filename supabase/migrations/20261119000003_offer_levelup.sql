-- Level Up 180 : mettre en avant le suivi
update public.app_settings
set offers = jsonb_set(offers, '{levelup180,description}',
  to_jsonb('Pour aller plus loin, garde ton suivi et ta coach à tes côtés, avec une séance par mois avec Christina pour progresser en concours, saison après saison.'::text));
