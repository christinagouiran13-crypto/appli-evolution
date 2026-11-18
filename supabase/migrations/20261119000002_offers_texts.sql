-- Textes de « Ton parcours Évolution » validés par Christina
update public.app_settings set offers = '{
  "starter90": {"title": "Starter 90", "tagline": "Les bases de ton mental de compétitrice", "description": "Pose des bases solides : objectifs, concentration, confiance, émotions et routine."},
  "levelup180": {"title": "Level Up 180", "tagline": "La suite pour passer un cap", "description": "Pour aller plus loin, garde ta coach à tes côtés : une séance par mois avec Christina pour progresser en concours, saison après saison."},
  "club": {"title": "Évolution Club", "tagline": "Rester dans l''équipe, sans engagement", "description": "Garde ton suivi avec une séance par mois avec Christina, sans engagement, et fais partie de l''Équipe Évolution."}
}'::jsonb;
